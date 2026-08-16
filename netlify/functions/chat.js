export default async (req) => {
  if (req.method !== "POST") {
    return json(
      { error: "Method not allowed." },
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
        { error: "Please enter a message." },
        400
      );
    }

    const apiKey =
      process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error(
        "GEMINI_API_KEY is missing."
      );

      return json(
        {
          error:
            "Gemini API key is not configured in Netlify."
        },
        500
      );
    }

    /*
     * Keep the conversation short.
     */
    const recent =
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
        .slice(-10);

    /*
     * Convert our frontend roles to Gemini roles.
     */
    const contents = recent.map(
      (item) => ({
        role:
          item.role === "assistant"
            ? "model"
            : "user",

        parts: [
          {
            text: item.content
          }
        ]
      })
    );

    /*
     * Make sure the current message exists even if
     * the frontend conversation is empty.
     */
    if (
      contents.length === 0 ||
      contents[contents.length - 1].role !==
        "user"
    ) {
      contents.push({
        role: "user",
        parts: [
          {
            text: message
          }
        ]
      });
    }

    /*
     * Gemini API endpoint.
     *
     * Gemini's current API uses the x-goog-api-key
     * header for authentication.
     */
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent",
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey
        },

        body: JSON.stringify({
          systemInstruction: {
            parts: [
              {
                text:
                  "You are a helpful AI assistant inside a Telegram Mini App. " +
                  "Answer clearly and naturally. " +
                  "Help with questions, writing, rewriting, summarizing, translation, " +
                  "brainstorming, explanations, and everyday tasks. " +
                  "Be concise by default, but provide detail when useful."
              }
            ]
          },

          contents,

          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 1500
          }
        })
      }
    );

    const raw =
      await response.text();

    /*
     * API error
     */
    if (!response.ok) {
      console.error(
        "Gemini HTTP status:",
        response.status
      );

      console.error(
        "Gemini response:",
        raw
      );

      let apiError = null;

      try {
        apiError =
          JSON.parse(raw);
      } catch {
        // Ignore JSON parsing failure.
      }

      const apiMessage =
        apiError?.error?.message ||
        "";

      if (
        response.status === 400
      ) {
        return json(
          {
            error:
              apiMessage ||
              "Gemini rejected the request."
          },
          400
        );
      }

      if (
        response.status === 401 ||
        response.status === 403
      ) {
        return json(
          {
            error:
              "Gemini API key is invalid or does not have permission."
          },
          response.status
        );
      }

      if (
        response.status === 429
      ) {
        return json(
          {
            error:
              "Gemini rate limit or free-tier quota has been reached. Please try again later."
          },
          429
        );
      }

      return json(
        {
          error:
            apiMessage ||
            `Gemini returned HTTP ${response.status}.`
        },
        502
      );
    }

    let data;

    try {
      data =
        JSON.parse(raw);
    } catch {
      return json(
        {
          error:
            "Gemini returned an invalid response."
        },
        502
      );
    }

    /*
     * Extract generated text.
     */
    let reply = "";

    const candidates =
      Array.isArray(data.candidates)
        ? data.candidates
        : [];

    for (
      const candidate of candidates
    ) {
      const parts =
        candidate?.content?.parts;

      if (!Array.isArray(parts)) {
        continue;
      }

      for (
        const part of parts
      ) {
        if (
          typeof part?.text === "string"
        ) {
          reply += part.text;
        }
      }
    }

    reply =
      reply.trim();

    if (!reply) {
      return json(
        {
          error:
            "Gemini returned an empty response."
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
          "Something went wrong while contacting Gemini."
      },
      500
    );
  }
};


/*
 * JSON helper
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
