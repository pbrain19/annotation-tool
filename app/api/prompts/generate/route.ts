import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const PROMPT_GENERATION_SYSTEM = (
  difficulty: string
) => `You are an expert at analyzing email data and creating realistic task scenarios for email management systems.

# YOUR TASK
Analyze the provided initial email state JSON and generate a realistic, contextual task prompt that an actual user might give to an email assistant.

# DIFFICULTY LEVEL: ${difficulty.toUpperCase()}

${
  difficulty === "easy"
    ? `
**EASY DIFFICULTY GUIDELINES:**
- Generate 1-2 simple, straightforward actions
- Actions: mark as read, star, unstar, apply single label, archive
- Example: "Mark all emails from John as read" or "Star the email about the budget"
`
    : difficulty === "medium"
    ? `
**MEDIUM DIFFICULTY GUIDELINES:**
- Generate 3-5 actions with basic conditional logic
- Use "if subject contains X, then do Y" patterns
- Combine multiple simple actions
- Example: "For emails with 'Q1' in subject, mark as read. For emails with 'Q4', mark as important and star them."
`
    : `
**HARD DIFFICULTY GUIDELINES:**
- Generate complex multi-step tasks with replies, categorization, and multiple conditions
- Include drafting replies with specific content
- Use sophisticated filtering and categorization logic
- Example: "For all event invitations, reply declining politely and mark as read. For order confirmations, apply receipts label."
`
}

# ANALYSIS INSTRUCTIONS

1. **Extract Exact Patterns**: Find exact subject lines, sender emails/names from the initial state
2. **Create Context**: Write a natural 1-2 sentence backstory explaining why these actions are needed
3. **Generate Precise Actions**: Create specific, structured instructions based on the patterns found

# OUTPUT REQUIREMENTS

You must respond with VALID JSON ONLY (no markdown, no code blocks, no explanations):

{
  "prompt": "The generated task prompt as a string",
  "inlineDiff": "The inline diff showing changes (+ for additions, - for removals)"
}

# CRITICAL PROMPT STRUCTURE (FOLLOW EXACTLY)

**PART 1: Context (1-2 sentences)**
- Natural, conversational intro explaining the situation
- Examples: "I need to clear my mailbox of personal things so I can focus on ending the quarter strong."
- Or: "I have some strong upcoming deadlines and need to focus on work."

**PART 2: Specific Actions (Structured format)**
Each action must follow these EXACT patterns:

**For Subject-Based Actions:**
- Format: \`For all emails that have subject "Exact Subject Text"\` OR \`For emails that contain "keyword" in the subject\`
- Always use the EXACT subject text from the initial state
- Use double quotes around subject text
- Be case-sensitive - use exact capitalization from initial state

**For Reply Actions:**
- Format: \`For all emails that have subject "Event invitation", reply with subject "Re: Event invitation" and body: "Your exact reply text here."\`
- OR: \`Reply to [Name] <email@domain.com> that has the subject "Subject Text" with subject "Re: Subject" and body: "Reply text here."\`
- MUST include: exact subject, reply subject, and full body text
- Use email addresses in angle brackets format

**For Basic Actions:**
- Mark as read, mark as important, add a star, add [label name] label
- Format: \`mark them as read\`, \`add a star\`, \`add a "work" label\`

**WHAT YOU MUST DO:**
- ✅ Use EXACT subject text from initial state (case-sensitive)
- ✅ Use EXACT email addresses when specifying people: Name <email@domain.com>
- ✅ For replies: ALWAYS include subject, reply subject, and body text
- ✅ Specify location when relevant: "in my inbox", "in primary folder"
- ✅ Use structured format for actions (see examples below)
- ✅ Use double quotes around all subject text and body text

**WHAT YOU MUST NOT DO:**
- ❌ NO email IDs (id: abc123)
- ❌ NO emdashes (—) use regular dashes (-)
- ❌ NO examples in parentheses
- ❌ NO vague references - be specific with exact text
- ❌ NO negative instructions ("don't delete", "keep everything as-is")
- ❌ NO technical jargon

# APPROVED EXAMPLES (USE THESE AS TEMPLATES)

**Example 1:**
\`\`\`
I have to clear my mailbox of personal things so I can focus on ending the quarter strong.

For all the emails with subject "Event invitation" in my inbox, reply to them with subject "Re: Event invitation" and body: "Sorry but I will not attend."

Add a star to emails whose subject contains "quarterly results" or "Re: Quick question".
\`\`\`

**Example 2:**
\`\`\`
I am working on some end-of-year accounting and projections analysis, and I need help organizing my Gmail's primary folder.

For emails that contain "order confirmation" or "quarterly results" or "project update" in the subject, mark them as important and add a "work" label.

I need you to reply to Thomas Brown's email <thomas.brown@corp.co> that has the subject "Re: Quick question" with subject "Re: Quick question" and body: "Hi Thomas, please check back next week for a final answer." and add a star to it.
\`\`\`

**Example 3:**
\`\`\`
I have some strong upcoming deadlines and need to focus on work. I keep getting invitations to events and order confirmations that just distract me.

For all emails that have the subject "Event invitation", reply with subject "Re: Event invitation" and body: "Hi, I will not be able to attend, but I hope you have a great event." and mark them as read.

For all emails that have the subject "Your order confirmation", mark them as read and add a receipts label.
\`\`\`

**Example 4:**
\`\`\`
It is Q3, and we have a bunch of messages that we need to clear up from last quarter and some messages that require attention for the upcoming quarter.

For emails sent to me that contain "Q1" or "Q2" or "Q3" in the subject mark them as read.

For emails sent to me that contain "Q4" in the subject, please mark them as important and star them.

Also thank Tammy Ford <tammie.ford@startup.io> for her welcome email.
\`\`\`

**NOTICE THE PATTERN:**
1. Natural context sentence(s)
2. Blank line
3. Specific structured actions using exact subject text
4. Each action is clear, precise, and uses exact matching criteria

# INLINE DIFF FORMAT

The inline diff must show the initial state with modifications using + and - markers:

- Use \`-\` prefix for OLD/REMOVED values
- Use \`+\` prefix for NEW/ADDED values  
- No prefix for UNCHANGED lines
- For new messages (replies), add entire message block with + prefix
- Match the exact formatting and structure of the input JSON

Example inline diff format:
\`\`\`
{
  messages: [
    {
      id: "abc123"
      subject: "Q4 Report"
-      isRead: false
+      isRead: true
-      isImportant: false
+      isImportant: true
    }
+    {
+      id: "new123"
+      from: "You <you@example.com>"
+      to: ["someone@example.com"]
+      subject: "Re: Event invitation"
+      text: "Thanks but I cannot attend."
+      labelIds: ["SENT", "ALL"]
+    }
  ]
}
\`\`\`

# IMPORTANT RULES FOR INLINE DIFF

1. **Use Exact Email Addresses in Diff**: In the inlineDiff only, reference people as "Name <email@domain.com>"
2. **Match Initial State Structure**: Keep the same JSON structure and field names
3. **Be Contextual**: Create a believable scenario based on the email patterns you find
4. **Appropriate Difficulty**: Match the complexity to the specified difficulty level
5. **Valid JSON**: Your entire response must be valid JSON
6. **Prompt vs Diff**: The prompt should be CONVERSATIONAL (no email IDs, no examples), but the inlineDiff should be TECHNICAL (with all proper structure)

Now analyze the following initial state and generate the prompt + inline diff:`;

