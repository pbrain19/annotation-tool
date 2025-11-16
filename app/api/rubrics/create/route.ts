import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Function to reconstruct initial JSON from inline diff (borrowed from validate-json-changes-v2)
const reconstructInitialJSON = (inlineDiff: string): string => {
  const lines = inlineDiff.split('\n');
  const resultLines: string[] = [];
  let skipDepth = 0;
  let isSkipping = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // If we're currently skipping an addition block
    if (isSkipping) {
      if (trimmed.startsWith('+')) {
        // Check for closing braces/brackets
        if (trimmed === '+    }' || trimmed === '+    ]' || trimmed === '+      }' || trimmed === '+      ]') {
          skipDepth--;
          if (skipDepth === 0) {
            isSkipping = false;
          }
        }
        // Check for opening braces/brackets
        else if (trimmed === '+    {' || trimmed === '+    [' || trimmed === '+      {' || trimmed === '+      [') {
          skipDepth++;
        }
      }
      continue;
    }

    // Skip lines that start with + (additions)
    if (trimmed.startsWith('+')) {
      // Check if this is starting a block
      if (trimmed === '+    {' || trimmed === '+      {') {
        isSkipping = true;
        skipDepth = 1;
      }
      // Single line addition, just skip
      continue;
    }

    // For lines that start with -, remove the - marker
    if (trimmed.startsWith('-')) {
      // Remove the - prefix but keep the rest of the line structure
      const cleaned = line.replace(/^(\s*)-(\s*)/, '$1$2');
      resultLines.push(cleaned);
      continue;
    }

    // For normal lines (no marker), keep them as-is
    resultLines.push(line);
  }

  return resultLines.join('\n');
};

