import { Router } from "express";

const SYSTEM_PROMPT = `You are an expert web developer who specializes in building working website prototypes from low-fidelity wireframes. Your job is to accept low-fidelity designs and turn them into high-fidelity interactive and responsive working prototypes.

When sent new designs, you should reply with a high-fidelity working prototype as a single HTML file.

Important constraints:
- Your ENTIRE PROTOTYPE needs to be included in a single HTML file.
- Your response MUST contain the entire HTML file contents.
- Put any JavaScript in a <script> tag with type="module".
- Put any additional CSS in a <style> tag.
- Your prototype must be responsive.
- The HTML file should be self-contained and not reference any external resources except those listed below:
  - Use tailwind (via cdn.tailwindcss.com) for styling.
  - Use unpkg or skypack to import any required JavaScript dependencies.
  - Use Google fonts to pull in any open source fonts you require.
  - If you have any images, load them from Unsplash or use solid colored rectangles as placeholders.
  - Never create icons yourself, use an icon font or external library.

The designs may include flow charts, diagrams, labels, arrows, sticky notes, screenshots of other applications, or even previous designs. Treat all of these as references for your prototype.

The designs may include structural elements (such as boxes that represent buttons or content) as well as annotations or figures that describe interactions, behavior, or appearance. Use your best judgement to determine what is an annotation and what should be included in the final result. Annotations are commonly made in the color red. Do NOT include any of those annotations in your final result.

If there are any questions or underspecified features, use what you know about applications, user experience, and website design patterns to "fill in the blanks". If you're unsure of how the designs should work, take a guess—it's better for you to get it wrong than to leave things incomplete.

Your prototype should look and feel much more complete and advanced than the wireframes provided. Flesh it out, make it real!

IMPORTANT: The first line of your response MUST be <!DOCTYPE html> and the last line MUST be </html>. Do NOT wrap the HTML in markdown code fences. Return ONLY the HTML file contents, nothing else.`;

const USER_PROMPT =
  "Here are the latest wireframes. Please reply with a high-fidelity working prototype as a single HTML file.";

const USER_PROMPT_WITH_PREVIOUS =
  "Here are the latest wireframes along with a previous prototype. Please create an improved version based on any new annotations or design changes. Reply with a high-fidelity working prototype as a single HTML file.";

function extractHtml(text: string): string | null {
  const doctypeIdx = text.indexOf("<!DOCTYPE html>");
  const doctypeLowerIdx = text.indexOf("<!doctype html>");
  const startIdx = Math.max(doctypeIdx, doctypeLowerIdx);

  const endTag = "</html>";
  const endIdx = text.lastIndexOf(endTag);

  if (startIdx !== -1 && endIdx !== -1) {
    return text.slice(startIdx, endIdx + endTag.length);
  }

  // Fallback: try to find HTML inside markdown code fences
  const fenceMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  return null;
}

