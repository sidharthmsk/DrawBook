import { Router } from "express";

export function createAiRouter() {
  const router = Router();

  const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
  const GROQ_MODEL = "moonshotai/kimi-k2-instruct";

  function getGroqKey(): string | undefined {
    return process.env.GROQ_API_KEY;
  }

  function chatSystemPrompt(
    editorType: string,
    canvasContext: string,
    extraContext?: string,
  ): string {
    let base = `You are a helpful AI assistant for a collaborative drawing/document application called Drawbook. The user is currently working in a ${editorType} editor.\n\nHere is the current content of their editor:\n${canvasContext}\n\n`;

    if (extraContext) {
      base += `The user has also attached context from other documents in their workspace:\n${extraContext}\n\nUse this additional context when relevant to the user's request.\n\n`;
    }

    if (editorType === "excalidraw") {
      return (
        base +
        `When the user asks you to draw, create a diagram, or visualize something, respond with BOTH:
1. A brief text explanation of what you created.
2. Mermaid diagram code wrapped in <mermaid-diagram> tags.

Use standard Mermaid syntax. Supported diagram types: flowchart (graph), sequence, class, state, ER, pie, gantt, journey, mindmap, timeline, etc.
Prefer flowchart (graph TD or graph LR) for general diagrams, architecture, and process flows.

Example:
<mermaid-diagram>
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
</mermaid-diagram>

Important:
- Use clear, descriptive node labels.
- Use appropriate arrow types (-->, -->>,-.->, etc.) and labels where helpful.
- Keep diagrams clean and well-structured.
- For complex diagrams, use subgraphs to group related nodes.

If the user is NOT asking you to draw something, just respond with helpful text — no diagram needed.
If the user asks for Mermaid code specifically, provide ONLY the mermaid code as a fenced code block in your text response (do NOT wrap it in <mermaid-diagram> tags), so they can copy it.`
      );
    }

    if (editorType === "drawio") {
      return (
        base +
        `When the user asks you to draw or create a diagram, respond with BOTH:
1. A brief text explanation of what you created.
2. Draw.io XML wrapped in <drawio-xml> tags containing ONLY the new <mxCell> elements to add.

Use the mxCell format with vertex="1" for shapes and edge="1" for connections.
All cells must have parent="1" (the default layer). Use sequential numeric IDs starting from 100.
Include geometry via <mxGeometry> child elements with x, y, width, height attributes.
Use style strings for appearance (e.g. "rounded=1;whiteSpace=wrap;html=1;" for rounded rectangles).

Example:
<drawio-xml>
<mxCell id="100" value="Start" style="ellipse;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="160" y="20" width="120" height="60" as="geometry"/></mxCell>
<mxCell id="101" value="" style="edgeStyle=orthogonalEdgeStyle;" edge="1" source="100" target="102" parent="1"><mxGeometry relative="1" as="geometry"/></mxCell>
<mxCell id="102" value="Process" style="rounded=1;whiteSpace=wrap;html=1;" vertex="1" parent="1"><mxGeometry x="160" y="120" width="120" height="60" as="geometry"/></mxCell>
</drawio-xml>

If the user is NOT asking you to draw something, just respond with helpful text — no XML needed.`
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

    if (editorType === "kanban") {
      return (
        base +
        `When the user asks you to add cards or organize the board, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of card objects wrapped in <kanban-cards> tags.

Each card object must have: title (string). Optional: description (string), column (string matching a column title).
If column is not specified, cards will be added to the first column.

Example:
<kanban-cards>
[{"title":"Design mockups","description":"Create wireframes for the new feature","column":"To Do"},{"title":"Write tests","column":"In Progress"}]
</kanban-cards>

If the user is NOT asking you to add cards, just respond with helpful text — no card tags needed.`
      );
    }

    if (editorType === "spreadsheet") {
      return (
        base +
        `When the user asks you to fill cells, add data, or create formulas, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of cell objects wrapped in <spreadsheet-cells> tags.

Each cell object must have: row (number, 0-indexed), col (number, 0-indexed), value (string or number).

Example:
<spreadsheet-cells>
[{"row":0,"col":0,"value":"Name"},{"row":0,"col":1,"value":"Score"},{"row":1,"col":0,"value":"Alice"},{"row":1,"col":1,"value":95}]
</spreadsheet-cells>

If the user is NOT asking you to modify cells, just respond with helpful text — no cell tags needed.`
      );
    }

    if (editorType === "grid") {
      return (
        base +
        `When the user asks you to add rows or data, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of row objects wrapped in <grid-rows> tags.

Each row object should be a Record<string, value> where keys are column IDs from the table schema above.

Example:
<grid-rows>
[{"col-name":"Task 1","col-status":"Todo","col-notes":"First task"}]
</grid-rows>

If the user is NOT asking you to add data, just respond with helpful text — no row tags needed.`
      );
    }

    if (editorType === "code") {
      return (
        base +
        `When the user asks you to write or modify code, respond with BOTH:
1. A brief text explanation of what you wrote or changed.
2. The code wrapped in <code-content> tags.

Example:
Here's a function that sorts an array:
<code-content>
function sortArray(arr) {
  return arr.sort((a, b) => a - b);
}
</code-content>

If the user is NOT asking you to write code, just respond with helpful text — no code tags needed.`
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
        /<mermaid-diagram>([\s\S]*?)<\/mermaid-diagram>/,
      );
      if (match) {
        const message = text
          .replace(/<mermaid-diagram>[\s\S]*?<\/mermaid-diagram>/, "")
          .trim();
        return {
          message: message || "Here's the diagram I created.",
          content: match[1].trim(),
          contentType: "excalidraw-mermaid",
        };
      }
    }

    if (editorType === "drawio") {
      const match = text.match(/<drawio-xml>([\s\S]*?)<\/drawio-xml>/);
      if (match) {
        const message = text
          .replace(/<drawio-xml>[\s\S]*?<\/drawio-xml>/, "")
          .trim();
        return {
          message: message || "Here are the diagram elements I created.",
          content: match[1].trim(),
          contentType: "drawio-xml",
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

    if (editorType === "kanban") {
      const match = text.match(/<kanban-cards>([\s\S]*?)<\/kanban-cards>/);
      if (match) {
        const message = text
          .replace(/<kanban-cards>[\s\S]*?<\/kanban-cards>/, "")
          .trim();
        return {
          message: message || "Here are the cards I created.",
          content: match[1].trim(),
          contentType: "kanban-json",
        };
      }
    }

    if (editorType === "spreadsheet") {
      const match = text.match(
        /<spreadsheet-cells>([\s\S]*?)<\/spreadsheet-cells>/,
      );
      if (match) {
        const message = text
          .replace(/<spreadsheet-cells>[\s\S]*?<\/spreadsheet-cells>/, "")
          .trim();
        return {
          message: message || "Here are the cell updates.",
          content: match[1].trim(),
          contentType: "spreadsheet-json",
        };
      }
    }

    if (editorType === "grid") {
      const match = text.match(/<grid-rows>([\s\S]*?)<\/grid-rows>/);
      if (match) {
        const message = text
          .replace(/<grid-rows>[\s\S]*?<\/grid-rows>/, "")
          .trim();
        return {
          message: message || "Here are the rows I created.",
          content: match[1].trim(),
          contentType: "grid-json",
        };
      }
    }

    if (editorType === "code") {
      const match = text.match(/<code-content>([\s\S]*?)<\/code-content>/);
      if (match) {
        const message = text
          .replace(/<code-content>[\s\S]*?<\/code-content>/, "")
          .trim();
        return {
          message: message || "Here's the code.",
          content: match[1].trim(),
          contentType: "code-text",
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

  async function callGroqStream(
    messages: Array<{ role: string; content: string }>,
    onChunk: (text: string) => void,
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
        stream: true,
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[AI] Groq stream error:", response.status, errBody);
      throw new Error(`Groq returned ${response.status}`);
    }

    let full = "";
    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>;
          };
          const chunk = parsed.choices?.[0]?.delta?.content;
          if (chunk) {
            full += chunk;
            onChunk(chunk);
          }
        } catch {}
      }
    }
    return full;
  }

  router.post("/chat", async (req, res) => {
    try {
      const { messages, canvasContext, editorType, extraContext } =
        req.body as {
          messages: Array<{ role: string; content: string }>;
          canvasContext: string;
          editorType: string;
          extraContext?: string;
        };

      if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: "messages array is required." });
      }

      const systemPrompt = chatSystemPrompt(
        editorType || "tldraw",
        canvasContext || "No context available.",
        extraContext,
      );

      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ];

      const wantStream = req.headers.accept === "text/event-stream";

      if (wantStream) {
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        try {
          const fullText = await callGroqStream(aiMessages, (chunk) => {
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
          });
          const parsed = parseAiResponse(fullText, editorType || "tldraw");
          res.write(`data: ${JSON.stringify({ done: true, ...parsed })}\n\n`);
          res.end();
        } catch (err: any) {
          res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
          res.end();
        }
        return;
      }

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

      const editorLabel = editorType || "drawing";
      const content = await callGroq([
        {
          role: "system",
          content: `You are an expert assistant analyzing the contents of a ${editorLabel} editor in a knowledge base app called Drawbook. Provide a structured description in markdown format with these sections:

## Overview
A 1-2 sentence summary of what the content is about.

## Key Elements
A bullet list of the main elements, shapes, sections, or data points.

## Structure
Describe how the content is organized (layout, hierarchy, flow).

Be specific to the ${editorLabel} editor type. Keep it concise but thorough.`,
        },
        {
          role: "user",
          content: `Describe what's in this ${editorLabel} editor:\n${shapes}`,
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

      const editorLabel = editorType || "drawing";
      const content = await callGroq([
        {
          role: "system",
          content: `You are an expert ${editorLabel} content advisor for a knowledge base app called Drawbook. Provide numbered, actionable suggestions in markdown format. Each suggestion should have:

1. **Title** - A short name for the improvement
   Explanation of what to change and why it helps.

Focus on:
- Content quality and completeness
- Organization and structure
- Visual clarity (for drawing editors)
- Best practices for the ${editorLabel} format

Provide 3-5 specific suggestions. Be concrete, not vague.`,
        },
        {
          role: "user",
          content: `Here's what's currently in my ${editorLabel} editor:\n${canvasContext}\n\nSuggest improvements.`,
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

  router.post("/feedback", (req, res) => {
    const { documentId, messageIndex, rating, content } = req.body as {
      documentId?: string;
      messageIndex?: number;
      rating?: string;
      content?: string;
    };
    console.log(
      `[AI Feedback] doc=${documentId} idx=${messageIndex} rating=${rating} content=${(content || "").slice(0, 100)}`,
    );
    res.json({ ok: true });
  });

  return router;
}