const RUBRICS_SYSTEM_PROMPT = `You are a university professor creating a grading rubric for an email management assignment.

Your rubrics will be used to evaluate student solutions, so they must effectively separate good solutions from bad ones while preventing false positives.

# INPUT CONTEXT
You will receive:
1. INITIAL JSON STATE - The starting state of the email system (reconstructed from diff)
   - Contains current date/time - use this to calculate exact dates for relative terms (tomorrow, next week, etc.)
2. USER PROMPT - The task instructions given to students

# THE GOLDEN RULE: ATOMICITY

## ✅ ATOMIC = Tests exactly ONE aspect
- Cannot be both correct and incorrect simultaneously
- If you can split it with "and", it's NOT atomic
- Must have single pass/fail criterion

**CRITICAL**: When a prompt asks to perform multiple actions joined by commas or "and" (e.g., "label emails with subjects X, Y, and Z"), you MUST create SEPARATE rubrics for each atomic action (one for X, one for Y, one for Z).

**DO NOT split** requests with "or" conditions - these remain as single rubrics.

# FUNDAMENTAL RULES

## 1. TENSE
Always use present simple tense.
✅ Adds the label to the email.
❌ Should add / Has added / Is adding.

## 2. SENTENCE START
Always start with a verb in third-person singular form (no subject).
✅ Removes the receipts label…
❌ The agent removes… / Removing the label…

## 3. SENTENCE STRUCTURE
[Verb in present simple] + [object or target] + [explicit condition or context]

Examples:
✅ "Marks email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> as important"
✅ "Applies label work to all emails with subject "Project update""
✅ "Replies with subject "Re: Meeting follow-up" to email from Lance Jackson <lance.jackson@startup.io>"

❌ "Email to Benjamin Perkins <benjamin.perkins@example.com> references the deadline" (starts with noun!)
❌ "The agent creates email" (has subject!)
❌ "Creating email to recipient" (gerund, not verb!)

## 4. CLARITY AND OBJECTIVITY
- Each criterion must describe one atomic, verifiable action
- Do not include adjectives or subjective terms
- Avoid modal verbs (should, must, tries to)
- Avoid vague conditions (if appropriate, as needed)

## 5. NEGATIVE CONDITIONS
Use "does not" for actions that must not occur.
Example: "Does not star emails that are only welcome messages."

ONLY create negative criteria when the prompt EXPLICITLY states something should NOT be done.

## 6. CONSISTENCY
- Always use the same terminology across all criteria
- Use exact label, folder, or field names as they appear in the prompt
- ALWAYS use Name <email> format for all person references

# PERSON IDENTIFICATION FORMAT

ALWAYS use: Name <email> format when referring to people.

CORRECT:
- Alexandra Dixon <ale.dixon@company.com>
- Amanda Matthews <amanda.matthews@company.com>
- You <you@example.com>
- Brandy Mcgee <brandy.mcgee@company.com>

INCORRECT (NEVER USE):
- Alexandra Dixon
- ale.dixon@company.com
- just name or just email

# REQUEST TYPES

## 7.1 Single-Message Requests
Actions on a specific email identified by subject, sender, and recipient.

Example:
Prompt Request: Amanda Matthews is really important for me and I need you to mark her email sent to me with the subject "Quarterly results" as important.

Rubric: Marks email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> as important
Grading Function: Email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> is marked as important.

## 7.2 Bulk (Multi-Message) Requests
Actions on multiple emails that meet a common condition.

**CRITICAL SPLITTING RULE**: When a prompt requests the same action on multiple different subjects/conditions (joined by commas or "and"), create SEPARATE rubrics for each condition.

Example:
Prompt Request: I need to organize my inbox. Add the "work" label to all messages with the following subjects: "Project update", "Invoice attached", and "Action required".

**Create THREE separate rubrics** (one per subject):

Rubric 1: Applies label work to all emails with subject "Project update".
Grading Function: Emails with subject "Project update" from Andre Poole <andre.poole@example.com> and Sarah Chen <sarah.chen@mail.test> to You <you@example.com> are labeled as work.

Rubric 2: Applies label work to all emails with subject "Invoice attached"
Grading Function: Emails with subject "Invoice attached" from Andre Poole <andre.poole@example.com> to You <you@example.com> are labeled as work.

Rubric 3: Applies label work to all emails with subject "Action required"
Grading Function: Emails with subject "Action required" from Mike Torres <mike.torres@corp.co> to You <you@example.com> are labeled as work

Key note: 
- In bulk requests, list all specific emails that meet the condition in the Grading Function
- Split non-atomic requests into separate rubrics: requests with multiple conditions joined by commas or "and" should be separated into individual atomic rubrics
- Do NOT split requests with "or" conditions

## 7.3 Sent Emails (Replies/Drafts/Forwards)
Always specify subject and body in separate criteria.

Example:
Prompt Request: Reply to Amanda Matthews with subject "Re: Quarterly results" and body: "Thank you for your efforts on the quarterly results."

**Create TWO rubrics** (subject + body):

Rubric for subject: Replies with subject "Re: Quarterly results" to email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com>
Grading Function: Email to Amanda Matthews <amanda.matthews@company.com> replying to "Quarterly results" has subject starting with "Re: Quarterly results" and is located in Sent

Rubric for body: Replies with body "Thank you for your efforts" to email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com>
Grading Function: Email to Amanda Matthews <amanda.matthews@company.com> replying to "Quarterly results" contains in the body "Thank you for your efforts" and is located in Sent

Note: Best practice is to specify the subject and body content in the prompt. For replies, the grading function should specify which email is being replied to for clarity.

# SPECIAL CASES

## 9.1 Dynamic Dates (Snooze)
Calculate the actual date based on the prompt context.

Example:
Prompt Request: Snooze the email from Casey Edwards until tomorrow.

Rubric: Snoozes email with subject "Action required" from Casey Edwards <casey.edwards@company.com> to You <you@example.com> until tomorrow
Grading Function: Email with subject "Action required" from Casey Edwards <casey.edwards@company.com> to You <you@example.com> is snoozed until 2023-11-16.

## 9.2 Bulk Requests with Single Result
If only one email meets the condition, write as a single-message request.

Example:
Prompt Request: Mark all emails from Thomas Brown as important.

Rubric: Marks as important emails from Thomas Brown <thomas.brown@corp.co> 
Grading Function: Email with subject "Re: Quick question" from Thomas Brown <thomas.brown@corp.co> to You <you@example.com> has label important 

Note: While this could be considered a bulk request, only one email meets the condition so it's written as a single-message request

# GRADING FUNCTION FORMAT

Grading functions MUST use natural language that describes observable email properties.

## Email Uniqueness Requirement
EVERY grading function MUST uniquely identify the target email using multiple identifiers:
- Subject (exact or pattern)
- From (Name <email> format)
- To (Name <email> format)
- Location when relevant (Inbox, Sent, Archive, Trash, etc.)

## Format Requirements:
- Plain English sentences - no asterisks, no parentheses
- Name <email> format for all person references
- Double quotes for subjects/content - "Quarterly Results" not Quarterly Results
- Combine conditions with "and" or "or"
- Be extremely specific - include all necessary context
- Observable outcomes - focus on final state

## Common Patterns:

### Location Check:
✓ Email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> is in Archive location
✓ Email to Alexandra Dixon <ale.dixon@company.com> replying to "Meeting follow-up" is in Sent location

### Property Check:
✓ Email with subject "Quarterly Results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> has label important
✓ Email with subject "Weekly Digest" from Boss Name <boss@company.com> to You <you@example.com> is starred
✓ Email with subject "Weekly Digest" from Boss Name <boss@company.com> to You <you@example.com> is marked as read

### Date/Time Check (Calculate exact dates from initial state):
✓ Email with subject "Weekly digest" from Ronald Griffin <ronald.griffin@corp.co> to You <you@example.com> is snoozed until 2023-11-16
❌ NOT: "is snoozed until tomorrow" (too vague!)

### Content Check:
✓ Email to Alexandra Dixon <ale.dixon@company.com> contains the text "Congratulations on your recent promotion" in the body
✓ Email to Manager <manager@company.com> contains the text "The project has been completed" in the body

### Subject Line Check:
✓ Email to Client Name <client@company.com> has subject starting with "Re: Invoice"
✓ Email to Team Lead <team@company.com> has subject containing "Meeting Reschedule"

### Bulk Operations:
✓ Emails with subject "Project update" from Andre Poole <andre.poole@example.com> and Sarah Chen <sarah.chen@mail.test> to You <you@example.com> are labeled as work
✓ Emails with subject "Shipping notice" from Jennifer Phillips <jennifer.phillips@startup.io>, "Quarterly results" from Andre Poole <andre.poole@company.com>, and "Event invitation" from Desiree York <desiree.york@corp.co> to You <you@example.com> are marked as unread

# PROHIBITED LANGUAGE (NEVER USE)

## Vague Terms:
❌ appropriate, correct, suitable, relevant, reasonable, optimal, good, comprehensive, general, effective, proper, robust, clean, efficient, maintainable, scalable, best practice, high-quality, well-designed, performant

## Hedging Terms:
❌ should, may, could, shall, might

## Subjective Quality Terms:
❌ professional tone, courteous language, clear communication, polite greeting, friendly, warm, cordial, respectful, thorough, detailed, succinct, concise, brief, eloquent, articulate, persuasive

# DIFFICULTY ESTIMATION

Estimate difficulty based on the TYPES OF TASKS in the prompt, NOT on point ratios.

## Easy Tasks:
- Send or forward emails
- Star/Unstar emails
- Label emails
- Mark as Important

## Medium Tasks:
- Sorting (e.g., anything with sorting dates, sorting an order of emails)
- Categorization (e.g., work emails as [Action Required] and personal emails as [Action Not Required])
- Scaffolding (e.g., any task requiring multiple steps to reach a conclusion)

## Hard Tasks:
- Drafting an email with specific context
- Interpreting the contents of an email
- Calculations based on email content
- Summarizing the contents of an email with a recommended action

**Determine difficulty by analyzing which task types appear in the prompt, then assign:**
- "easy" - if only easy tasks
- "medium" - if medium tasks present
- "difficult" - if hard tasks present
- "too_easy" - if extremely trivial (1-2 simple actions)
- "too_difficult" - if impossible or requires capabilities beyond email management

# RUBRIC EXAMPLES

## EXAMPLE 1 - Hard Prompt (9 Rubrics)

**Prompt:** I need your urgent help. I need to clean up my inbox and it's crucial to do that as soon as possible. First of all, mark the email called 'Quarterly Results' from Amanda Matthews as important and reply to it with subject 'Re: Quarterly Results' and body: 'Hi Amanda, Thank you so much for your efforts on the quarterly results. I really appreciate the thorough analysis and timely delivery. Best regards.' Then, label the email with subject line 'Project update' from Brandy Mcgee as important and star it. You'll find another 'Project update' email from Renee Mahoney, move that one to trash. After that, snooze the email from casey.edwards@company.com until tomorrow. Finally, there's an email called 'Weekly Digest' from Ronald Griffin, please label it under personal.

**Rubrics Generated (9 total):**

1. Marks email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> as important
   Weight: 15 points (Required)
   Grading Function: Email with subject "Quarterly results" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> is marked as important

2. Replies with subject "Re: Quarterly results" to email from Amanda Matthews <amanda.matthews@company.com> with subject "Quarterly results"
   Weight: 15 points (Required)
   Grading Function: Email to Amanda Matthews <amanda.matthews@company.com> replying to "Quarterly results" has subject starting with "Re: Quarterly results" and is located in Sent

3. Replies with body "Thank you for your efforts on the quarterly results." to email from Amanda Matthews <amanda.matthews@company.com> with subject "Quarterly results"
   Weight: 15 points (Required)
   Grading Function: Email to Amanda Matthews <amanda.matthews@company.com> replying to "Quarterly results" has in the body "Hi Amanda, Thank you so much for your efforts on the quarterly results. I really appreciate the thorough analysis and timely delivery. Best regards." and is located in Sent

4. Applies label important to email with subject "Project update" from Brandy Mcgee <brandy.mcgee@corp.co> to You <you@example.com>
   Weight: 12 points (Required)
   Grading Function: Email with subject "Project update" from Brandy Mcgee <brandy.mcgee@corp.co> to You <you@example.com> has label important

5. Stars email with subject "Project update" from Brandy Mcgee <brandy.mcgee@corp.co> to You <you@example.com>
   Weight: 12 points (Required)
   Grading Function: Email with subject "Project update" from Brandy Mcgee <brandy.mcgee@corp.co> to You <you@example.com> is starred

6. Moves email with subject "Project update" from Renee Mahoney <renee.mahoney@mail.test> to You <you@example.com> to Trash location
   Weight: 12 points (Required)
   Grading Function: Email with subject "Project update" from Renee Mahoney <renee.mahoney@mail.test> to You <you@example.com> is in Trash location

7. Snoozes email with subject "Action required" from Casey Edwards <casey.edwards@company.com> to You <you@example.com> until tomorrow
   Weight: 12 points (Required)
   Grading Function: Email with subject "Action required" from Casey Edwards <casey.edwards@company.com> to You <you@example.com> is snoozed until 2023-11-16

8. Applies label personal to email with subject "Weekly digest" from Ronald Griffin <ronald.griffin@corp.co> to You <you@example.com>
   Weight: 12 points (Required)
   Grading Function: Email with subject "Weekly digest" from Ronald Griffin <ronald.griffin@corp.co> to You <you@example.com> has label personal

9. Does not modify email with subject "Weekly digest" from Meagan Coleman <meagan.coleman@startup.io> to You <you@example.com>
   Weight: 5 points (Non-Required)
   Grading Function: Email with subject "Weekly digest" from Meagan Coleman <meagan.coleman@startup.io> to You <you@example.com> is in INBOX location and does not have label personal

## EXAMPLE 2 - Medium Prompt (5 Rubrics, demonstrating bulk splitting)

**Prompt:** My inbox is getting a bit hectic. Let's try to organize it and take care of anyone we need to. First, reply to Lance Jackson<lance.jackson@startup.io> with subject "Re: Meeting follow-up" and body: "Roger that, sir, here is the update." Next, add the "work" label to all messages with the following subjects: "Project update", "Invoice attached", "Action required", "Weekly digest", "Quarterly results".

**Rubrics Generated (5 total - note the bulk requests are SPLIT):**

1. Replies with subject "Re: Meeting follow-up" to email from Lance Jackson <lance.jackson@startup.io>
   Weight: 20 points (Required)
   Grading Function: Email to Lance Jackson <lance.jackson@startup.io> replying to "Meeting follow-up" has subject "Re: Meeting follow-up" in Sent location

2. Replies with body "Roger that, sir, here is the update." to email from Lance Jackson <lance.jackson@startup.io>
   Weight: 20 points (Required)
   Grading Function: Email to Lance Jackson <lance.jackson@startup.io> replying to "Meeting follow-up" contains in the body "Roger that, sir, here is the update." and is located in Sent

3. Applies label work to all emails with subject "Project update"
   Weight: 15 points (Required)
   Grading Function: Emails with subject "Project update" from Andre Poole <andre.poole@example.com> and Sarah Chen <sarah.chen@mail.test> to You <you@example.com> are labeled as work

4. Applies label work to all emails with subject "Invoice attached"
   Weight: 15 points (Required)
   Grading Function: Emails with subject "Invoice attached" from Andre Poole <andre.poole@example.com> to You <you@example.com> are labeled as work

5. Applies label work to all emails with subject "Action required"
   Weight: 15 points (Required)
   Grading Function: Emails with subject "Action required" from Mike Torres <mike.torres@corp.co> to You <you@example.com> are labeled as work

## EXAMPLE 3 - Hard Prompt (8 Rubrics)

**Prompt:** I have OCD and when I see my inbox unorganized like that it bothers me so much. Help me organize it please. First, move emails with subject 'Welcome!' from Benjamin, 'Weekly digest' from David Kim, and all emails from Anthony Lambert to trash. Reply to the last email from Sherri Moran stating "Thank you for keeping me updated." Mark the most recent 4 emails in inbox as unread as I mistakenly marked them open but I still didn't see them. Label emails from thomas.brown@corp.co as important and emails from Andrea Kennedy as personal so they don't cause a mess in my inbox. Finally, star emails with subject 'Quarterly Results' as I want to be able to access them quickly.

**Rubrics Generated (8 total):**

1. Moves email with subject "Welcome!" from Benjamin Perkins <benjamin.perkins@example.com> to You <you@example.com> to Trash location
   Weight: 10 points (Required)
   Grading Function: Email with subject "Welcome!" from Benjamin Perkins <benjamin.perkins@example.com> to You <you@example.com> is in Trash location

2. Moves email with subject "Weekly digest" from David Kim <david.kim@company.com> to You <you@example.com> to Trash location
   Weight: 10 points (Required)
   Grading Function: Email with subject "Weekly digest" from David Kim <david.kim@company.com> to You <you@example.com> is in Trash location

3. Moves all emails from Anthony Lambert <anthony.lambert@startup.io> to You <you@example.com> to Trash location
   Weight: 10 points (Required)
   Grading Function: Email with subject "Your order confirmation" from Anthony Lambert <anthony.lambert@startup.io> to You <you@example.com> is in Trash location

4. Replies to Sherri Moran <sherri.moran@mail.test> with body "Thank you for keeping me updated."
   Weight: 15 points (Required)
   Grading Function: Email to Sherri Moran <sherri.moran@mail.test> contains the body "Thank you for keeping me updated." is in Sent location

5. Marks as unread the 4 most recent emails in Inbox
   Weight: 8 points (Required)
   Grading Function: Emails with subject "Shipping notice" from Jennifer Phillips <jennifer.phillips@startup.io> to You <you@example.com>, "Quarterly results" from Andre Poole <andre.poole@company.com> to You <you@example.com>, and "Event invitation" from Desiree York <desiree.york@corp.co> to You <you@example.com> are marked as unread

6. Marks as important emails from Thomas Brown <thomas.brown@corp.co>
   Weight: 8 points (Required)
   Grading Function: Email with subject "Re: Quick question" from Thomas Brown <thomas.brown@corp.co> to You <you@example.com> has label important

7. Marks as important emails from Andrea Kennedy <andrea.kennedy@mail.test>
   Weight: 8 points (Required)
   Grading Function: Email with subject "Event invitation" from Andrea Kennedy <andrea.kennedy@mail.test> to You <you@example.com> has label personal

8. Stars emails with subject "Quarterly Results"
   Weight: 8 points (Required)
   Grading Function: Email with subject "Quarterly results" from Andre Poole <andre.poole@company.com> to You <you@example.com> is starred

# VERIFICATION CHECKLIST

Before finalizing rubrics, verify:

## ✅ ATOMICITY (100% compliance)
- [ ] Each rubric tests exactly ONE aspect
- [ ] No "and" combinations in criteria (split them into separate rubrics)
- [ ] Cannot be partially correct
- [ ] Single pass/fail criterion
- [ ] Bulk requests with multiple subjects are SPLIT into separate rubrics

## ✅ SPECIFICITY (100% compliance)
- [ ] References specific prompt requirements
- [ ] Specifies exact values or formats
- [ ] Uses double quotes for all subjects and content
- [ ] Includes Name <email> format for all people

## ✅ SELF-CONTAINMENT
- [ ] Understandable without reading other rubrics or the original prompt
- [ ] Includes all necessary context
- [ ] Doesn't use ambiguous references
- [ ] No vague terms (appropriate, correct, proper, etc.)

## ✅ OBJECTIVITY
- [ ] 100% objectively verifiable
- [ ] No subjective quality judgments
- [ ] No prohibited language (professional, polite, clear, etc.)
- [ ] Verifiable by checking exact text, labels, locations, or properties

## ✅ COVERAGE
- [ ] All prompt requirements have corresponding rubrics
- [ ] Reply/draft tasks have TWO rubrics (subject + body)
- [ ] Bulk requests split atomically when needed
- [ ] Dynamic dates calculated to exact values

# OUTPUT FORMAT

Respond with ONLY valid JSON (no markdown, no explanations):

{
  "rubrics": [
    {
      "criterion": "Marks email with subject \"Quarterly results\" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> as important",
      "weight": 15,
      "required": true,
      "gradingFunction": "Email with subject \"Quarterly results\" from Amanda Matthews <amanda.matthews@company.com> to You <you@example.com> is marked as important"
    }
  ],
  "totalPoints": 100,
  "requiredPoints": 90,
  "nonRequiredPoints": 10,
  "criteriaCount": 8,
  "difficultyEstimate": "medium"
}

# FINAL REMINDERS

Before generating rubrics, remember:

✓ **ATOMICITY IS GOLDEN**: Each rubric tests exactly ONE aspect. Split "and" combinations.
✓ **START WITH VERBS**: Criterion format = [VERB] + [object] + [context]
✓ **BE SPECIFIC**: Use exact subjects, body text, labels - no vague terms
✓ **USE DOUBLE QUOTES**: For all subjects and content ("Quarterly Results")
✓ **NAME <EMAIL> FORMAT**: Always include email addresses for people
✓ **SPLIT BULK REQUESTS**: Multiple subjects → multiple rubrics
✓ **TWO RUBRICS FOR REPLIES**: Subject + Body (separate rubrics)
✓ **NO PROHIBITED LANGUAGE**: No "appropriate", "professional", "correct", "should", etc.
✓ **100% OBJECTIVE**: Verifiable by checking exact text, labels, locations
✓ **CALCULATE EXACT DATES**: Convert "tomorrow" to "2023-11-16" using initial state
✓ **DIFFICULTY BY TASK TYPE**: Easy (label/star), Medium (sort/categorize), Hard (draft with context)

🚫 **NEVER CREATE**:
- "Sends reply to [Name <email>]" without specific subject and body
- Rubrics starting with nouns ("Email to...", "The agent...")
- Subjective quality judgments
- Trivial punctuation or formatting checks
- Generic negative criteria unless explicitly requested

✅ **ALWAYS CREATE**:
- Self-contained rubrics understandable without reading the prompt
- Specific, atomic, objective criteria
- Separate rubrics for each bulk condition
- Subject + body rubrics for all replies/drafts

Now analyze the provided INITIAL JSON STATE and USER PROMPT to generate comprehensive, atomic rubrics.`;

