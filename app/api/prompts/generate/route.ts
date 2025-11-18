import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { PROMPT_GENERATION_SYSTEM } from "@/lib/prompt";
async function generateWithClaude(
  inlineDiff: string,
  difficulty: string
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const message = await anthropic.messages.create({
    model: model,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: `${PROMPT_GENERATION_SYSTEM(difficulty)}

# INLINE DIFF (showing before and after state)
\`\`\`
${inlineDiff}
\`\`\``,
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
  difficulty: string
): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-5";

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const completion = await openai.chat.completions.create({
    model: model,
    reasoning_effort: "high",
    messages: [
      {
        role: "system",
        content: PROMPT_GENERATION_SYSTEM(difficulty),
      },
      {
        role: "user",
        content: `# INLINE DIFF (showing before and after state)
\`\`\`
${inlineDiff}
\`\`\``,
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
    const { inlineDiff } = await request.json();

    console.log("=== PROMPT GENERATION REQUEST ===");
    console.log("Inline diff length:", inlineDiff?.length || 0);
    console.log("Provider:", process.env.AI_PROVIDER || "claude");
    console.log("=== END REQUEST ===");

    if (!inlineDiff || !inlineDiff.trim()) {
      return NextResponse.json(
        { error: "Inline diff is required" },
        { status: 400 }
      );
    }

    const provider = process.env.AI_PROVIDER || "claude";

    // Auto-determine difficulty from diff complexity (not used in generation, just for logging)
    const difficulty = "auto";

    let result;
    if (provider === "openai") {
      result = await generateWithOpenAI(inlineDiff, difficulty);
    } else if (provider === "claude") {
      result = await generateWithClaude(inlineDiff, difficulty);
    } else {
      return NextResponse.json(
        {
          error:
            'Invalid AI_PROVIDER configuration. Must be "openai" or "claude"',
        },
        { status: 500 }
      );
    }

    console.log("=== PROMPT GENERATION SUCCESS ===");
    console.log("Prompt length:", result.prompt?.length || 0);
    console.log("=== END SUCCESS ===");

    // Return generated prompt along with the original input diff
    return NextResponse.json(
      {
        prompt: result.prompt,
        inlineDiff: inlineDiff,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("=== PROMPT GENERATION ERROR ===");
    console.error("Error type:", error.constructor.name);
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("=== END ERROR ===");

    return NextResponse.json(
      { error: error.message || "Failed to generate prompt" },
      { status: 500 }
    );
  }
}
