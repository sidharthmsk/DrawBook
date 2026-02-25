import { Router } from "express";
import Groq from "groq-sdk";
const MAKE_REAL_SYSTEM_PROMPT = `You are an expert web developer who specializes in building working website prototypes from wireframe descriptions. Your job is to accept descriptions of low-fidelity designs and turn them into high-fidelity interactive and responsive working prototypes.

When sent design descriptions, you should reply with a high-fidelity working prototype as a single HTML file.

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

The descriptions may reference flow charts, diagrams, labels, arrows, sticky notes, or previous designs. Treat all of these as references for your prototype.

If there are any questions or underspecified features, use what you know about applications, user experience, and website design patterns to "fill in the blanks". If you're unsure of how the designs should work, take a guess—it's better for you to get it wrong than to leave things incomplete.

Your prototype should look and feel much more complete and advanced than the wireframes described. Flesh it out, make it real!

IMPORTANT: The first line of your response MUST be <!DOCTYPE html> and the last line MUST be </html>. Do NOT wrap the HTML in markdown code fences. Return ONLY the HTML file contents, nothing else.`;
function extractHtml(text) {
    const doctypeIdx = text.indexOf("<!DOCTYPE html>");
    const doctypeLowerIdx = text.indexOf("<!doctype html>");
    const startIdx = Math.max(doctypeIdx, doctypeLowerIdx);
    const endTag = "</html>";
    const endIdx = text.lastIndexOf(endTag);
    if (startIdx !== -1 && endIdx !== -1) {
        return text.slice(startIdx, endIdx + endTag.length);
    }
    const fenceMatch = text.match(/```(?:html)?\s*\n([\s\S]*?)```/);
    if (fenceMatch) {
        return fenceMatch[1].trim();
    }
    return null;
}
function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey)
        return null;
    return new Groq({ apiKey });
}
export function createAiRouter() {
    const router = Router();
    // Generate UI from wireframe descriptions (Make Real)
    router.post("/generate-ui", async (req, res) => {
        const groq = getGroqClient();
        if (!groq) {
            return res
                .status(500)
                .json({ error: "GROQ_API_KEY is not configured on the server." });
        }
        const { shapeDescriptions, text, previousHtml, theme } = req.body;
        if (!shapeDescriptions) {
            return res
                .status(400)
                .json({ error: "Shape descriptions are required." });
        }
        const userParts = [];
        if (previousHtml) {
            userParts.push("Here are the latest wireframe descriptions along with a previous prototype. Please create an improved version based on any new annotations or design changes.");
        }
        else {
            userParts.push("Here are the wireframe descriptions. Please reply with a high-fidelity working prototype as a single HTML file.");
        }
        userParts.push(`\n## Shape Descriptions\n${shapeDescriptions}`);
        if (text) {
            userParts.push(`\n## Text found in the design\n${text}`);
        }
        if (previousHtml) {
            userParts.push(`\n## Previous HTML prototype to iterate on\n\`\`\`html\n${previousHtml}\n\`\`\``);
        }
        if (theme) {
            userParts.push(`\nPlease use a ${theme} theme.`);
        }
        try {
            const completion = await groq.chat.completions.create({
                model: "moonshotai/kimi-k2-instruct",
                max_tokens: 16384,
                temperature: 0,
                messages: [
                    { role: "system", content: MAKE_REAL_SYSTEM_PROMPT },
                    { role: "user", content: userParts.join("\n") },
                ],
            });
            const content = completion.choices?.[0]?.message?.content;
            if (!content) {
                return res.status(502).json({ error: "No content in AI response." });
            }
            const html = extractHtml(content);
            if (!html || html.length < 50) {
                console.warn("[AI] Could not extract valid HTML from response:", content.slice(0, 200));
                return res.status(502).json({
                    error: "Could not generate a valid design from the wireframes.",
                });
            }
            console.log(`[AI] Generated HTML prototype (${html.length} chars)`);
            res.json({ html });
        }
        catch (err) {
            console.error("[AI] Generate UI failed:", err);
            res.status(500).json({ error: `AI request failed: ${err.message}` });
        }
    });
    // ─── Groq-powered chat routes ───
    const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
    const GROQ_MODEL = "moonshotai/kimi-k2-instruct";
    function getGroqKey() {
        return process.env.GROQ_API_KEY;
    }
    function chatSystemPrompt(editorType, canvasContext, extraContext) {
        let base = `You are a helpful AI assistant for a collaborative drawing/document application called Drawbook. The user is currently working in a ${editorType} editor.\n\nHere is the current content of their editor:\n${canvasContext}\n\n`;
        if (extraContext) {
            base += `The user has also attached context from other documents in their workspace:\n${extraContext}\n\nUse this additional context when relevant to the user's request.\n\n`;
        }
        if (editorType === "excalidraw") {
            return (base +
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

If the user is NOT asking you to draw something, just respond with helpful text — no elements needed.`);
        }
        if (editorType === "drawio") {
            return (base +
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

If the user is NOT asking you to draw something, just respond with helpful text — no XML needed.`);
        }
        if (editorType === "markdown") {
            return (base +
                `When the user asks you to write or add content, respond with BOTH:
1. A brief text explanation of what you wrote.
2. The markdown content wrapped in <markdown-content> tags.

Example:
Here's a project overview for you:
<markdown-content>
# Project Overview
This project aims to...
</markdown-content>

If the user is NOT asking you to create content, just respond with helpful text — no content tags needed.`);
        }
        if (editorType === "tldraw") {
            return (base +
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

If the user is NOT asking you to draw something, just respond with helpful text — no shape tags needed.`);
        }
        if (editorType === "kanban") {
            return (base +
                `When the user asks you to add cards or organize the board, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of card objects wrapped in <kanban-cards> tags.

Each card object must have: title (string). Optional: description (string), column (string matching a column title).
If column is not specified, cards will be added to the first column.

Example:
<kanban-cards>
[{"title":"Design mockups","description":"Create wireframes for the new feature","column":"To Do"},{"title":"Write tests","column":"In Progress"}]
</kanban-cards>

If the user is NOT asking you to add cards, just respond with helpful text — no card tags needed.`);
        }
        if (editorType === "spreadsheet") {
            return (base +
                `When the user asks you to fill cells, add data, or create formulas, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of cell objects wrapped in <spreadsheet-cells> tags.

Each cell object must have: row (number, 0-indexed), col (number, 0-indexed), value (string or number).

Example:
<spreadsheet-cells>
[{"row":0,"col":0,"value":"Name"},{"row":0,"col":1,"value":"Score"},{"row":1,"col":0,"value":"Alice"},{"row":1,"col":1,"value":95}]
</spreadsheet-cells>

If the user is NOT asking you to modify cells, just respond with helpful text — no cell tags needed.`);
        }
        if (editorType === "grid") {
            return (base +
                `When the user asks you to add rows or data, respond with BOTH:
1. A brief text explanation of what you added.
2. A JSON array of row objects wrapped in <grid-rows> tags.

Each row object should be a Record<string, value> where keys are column IDs from the table schema above.

Example:
<grid-rows>
[{"col-name":"Task 1","col-status":"Todo","col-notes":"First task"}]
</grid-rows>

If the user is NOT asking you to add data, just respond with helpful text — no row tags needed.`);
        }
        if (editorType === "code") {
            return (base +
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

If the user is NOT asking you to write code, just respond with helpful text — no code tags needed.`);
        }
        return base + "Respond helpfully to the user's questions about their work.";
    }
    function parseAiResponse(text, editorType) {
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
            const match = text.match(/<excalidraw-elements>([\s\S]*?)<\/excalidraw-elements>/);
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
            const match = text.match(/<markdown-content>([\s\S]*?)<\/markdown-content>/);
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
            const match = text.match(/<spreadsheet-cells>([\s\S]*?)<\/spreadsheet-cells>/);
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
    async function callGroq(messages) {
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
        const json = (await response.json());
        if (json.error) {
            console.error("[AI] Groq API error:", json.error);
            throw new Error(json.error.message || "Groq API error");
        }
        const content = json.choices?.[0]?.message?.content;
        if (!content)
            throw new Error("No content in AI response.");
        return content;
    }
    async function callGroqStream(messages, onChunk) {
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
        if (!reader)
            throw new Error("No response body");
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";
            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith("data: "))
                    continue;
                const data = trimmed.slice(6);
                if (data === "[DONE]")
                    continue;
                try {
                    const parsed = JSON.parse(data);
                    const chunk = parsed.choices?.[0]?.delta?.content;
                    if (chunk) {
                        full += chunk;
                        onChunk(chunk);
                    }
                }
                catch { }
            }
        }
        return full;
    }
    router.post("/chat", async (req, res) => {
        try {
            const { messages, canvasContext, editorType, extraContext } = req.body;
            if (!messages || !Array.isArray(messages)) {
                return res.status(400).json({ error: "messages array is required." });
            }
            const systemPrompt = chatSystemPrompt(editorType || "tldraw", canvasContext || "No context available.", extraContext);
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
                }
                catch (err) {
                    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
                    res.end();
                }
                return;
            }
            const rawResponse = await callGroq(aiMessages);
            const parsed = parseAiResponse(rawResponse, editorType || "tldraw");
            console.log(`[AI] Chat response for ${editorType} (${parsed.message.length} chars${parsed.content ? `, +content` : ""})`);
            res.json(parsed);
        }
        catch (err) {
            console.error("[AI] Chat request failed:", err);
            res.status(500).json({ error: err.message || "AI chat request failed" });
        }
    });
    router.post("/describe", async (req, res) => {
        try {
            const { shapes, editorType } = req.body;
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
        }
        catch (err) {
            console.error("[AI] Describe request failed:", err);
            res
                .status(500)
                .json({ error: err.message || "AI describe request failed" });
        }
    });
    router.post("/suggest", async (req, res) => {
        try {
            const { canvasContext, editorType } = req.body;
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
        }
        catch (err) {
            console.error("[AI] Suggest request failed:", err);
            res
                .status(500)
                .json({ error: err.message || "AI suggest request failed" });
        }
    });
    router.post("/feedback", (req, res) => {
        const { documentId, messageIndex, rating, content } = req.body;
        console.log(`[AI Feedback] doc=${documentId} idx=${messageIndex} rating=${rating} content=${(content || "").slice(0, 100)}`);
        res.json({ ok: true });
    });
    return router;
}
