import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { RUBRICS_SYSTEM_PROMPT } from "@/lib/prompt";

// Function to reconstruct initial JSON from inline diff (borrowed from validate-json-changes-v2)
const reconstructInitialJSON = (inlineDiff: string): string => {
  const lines = inlineDiff.split("\n");
  const resultLines: string[] = [];
  let skipDepth = 0;
  let isSkipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // If we're currently skipping an addition block
    if (isSkipping) {
      if (trimmed.startsWith("+")) {
        // Check for closing braces/brackets
        if (
          trimmed === "+    }" ||
          trimmed === "+    ]" ||
          trimmed === "+      }" ||
          trimmed === "+      ]"
        ) {
          skipDepth--;
          if (skipDepth === 0) {
            isSkipping = false;
          }
        }
        // Check for opening braces/brackets
        else if (
          trimmed === "+    {" ||
          trimmed === "+    [" ||
          trimmed === "+      {" ||
          trimmed === "+      ["
        ) {
          skipDepth++;
        }
      }
      continue;
    }

    // Skip lines that start with + (additions)
    if (trimmed.startsWith("+")) {
      // Check if this is starting a block
      if (trimmed === "+    {" || trimmed === "+      {") {
        isSkipping = true;
        skipDepth = 1;
      }
      // Single line addition, just skip
      continue;
    }

    // For lines that start with -, remove the - marker
    if (trimmed.startsWith("-")) {
      // Remove the - prefix but keep the rest of the line structure
      const cleaned = line.replace(/^(\s*)-(\s*)/, "$1$2");
      resultLines.push(cleaned);
      continue;
    }

    // For normal lines (no marker), keep them as-is
    resultLines.push(line);
  }

  return resultLines.join("\n");
};
async function generateWithClaude(
  inlineDiff: string,
  prompt: string
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Reconstruct initial JSON state
  const initialJSON = reconstructInitialJSON(inlineDiff);

  const message = await anthropic.messages.create({
    model: model,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `${RUBRICS_SYSTEM_PROMPT}

# INITIAL JSON STATE
\`\`\`json
${initialJSON}
\`\`\`

# USER PROMPT
"${prompt.replace(/"/g, '\\"')}"

Generate the rubrics now (JSON only):`,
      },
    ],
  });

  if (message.content[0].type === "text") {
    let responseText = message.content[0].text;

    // Clean up markdown code blocks if present
    responseText = responseText
      .replace(/```json\s?/g, "")
      .replace(/```\s?/g, "")
      .trim();

    try {
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (parseError: any) {
      console.error("Failed to parse Claude response:", parseError);
      throw new Error(`Failed to parse response: ${parseError.message}`);
    }
  }

  throw new Error("No text content in Claude response");
}

async function generateWithOpenAI(
  inlineDiff: string,
  prompt: string
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4-turbo-preview";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
  });

  // Reconstruct initial JSON state
  const initialJSON = reconstructInitialJSON(inlineDiff);

  const completion = await openai.chat.completions.create({
    model: model,
    messages: [
      {
        role: "system",
        content: RUBRICS_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `# INITIAL JSON STATE
\`\`\`json
${initialJSON}
\`\`\`

# USER PROMPT
"${prompt.replace(/"/g, '\\"')}"

Generate the rubrics now (JSON only):`,
      },
    ],
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || "";

  try {
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (parseError: any) {
    console.error("Failed to parse OpenAI response:", parseError);
    throw new Error(`Failed to parse response: ${parseError.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inlineDiff, prompt } = await request.json();

    console.log("=== RUBRICS CREATE REQUEST ===");
    console.log("Inline diff length:", inlineDiff?.length || 0);
    console.log("Prompt length:", prompt?.length || 0);
    console.log("Provider:", process.env.AI_PROVIDER || "claude");
    console.log("=== END REQUEST ===");

    if (!inlineDiff || !prompt) {
      return NextResponse.json(
        { error: "Inline diff and prompt are required" },
        { status: 400 }
      );
    }

    const provider = process.env.AI_PROVIDER || "claude";

    let result;
    if (provider === "openai") {
      result = await generateWithOpenAI(inlineDiff, prompt);
    } else if (provider === "claude") {
      result = await generateWithClaude(inlineDiff, prompt);
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid AI_PROVIDER configuration. Must be "openai" or "claude"',
        },
        { status: 500 }
      );
    }

    console.log("=== RUBRICS CREATE SUCCESS ===");
    console.log("Rubrics count:", result.rubrics?.length || 0);
    console.log("Total points:", result.totalPoints || 0);
    console.log("=== END SUCCESS ===");

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error("=== RUBRICS CREATE ERROR ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("=== END ERROR ===");

    return NextResponse.json(
      { error: error.message || "Failed to generate rubrics" },
      { status: 500 }
    );
  }
}