async function generateWithClaude(inlineDiff: string, prompt: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
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
        role: 'user',
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

  if (message.content[0].type === 'text') {
    let responseText = message.content[0].text;

    // Clean up markdown code blocks if present
    responseText = responseText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

    try {
      const parsed = JSON.parse(responseText);
      return parsed;
    } catch (parseError: any) {
      console.error('Failed to parse Claude response:', parseError);
      throw new Error(`Failed to parse response: ${parseError.message}`);
    }
  }

  throw new Error('No text content in Claude response');
}

async function generateWithOpenAI(inlineDiff: string, prompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4-turbo-preview';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
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
        role: 'system',
        content: RUBRICS_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: `# INITIAL JSON STATE
\`\`\`json
${initialJSON}
\`\`\`

# USER PROMPT
"${prompt.replace(/"/g, '\\"')}"

Generate the rubrics now (JSON only):`,
      },
    ],
    max_tokens: 8000,
    temperature: 0.7,
    response_format: { type: "json_object" },
  });

  const responseText = completion.choices[0].message.content || '';

  try {
    const parsed = JSON.parse(responseText);
    return parsed;
  } catch (parseError: any) {
    console.error('Failed to parse OpenAI response:', parseError);
    throw new Error(`Failed to parse response: ${parseError.message}`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { inlineDiff, prompt } = await request.json();

    console.log('=== RUBRICS CREATE REQUEST ===');
    console.log('Inline diff length:', inlineDiff?.length || 0);
    console.log('Prompt length:', prompt?.length || 0);
    console.log('Provider:', process.env.AI_PROVIDER || 'claude');
    console.log('=== END REQUEST ===');

    if (!inlineDiff || !prompt) {
      return NextResponse.json(
        { error: 'Inline diff and prompt are required' },
        { status: 400 }
      );
    }

    const provider = process.env.AI_PROVIDER || 'claude';

    let result;
    if (provider === 'openai') {
      result = await generateWithOpenAI(inlineDiff, prompt);
    } else if (provider === 'claude') {
      result = await generateWithClaude(inlineDiff, prompt);
    } else {
      return NextResponse.json(
        { error: 'Invalid AI_PROVIDER configuration. Must be "openai" or "claude"' },
        { status: 500 }
      );
    }

    console.log('=== RUBRICS CREATE SUCCESS ===');
    console.log('Rubrics count:', result.rubrics?.length || 0);
    console.log('Total points:', result.totalPoints || 0);
    console.log('=== END SUCCESS ===');

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('=== RUBRICS CREATE ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');

    return NextResponse.json(
      { error: error.message || 'Failed to generate rubrics' },
      { status: 500 }
    );
  }
}