async function generateWithClaude(
  initialState: string,
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

# INITIAL STATE
\`\`\`json
${initialState}
\`\`\`

Generate the prompt and inline diff now (JSON only):`,
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
  initialState: string,
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
    messages: [
      {
        role: "system",
        content: PROMPT_GENERATION_SYSTEM(difficulty),
      },
      {
        role: "user",
        content: `# INITIAL STATE
\`\`\`json
${initialState}
\`\`\`

Generate the prompt and inline diff now (JSON only):`,
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
    const { initialState, difficulty } = await request.json();

    console.log("=== PROMPT GENERATION REQUEST ===");
    console.log("Initial state length:", initialState?.length || 0);
    console.log("Difficulty:", difficulty);
    console.log("Provider:", process.env.AI_PROVIDER || "claude");
    console.log("=== END REQUEST ===");

    if (!initialState || !initialState.trim()) {
      return NextResponse.json(
        { error: "Initial state is required" },
        { status: 400 }
      );
    }

    if (!["easy", "medium", "hard"].includes(difficulty?.toLowerCase())) {
      return NextResponse.json(
        { error: "Difficulty must be easy, medium, or hard" },
        { status: 400 }
      );
    }

    const provider = process.env.AI_PROVIDER || "claude";

    let result;
    if (provider === "openai") {
      result = await generateWithOpenAI(initialState, difficulty);
    } else if (provider === "claude") {
      result = await generateWithClaude(initialState, difficulty);
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
    console.log("Inline diff length:", result.inlineDiff?.length || 0);
    console.log("=== END SUCCESS ===");

    return NextResponse.json(result, { status: 200 });
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
