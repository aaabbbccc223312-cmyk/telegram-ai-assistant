export default async (req) => {
  // Only allow POST requests.
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        error: "Method not allowed."
      }),
      {
        status: 405,
        headers: {
          "Content-Type": "application/json"
        }
      }
    );
  }

  try {
    // Read the request body.
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
      return new Response(
        JSON.stringify({
          error: "Please enter a message."
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    // Get the API key from Netlify Environment Variables.
    const apiKey =
      process.env.OPENAI_API_KEY;

    if (!apiKey) {
      console.error(
        "OPENAI_API_KEY is not configured."
      );

      return new Response(
        JSON.stringify({
          error:
            "AI service is not configured yet."
        }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }

    /*
     * Keep the conversation small so requests don't
     * grow indefinitely.
     */
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

    /*
     * Ask OpenAI's Responses API.
     *
     * The model can be changed later without touching
     * the frontend.
     */
    const openaiResponse =
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
              "brainstorming, explanations, and everyday tasks. " +
              "Be concise by default, but provide detail when useful. " +
              "Do not claim to have real-time information unless you actually have access to it.",

            input: recentConversation.length
              ? recentConversation
              : [
                  {
                    role: "user",
                    content: message
                  }
                ],

            store: false
          })
        }
      );


    /*
     * Handle OpenAI errors.
     */
    if (!openaiResponse.ok) {
      const errorText =
        await openaiResponse.text();

      console.error(
        "OpenAI API error:",
        errorText
      );

      return new Response(
        JSON.stringify({
          error:
            "The AI service could not process your request."
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }


    const data =
      await openaiResponse.json();


    /*
     * Responses API exposes convenient output_text
     * in the SDK; with raw HTTP we extract text from
     * the output message content.
     */
    let reply = "";

    if (
      typeof data.output_text ===
      "string"
    ) {
      reply =
        data.output_text.trim();
    }


    if (!reply && Array.isArray(data.output)) {

      for (
        const item of data.output
      ) {

        if (
          item &&
          item.type === "message" &&
          Array.isArray(item.content)
        ) {

          for (
            const content of item.content
          ) {

            if (
              content &&
              content.type === "output_text" &&
              typeof content.text === "string"
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
      return new Response(
        JSON.stringify({
          error:
            "The AI returned an empty response."
        }),
        {
          status: 502,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }


    /*
     * Return the answer to the Mini App.
     */
    return new Response(
      JSON.stringify({
        reply
      }),
      {
        status: 200,

        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store"
        }
      }
    );

  } catch (error) {

    console.error(
      "Function error:",
      error
    );

    return new Response(
      JSON.stringify({
        error:
          "Something went wrong. Please try again."
      }),
      {
        status: 500,

        headers: {
          "Content-Type":
            "application/json"
        }
      }
    );
  }
};
