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
        return res
          .status(502)
          .json({
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

  return router;
}
