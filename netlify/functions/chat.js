export default async (req) => {
  if (req.method !== "POST") {
    return json(
      {
        error: "Method not allowed."
      },
      405
    );
  }

  try {
    const body = await req.json();

    const message =
      typeof body.message === "string"
        ? body.message.trim()
        : "";

    const conversation =
      Array.isArray(body.conversation)
        ? body.conversation
        : [];

    if (!message) {
      return json(
        {
          error: "Please enter a message."
        },
        400
      );
    }

    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error(
        "OPENAI_API_KEY is missing."
      );

      return json(
        {
          error:
            "OPENAI_API_KEY is not configured in Netlify."
        },
        500
      );
    }

    const recentConversation =
      conversation
        .filter(
          (item) =>
            item &&
            (
              item.role === "user" ||
              item.role === "assistant"
            ) &&
            typeof item.content === "string"
        )
        .slice(-12);

    const input =
      recentConversation.length > 0
        ? recentConversation
        : [
            {
              role: "user",
              content: message
            }
          ];

    const response =
      await fetch(
        "https://api.openai.com/v1/responses",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
            "Authorization":
              `Bearer ${apiKey}`
          },

          body: JSON.stringify({
            model: "gpt-5.6",

            instructions:
              "You are a helpful AI assistant inside a Telegram Mini App. " +
              "Answer clearly and naturally. " +
              "Help with questions, writing, rewriting, summarizing, translation, " +
              "brainstorming and explanations. " +
              "Be concise by default.",

            input,

            store: false
          })
        }
      );

    const rawBody =
      await response.text();

    /*
     * OpenAI rejected the request.
     */
    if (!response.ok) {
      console.error(
        "OpenAI status:",
        response.status
      );

      console.error(
        "OpenAI response:",
        rawBody
      );

      let apiError = null;

      try {
        apiError =
          JSON.parse(rawBody);
      } catch {
        // Response wasn't JSON.
      }

      const messageFromAPI =
        apiError?.error?.message ||
        apiError?.error?.code ||
        "";

      /*
       * Give the frontend a useful but safe message.
       */
      if (
        response.status === 401
      ) {
        return json(
          {
            error:
              "OpenAI API key is invalid or not authorized."
          },
          401
        );
      }

      if (
        response.status === 403
      ) {
        return json(
          {
            error:
              "OpenAI API access was denied. Check your project permissions and API key."
          },
          403
        );
      }

      if (
        response.status === 429
      ) {
        return json(
          {
            error:
              "OpenAI rejected the request because of rate limits or insufficient API billing/credits."
          },
          429
        );
      }

      return json(
        {
          error:
            messageFromAPI ||
            `OpenAI returned HTTP ${response.status}.`
        },
        502
      );
    }

    let data;

    try {
      data =
        JSON.parse(rawBody);
    } catch {
      return json(
        {
          error:
            "OpenAI returned an invalid response."
        },
        502
      );
    }

    /*
     * Extract text from Responses API.
     */
    let reply = "";

    if (
      typeof data.output_text ===
      "string"
    ) {
      reply =
        data.output_text.trim();
    }

    if (
      !reply &&
      Array.isArray(data.output)
    ) {
      for (
        const item of data.output
      ) {
        if (
          item?.type === "message" &&
          Array.isArray(item.content)
        ) {
          for (
            const content of item.content
          ) {
            if (
              content?.type ===
                "output_text" &&
              typeof content.text ===
                "string"
            ) {
              reply +=
                content.text;
            }
          }
        }
      }

      reply =
        reply.trim();
    }

    if (!reply) {
      return json(
        {
          error:
            "OpenAI returned an empty response."
        },
        502
      );
    }

    return json(
      {
        reply
      },
      200
    );

  } catch (error) {
    console.error(
      "Netlify function error:",
      error
    );

    return json(
      {
        error:
          "The Netlify AI function failed. Check the function logs."
      },
      500
    );
  }
};


/*
 * Small JSON response helper.
 */
function json(
  data,
  status
) {
  return new Response(
    JSON.stringify(data),
    {
      status,

      headers: {
        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-store"
      }
    }
  );
}