export function createAiRouter() {
  const router = Router();

  router.post("/generate-ui", async (req, res) => {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return res
        .status(500)
        .json({ error: "OPENROUTER_API_KEY is not configured on the server." });
    }

    const { image, text, previousHtml, theme } = req.body as {
      image: string;
      text?: string;
      previousHtml?: string;
      theme?: "light" | "dark";
    };

    if (!image) {
      return res.status(400).json({ error: "Image data is required." });
    }

    const userContent: Array<{
      type: string;
      text?: string;
      image_url?: { url: string; detail: string };
    }> = [];

    userContent.push({
      type: "text",
      text: previousHtml ? USER_PROMPT_WITH_PREVIOUS : USER_PROMPT,
    });

    userContent.push({
      type: "image_url",
      image_url: { url: image, detail: "high" },
    });

    if (text) {
      userContent.push({
        type: "text",
        text: `Here's a list of text found in the design:\n${text}`,
      });
    }

    if (previousHtml) {
      userContent.push({
        type: "text",
        text: `Here's the HTML from a previous prototype to iterate on:\n${previousHtml}`,
      });
    }

    if (theme) {
      userContent.push({
        type: "text",
        text: `Please use a ${theme} theme.`,
      });
    }

    try {
      const response = await fetch(
        "https://openrouter.ai/api/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://tldraw.self-hosted",
            "X-Title": "tldraw Make Real",
          },
          body: JSON.stringify({
            model: "moonshotai/kimi-k2.5",
            max_tokens: 8192,
            temperature: 0,
            messages: [
              { role: "system", content: SYSTEM_PROMPT },
              { role: "user", content: userContent },
            ],
          }),
        },
      );

      if (!response.ok) {
        const errBody = await response.text();
        console.error("[AI] OpenRouter error:", response.status, errBody);
        return res
          .status(502)
          .json({ error: `OpenRouter returned ${response.status}` });
      }

      const json = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
        error?: { message?: string };
      };

      if (json.error) {
        console.error("[AI] OpenRouter API error:", json.error);
        return res
          .status(502)
          .json({ error: json.error.message || "OpenRouter API error" });
      }

      const content = json.choices?.[0]?.message?.content;
      if (!content) {
        return res.status(502).json({ error: "No content in AI response." });
      }

      const html = extractHtml(content);
      if (!html || html.length < 50) {
        console.warn(
          "[AI] Could not extract valid HTML from response:",
          content.slice(0, 200),
        );
        return res.status(502).json({
          error: "Could not generate a valid design from the wireframes.",
        });
      }

      console.log(`[AI] Generated HTML prototype (${html.length} chars)`);
      res.json({ html });
    } catch (err: any) {
      console.error("[AI] Request failed:", err);
      res.status(500).json({ error: `AI request failed: ${err.message}` });
    }
  });

  // ─── Groq-powered chat routes ───

  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "moonshotai/kimi-k2-instruct";

  function getGroqKey(): string | undefined {
    return process.env.GROQ_API_KEY;
  }

  function chatSystemPrompt(editorType: string, canvasContext: string): string {
    const base = `You are a helpful AI assistant for a collaborative drawing/document application called Drawbook. The user is currently working in a ${editorType} editor.\n\nHere is the current content of their editor:\n${canvasContext}\n\n`;

    if (editorType === "excalidraw") {
      return (
        base +
        `When the user asks you to draw or create something, respond with BOTH:
1. A brief text explanation of what you created.
2. A JSON array of Excalidraw elements wrapped in <excalidraw-elements> tags.

Each element must have: type, x, y, width, height, and any type-specific properties.
Supported types: rectangle, ellipse, diamond, text, arrow, line.
For text elements include a "text" property. For shapes you can include "label" for text inside.
Use strokeColor "#e8e5e0" and backgroundColor "transparent" by default.
Keep coordinates relative starting near (0, 0) — they will be offset automatically.

Example:
<excalidraw-elements>
[{"type":"rectangle","x":0,"y":0,"width":200,"height":80,"strokeColor":"#e8e5e0","backgroundColor":"transparent","label":"Start"},{"type":"arrow","x":100,"y":80,"width":0,"height":60,"strokeColor":"#e8e5e0","points":[[0,0],[0,60]]}]
</excalidraw-elements>

If the user is NOT asking you to draw something, just respond with helpful text — no elements needed.`
      );
    }

    if (editorType === "markdown") {
      return (
        base +
        `When the user asks you to write or add content, respond with BOTH:
1. A brief text explanation of what you wrote.
2. The markdown content wrapped in <markdown-content> tags.

Example:
Here's a project overview for you:
<markdown-content>
# Project Overview
This project aims to...
</markdown-content>

If the user is NOT asking you to create content, just respond with helpful text — no content tags needed.`
      );
    }

    if (editorType === "tldraw") {
      return (
        base +
        `When the user asks you to draw or create something, respond with BOTH:
1. A brief text explanation of what you created.
2. A JSON array of shape descriptions wrapped in <tldraw-shapes> tags.

Each shape object must have: type, x, y, w, h. Optional properties: text, color, geo.
Supported types: geo, text, arrow, note.
For "geo" shapes, set "geo" to one of: rectangle, ellipse, diamond, triangle, hexagon, star, cloud.
For "text" shapes, include a "text" property with the text content.
For "note" shapes, include a "text" property.
For "arrow" shapes, use "start" {x,y} and "end" {x,y} relative points instead of w/h.
Keep coordinates relative starting near (0, 0) — they will be offset automatically.

Example:
<tldraw-shapes>
[{"type":"geo","x":0,"y":0,"w":200,"h":80,"text":"Start","geo":"rectangle"},{"type":"arrow","x":100,"y":80,"start":{"x":0,"y":0},"end":{"x":0,"y":60}},{"type":"geo","x":0,"y":140,"w":200,"h":80,"text":"End","geo":"rectangle"}]
</tldraw-shapes>

If the user is NOT asking you to draw something, just respond with helpful text — no shape tags needed.`
      );
    }

    return base + "Respond helpfully to the user's questions about their work.";
  }

  function parseAiResponse(
    text: string,
    editorType: string,
  ): { message: string; content?: string; contentType?: string } {
    if (editorType === "tldraw") {
      const match = text.match(/<tldraw-shapes>([\s\S]*?)<\/tldraw-shapes>/);
      if (match) {
        const message = text
          .replace(/<tldraw-shapes>[\s\S]*?<\/tldraw-shapes>/, "")
          .trim();
        return {
          message: message || "Here are the shapes I created.",
          content: match[1].trim(),
          contentType: "tldraw-json",
        };
      }
    }

    if (editorType === "excalidraw") {
      const match = text.match(
        /<excalidraw-elements>([\s\S]*?)<\/excalidraw-elements>/,
      );
      if (match) {
        const message = text
          .replace(/<excalidraw-elements>[\s\S]*?<\/excalidraw-elements>/, "")
          .trim();
        return {
          message: message || "Here are the elements I created.",
          content: match[1].trim(),
          contentType: "excalidraw-json",
        };
      }
    }

    if (editorType === "markdown") {
      const match = text.match(
        /<markdown-content>([\s\S]*?)<\/markdown-content>/,
      );
      if (match) {
        const message = text
          .replace(/<markdown-content>[\s\S]*?<\/markdown-content>/, "")
          .trim();
        return {
          message: message || "Here's the content I wrote.",
          content: match[1].trim(),
          contentType: "markdown-text",
        };
      }
    }

    return { message: text };
  }

  async function callGroq(
    messages: Array<{ role: string; content: string }>,
  ): Promise<string> {
    const apiKey = getGroqKey();
    if (!apiKey)
      throw new Error("GROQ_API_KEY is not configured on the server.");

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        max_tokens: 4096,
        temperature: 0.7,
        messages,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[AI] Groq error:", response.status, errBody);
      throw new Error(`Groq returned ${response.status}`);
    }

    const json = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
    };

    if (json.error) {
      console.error("[AI] Groq API error:", json.error);
      throw new Error(json.error.message || "Groq API error");
    }

    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("No content in AI response.");

    return content;
  }

  router.post("/chat", async (req, res) => {
    try {
      const { messages, canvasContext, editorType } = req.body as {
        messages: Array<{ role: string; content: string }>;
        canvasContext: string;
        editorType: string;
      };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required." });
      }

      const systemPrompt = chatSystemPrompt(
        editorType || "tldraw",
        canvasContext || "No context available.",
      );

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const rawResponse = await callGroq(aiMessages);
      const parsed = parseAiResponse(rawResponse, editorType || "tldraw");

      console.log(
        `[AI] Chat response for ${editorType} (${parsed.message.length} chars${parsed.content ? `, +content` : ""})`,
      );
      res.json(parsed);
    } catch (err: any) {
      console.error("[AI] Chat request failed:", err);
      res.status(500).json({ error: err.message || "AI chat request failed" });
    }
  });

  router.post("/describe", async (req, res) => {
    try {
      const { shapes, editorType } = req.body as {
        shapes: string;
        editorType?: string;
      };

      if (!shapes) {
        return res.status(400).json({ error: "shapes data is required." });
      }

      const content = await callGroq([
        {
          role: "system",
          content: `You are a helpful assistant that describes the contents of a ${editorType || "drawing"} editor. Provide a clear, concise description of what you see.`,
        },
        {
          role: "user",
          content: `Describe what's in this editor:\n${shapes}`,
        },
      ]);

      console.log(`[AI] Describe response (${content.length} chars)`);
      res.json({ description: content });
    } catch (err: any) {
      console.error("[AI] Describe request failed:", err);
      res
        .status(500)
        .json({ error: err.message || "AI describe request failed" });
    }
  });

  router.post("/suggest", async (req, res) => {
    try {
      const { canvasContext, editorType } = req.body as {
        canvasContext: string;
        editorType?: string;
      };

      if (!canvasContext) {
        return res
          .status(400)
          .json({ error: "canvasContext data is required." });
      }

      const content = await callGroq([
        {
          role: "system",
          content: `You are a helpful design and content assistant. Suggest improvements for the user's ${editorType || "drawing"} editor content. Be specific and actionable.`,
        },
        {
          role: "user",
          content: `Here's what's currently in my editor:\n${canvasContext}\n\nSuggest improvements.`,
        },
      ]);

      console.log(`[AI] Suggest response (${content.length} chars)`);
      res.json({ suggestions: content });
    } catch (err: any) {
      console.error("[AI] Suggest request failed:", err);
      res
        .status(500)
        .json({ error: err.message || "AI suggest request failed" });
    }
  });

  return router;
}
