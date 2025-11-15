import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

const PROMPT_GENERATION_SYSTEM = (
  difficulty: string
) => `You are an expert at analyzing email data changes and creating realistic task prompts that would result in those changes.

# YOUR TASK
Analyze the provided inline diff showing email state changes and generate a realistic, contextual task prompt that an actual user might have given to produce these exact changes.

# COMPLEXITY ANALYSIS
Automatically determine the complexity based on the changes you see:
- **Simple**: 1-2 basic property changes (mark as read, star, apply label)
- **Moderate**: 3-5 actions or basic conditional logic
- **Complex**: Multiple emails affected, replies created, sophisticated filtering

Generate a prompt that matches the complexity you observe in the diff.

# ANALYSIS INSTRUCTIONS

1. **Extract Exact Patterns**: Find exact subject lines, sender emails/names from the inline diff (look at unchanged lines and - lines for initial state)
2. **Identify Changes**: Analyze + lines to see what actions were taken (added emails, changed properties, etc.)
3. **Create Context**: Write a natural 1-2 sentence backstory explaining why these actions are needed
4. **Generate Precise Actions**: Create specific, structured instructions that would result in these exact changes

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

⚠️ **CRITICAL: Check if ALL emails with same subject are affected**

BEFORE using "For all emails with subject X", you MUST verify:
1. Count how many emails have the SAME subject in the initial state (look at unchanged lines and - lines)
2. Count how many of those emails show the SAME change in the diff (look at + lines)
3. If counts match → Use "For all emails with subject X"
4. If counts DON'T match → Be SPECIFIC with sender

**When ALL emails with same subject are changed:**
- Format: \`For all emails that have subject "Exact Subject Text"\`
- Example: If there are 3 emails with subject "Event invitation" and ALL 3 are marked as read → "For all emails with subject \\"Event invitation\\", mark them as read"

**When ONLY SOME emails with same subject are changed:**
- Format: \`For the email with subject "Exact Subject Text" from [Name] <email@domain.com>\`
- Example: If there are 3 emails with subject "Event invitation" but only 1 from John is marked as read → "For the email with subject \\"Event invitation\\" from John Smith <john@example.com>, mark it as read"
- ALWAYS include the sender's name and email address in this case

**General rules:**
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
- ✅ **VERIFY COMPLETENESS**: Check if ALL emails with same subject are changed before using "For all emails with subject X"
- ✅ **BE SPECIFIC**: If only SOME emails with same subject changed, identify by sender: "For the email with subject X from Name <email>"
- ✅ Use EXACT subject text from initial state (case-sensitive)
- ✅ Use EXACT email addresses when specifying people: Name <email@domain.com>
- ✅ For replies: ALWAYS include subject, reply subject, and full body text
- ✅ Specify location when relevant: "in my inbox", "in primary folder"
- ✅ Use structured format for actions (see examples below)
- ✅ Use double quotes around all subject text and body text

**WHAT YOU MUST NOT DO:**
- ❌ **NO FALSE "ALL EMAILS" CLAIMS**: Never say "For all emails with subject X" if only SOME are changed in the diff
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

**Example 5 - Partial Subject Match (ONLY SOME emails with same subject changed):**
\`\`\`
I need to organize my inbox and prioritize important messages from specific people.

For the email with subject "Project Update" from Sarah Chen <sarah.chen@company.com>, mark it as important and add a star.

For the email with subject "Meeting Notes" from David Lee <david.lee@company.com>, mark it as read.
\`\`\`

**Example 6 - Full Subject Match (ALL emails with same subject changed):**
\`\`\`
I received multiple event invitations that I need to decline because I'm traveling next week.

For all emails with subject "Team Social Event", reply with subject "Re: Team Social Event" and body: "Thanks for the invitation, but I'll be traveling and cannot attend."
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

Now analyze the following inline diff and generate the prompt that would result in these changes:`;

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
\`\`\`

Generate the prompt that would result in these changes (JSON only with prompt and inlineDiff fields):`,
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
\`\`\`

Generate the prompt that would result in these changes (JSON only with prompt and inlineDiff fields):`,
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
    console.log("Inline diff length:", result.inlineDiff?.length || 0);
    console.log("=== END SUCCESS ===");

    // Return the same inline diff that was passed in
    return NextResponse.json(
      {
        prompt: result.prompt,
        inlineDiff: inlineDiff, // Use the input diff, not generated one
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
