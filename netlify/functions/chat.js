import { GoogleGenAI } from "@google/genai";

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
      return json(
        {
          error:
            "GEMINI_API_KEY is missing from Netlify."
        },
        500
      );
    }

    const ai =
      new GoogleGenAI({
        apiKey
      });

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

    if (
      contents.length === 0 ||
      contents[contents.length - 1].role !== "user"
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

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents,

        config: {
          systemInstruction:
            "You are a helpful AI assistant inside a Telegram Mini App. " +
            "Answer clearly and naturally. " +
            "Help with questions, writing, rewriting, summaries, translations, " +
            "brainstorming and explanations. " +
            "Be concise by default.",

          maxOutputTokens: 1500,

          temperature: 0.7
        }
      });

    const reply =
      response.text?.trim();

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
      "Gemini function error:",
      error
    );

    const message =
      String(
        error?.message || ""
      );

    if (
      message.includes("401") ||
      message.toLowerCase().includes("unauthenticated") ||
      message.toLowerCase().includes("invalid api key")
    ) {
      return json(
        {
          error:
            "Gemini authentication failed. Check the API key and Google AI Studio project."
        },
        401
      );
    }

    if (
      message.includes("429") ||
      message.toLowerCase().includes("quota") ||
      message.toLowerCase().includes("resource exhausted")
    ) {
      return json(
        {
          error:
            "Gemini free-tier quota or rate limit has been reached."
        },
        429
      );
    }

    return json(
      {
        error:
          "Gemini could not process the request."
      },
      500
    );
  }
};


function json(data, status) {
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
