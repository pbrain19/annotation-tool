import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const EVALUATION_PROMPT = (taskPrompt: string) => `You are evaluating the difficulty of an AI agent task based on the following criteria:

EASY:
1. Send or forward emails
2. Star/Unstar/Label/Mark as Important

MEDIUM:
1. Sorting (e.g., anything with sorting dates, sorting an order of emails)
2. Categorization (e.g., work emails as [Action Required] and personal emails as [Action Not Required])
3. Scaffolding (any task requiring multiple steps to reach a conclusion)

HARD:
1. Drafting an email with specific context
2. Interpreting the contents of an email
3. Calculations based on email content
4. Summarizing the contents of an email with a recommended action

# PROMPT QUALITY EVALUATION

You are also evaluating if this task prompt meets professional standards for a contractor to execute.

## CONTRACTOR TEST (Prompt Objectivity)
Imagine giving this prompt to an external contractor who will work on it independently:
- Can they complete it WITHOUT asking clarifying questions?
- Are ALL requirements explicitly stated?
- Is the prompt objective with ONLY the information provided?
- Could any part be interpreted differently?

## SPECIFICATION PREFERENCES
✅ PREFER: Overspecified prompts with detailed, comprehensive grading criteria
❌ AVOID: Underspecified prompts with vague, thesis-driven, or intuition-driven criteria
✅ PREFER: Specific problem-solving tasks
❌ AVOID: Generic or vague tasks

## MINOR ISSUES TO FLAG

1. **Language/Syntax Errors**: Typos, grammatical mistakes, spelling errors
   Example: ❌ "Plase review the attached docment for consistency."
            ✅ "Please review the attached document for consistency."

2. **Request Formatting Issues**: Should feel natural and conversational
   ❌ AVOID: Overly labeled or formulaic (reads like a technical specification)
   ❌ AVOID: Reading like a list of technical commands instead of a contextual request
   ✅ PREFER: Natural, conversational requests that sound like a real person asking

3. **Overuse of Lists/Commands**: The prompt reads like technical commands rather than a contextual request

4. **Minor Context Omissions**: The prompt could include one extra sentence for better realism but still functions

## MAJOR ISSUES: SUBJECTIVITY AND UNDERSPECIFICATION

### CRITICAL: Subjectivity is ONLY a problem when it affects the OUTCOME of email actions

**When subjectivity is a MAJOR ISSUE (affects outcome verification):**
❌ **Email Selection Criteria**: "urgent emails", "important messages", "relevant contacts" without explicit criteria
   - Problem: Cannot verify WHICH emails should be processed
   - Solution: Specify explicit criteria (sender, subject keywords, date ranges)

❌ **Content Requirements in Drafts/Replies/Emails**: "be concise", "be brief", "keep it short", "provide detailed explanation", vague content descriptions
   - Problem: Affects the CONTENT of the email itself (the outcome)
   - Solution: ALWAYS specify BOTH the exact subject line AND the exact email body content. Either provide them directly in the prompt or via a reference file

❌ **Action Criteria**: "appropriate label", "proper folder", "suitable response"
   - Problem: Cannot verify WHAT action was taken
   - Solution: Specify exact label name, folder name, or response criteria

**When subjectivity is NOT a major issue (does NOT affect outcome):**
✅ **General context/background**: "We've been having discussions about X", "The team is excited about Y"
   - This is just context, doesn't affect which emails to process or what to do with them

✅ **Style directives that don't affect verifiable outcome**: "be professional", "sound enthusiastic" ONLY when:
   - The email is simply being forwarded/archived/labeled (action is verifiable regardless of tone)
   - Specific content is already provided separately

### UNDERSPECIFICATION ISSUES

**Missing Information that prevents task reproduction:**
❌ Missing recipient email addresses for draft/reply/send actions
❌ Missing subject line for draft/reply/send actions (CRITICAL - always required)
❌ Missing email body content for draft/reply/send actions (CRITICAL - always required)
❌ Missing subject line or subject pattern for email selection
❌ Undefined conditions/criteria for categorization or filtering

**CRITICAL RULE for Draft/Reply/Email Tasks:**
Whenever the prompt involves creating, drafting, replying to, or sending an email, the correctedPrompt MUST include:
1. **Exact Subject Line**: Specify the complete subject line, e.g., "Subject: Q4 Budget Review Meeting"
2. **Exact Email Body**: Provide the full email content, either inline or specify it should come from a reference file

Example transformation:
- ❌ BAD: "Draft a reply to John about the meeting being brief and professional"
- ✅ GOOD: "Draft a reply to john@company.com with subject 'Re: Meeting Confirmation' and body: 'Hi John, Thanks for reaching out. I confirm the meeting on Tuesday at 3 PM in Conference Room B. Looking forward to it. Best, [Your name]'"

**Advice in correctedPrompt:**
When you detect a draft/reply/email task without specific content, your correctedPrompt should ADD placeholder text showing exactly what needs to be specified. Use this format:
"[Original task] with subject '[SPECIFY EXACT SUBJECT]' and email content: '[SPECIFY EXACT EMAIL BODY - what you want to say about X, Y, Z]'"

Analyze the following task prompt and determine its difficulty level. Additionally, provide comprehensive feedback on:
1. Difficulty Level
2. Grammar and Spelling
3. Minor Issues (language, formatting, context)
4. Major Issues (objectivity and specification)

IMPORTANT: Write all feedback in PROSE format, as if you were having a friendly conversation with the user. Be concise and direct. Use complete sentences and natural language, NOT bullet points or lists. Make it feel human and personalized.

IMPORTANT: The correctedPrompt field serves TWO purposes:
1. Fix grammar and spelling errors (typos, punctuation, verb tense)
2. Remove subjectivity that affects outcome verification (as defined in MAJOR ISSUES section above)

When creating correctedPrompt:
- Fix all grammar/spelling mistakes
- Remove or replace subjective terms that affect outcome (e.g., "urgent emails" → "emails from X with subject containing Y")
- Keep subjective context/background that doesn't affect outcome (it's fine to keep)
- For draft/reply/email tasks: ADD the exact subject line and email body content (see CRITICAL RULE above)
- Maintain the original structure and intent
- Make MINIMAL changes - only fix what's necessary

Respond ONLY with a valid JSON object in this exact format:

{
  "difficulty": "Easy" | "Medium" | "Hard",
  "reasoning": "Brief explanation of why this task falls into this difficulty category",
  "matchedCriteria": ["List of specific criteria from above that match this task"],
  "spellingFeedback": {
    "hasErrors": true | false,
    "errors": ["List of spelling/grammar errors found with corrections, e.g., 'emmails -> emails'. Empty array if no errors"],
    "message": "Write a concise message (1-2 sentences) about the spelling/grammar quality. If there are errors, be kind while pointing them out. If perfect, give a brief compliment.",
    "correctedPrompt": "REQUIRED FIELD. The complete original prompt with: (1) spelling and grammar errors fixed (typos, missing commas, verb tense, articles, punctuation), (2) outcome-affecting subjectivity removed or replaced with objective alternatives, AND (3) for draft/reply/email tasks, ADD exact subject line and email body content. Keep: formatting style, context/background that doesn't affect outcome, original structure. Example: 'Draft brief reply to John about meeting' → 'Draft a reply to john@company.com with subject \"Re: Meeting Confirmation\" and body: \"Hi John, I confirm the meeting on Tuesday at 3 PM. Best regards.\"'"
  },
  "minorIssues": {
    "hasIssues": true | false,
    "languageErrors": ["Array of typos/grammar errors with corrections, e.g., 'Typo: emmails -> emails', 'Grammar: missing comma after introductory phrase'"],
    "formattingIssues": ["Array of formatting problems, e.g., 'Too formulaic - reads like a command list', 'Overly technical language instead of natural request'"],
    "contextOmissions": ["Array of missing context, e.g., 'Could mention why this organization is needed', 'Adding context about urgency would improve realism'"],
    "expertFeedback": "MAXIMUM TWO SENTENCES. Write exactly 1-2 concise sentences explaining what minor issues were found and how to improve them. Be direct and actionable. If no issues, leave empty string."
  },
  "majorIssues": {
    "promptNotObjective": {
      "hasIssue": true | false,
      "examples": ["Array of specific outcome-affecting subjective phrases from the prompt with explanations. Format: 'QUOTED PHRASE from prompt - Why it affects outcome'. Example: 'urgent emails - Cannot verify WHICH emails to process without explicit criteria', 'be concise in reply - Affects the CONTENT outcome of the email itself'"],
      "expertFeedback": "MAXIMUM THREE SENTENCES. Be EXTREMELY specific and actionable. Format: 'Change \"[exact quoted phrase]\" to \"[specific objective replacement]\". [Additional specific instruction if needed]. [Reference file suggestion if applicable].' Example: 'Change \"urgent emails\" to \"emails from boss@company.com with subject containing Budget\". This makes the selection criteria objectively verifiable.' OR 'For the draft instruction \"be concise about the meeting\", create a reference file with the exact email content you want sent instead of using subjective directives.'"
    },
    "promptUnderspecified": {
      "hasIssue": true | false,
      "missingInfo": ["Array of essential missing information with specific examples. Format: 'What is missing - Example of what to add'. Example: 'Subject line missing - Add: with subject \"Q4 Budget Review\"', 'Email body content missing - Add: and body: \"[exact email content]\"', 'Recipient email address - Specify to: john@company.com', 'Email selection criteria - Add: from sender@company.com with subject containing Project'"],
      "expertFeedback": "MAXIMUM THREE SENTENCES. Be EXTREMELY specific and actionable. Format: 'Add [specific information] to [location in prompt]. [Concrete example]. [Additional instruction if needed].' For draft/reply/email tasks, ALWAYS mention: 'Add the exact subject line: \"[example subject]\" and the exact email body content: \"[example content]\". This ensures the email content is objectively verifiable.' For other tasks: 'Add the recipient email address after \"send to contacts\". For example: \"send to john@company.com, jane@company.com\".'"
    }
  }
}

## CRITICAL JSON FORMATTING RULES:
- YOU MUST RESPOND WITH VALID JSON - NO EXCEPTIONS
- DO NOT include any text outside the JSON object
- DO NOT use markdown code blocks (no \`\`\`json or \`\`\`)
- DO NOT add any explanations, preambles, or commentary outside the JSON
- ALWAYS escape double quotes inside strings using backslash (\")
- DO NOT use unescaped newlines inside strings - use \\n instead
- Ensure all strings are properly closed with quotes
- Your entire response must be parseable by JSON.parse()
- Start your response with { and end with }
- Test that your response is valid JSON before returning it

Task prompt to evaluate:
"${taskPrompt.replace(/"/g, '\\"')}"`;

async function evaluateWithClaude(prompt: string): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  const message = await anthropic.messages.create({
    model: model,
    max_tokens: 4000, // Increased from 1500 to handle long prompts and detailed feedback
    messages: [
      {
        role: 'user',
        content: EVALUATION_PROMPT(prompt),
      },
    ],
  });

  let responseText = '';
  if (message.content[0].type === 'text') {
    responseText = message.content[0].text;
  }

  console.log('=== CLAUDE RAW RESPONSE ===');
  console.log(responseText);
  console.log('=== END RAW RESPONSE ===');

  // Strip markdown code blocks if present
  responseText = responseText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  console.log('=== CLEANED RESPONSE ===');
  console.log(responseText);
  console.log('Response ends with:', responseText.slice(-50));
  
  // Check if response might be truncated
  if (!responseText.trim().endsWith('}')) {
    console.warn('⚠️ WARNING: Response does not end with }. Might be truncated due to max_tokens limit!');
    console.warn('Consider increasing max_tokens in Claude config');
  }
  console.log('=== END CLEANED RESPONSE ===');

  try {
    return JSON.parse(responseText);
  } catch (parseError: any) {
    console.error('=== JSON PARSE ERROR ===');
    console.error('Error message:', parseError.message);
    console.error('Error position:', parseError.message.match(/position (\d+)/)?.[1]);
    console.error('Response length:', responseText.length);
    
    // Show context around the error
    const match = parseError.message.match(/position (\d+)/);
    if (match) {
      const pos = parseInt(match[1]);
      const start = Math.max(0, pos - 100);
      const end = Math.min(responseText.length, pos + 100);
      console.error('Context around error:');
      console.error(responseText.substring(start, end));
      console.error(' '.repeat(Math.min(100, pos - start)) + '^');
    }
    console.error('=== END JSON PARSE ERROR ===');
    
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. Check server logs for details.`);
  }
}

async function evaluateWithOpenAI(prompt: string): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const promptText = EVALUATION_PROMPT(prompt);
  console.log('=== OPENAI REQUEST INFO (Responses) ===');
  console.log('Model:', model);
  console.log('Prompt length:', promptText.length);
  console.log('=== END REQUEST INFO ===');

  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 10000);
  let response;
  try {
    response = await openai.responses.create({
      model: model,
      reasoning: { effort: 'medium' },
      input: promptText,
      max_output_tokens: maxOutputTokens,
    });
  } catch (apiError: any) {
    console.error('=== OPENAI RESPONSES API ERROR ===');
    console.error('Error type:', apiError.constructor?.name);
    console.error('Error message:', apiError.message);
    console.error('Error code:', apiError.code);
    console.error('Error status:', apiError.status);
    console.error('Full error:', JSON.stringify(apiError, null, 2));
    console.error('=== END API ERROR ===');
    throw apiError;
  }

  const respAny = response as any;
  if (respAny.status === 'incomplete' && respAny.incomplete_details?.reason === 'max_output_tokens') {
    console.error('=== OPENAI INCOMPLETE RESPONSE ===');
    console.error('Reason: max_output_tokens');
    console.error('Configured max_output_tokens:', maxOutputTokens);
    console.error('Consider increasing OPENAI_MAX_OUTPUT_TOKENS or reducing output size');
    throw new Error(`OpenAI response incomplete due to max_output_tokens (${maxOutputTokens}). Increase the limit or reduce output size.`);
  }

  let responseText = (response as any).output_text as string | undefined;
  if (!responseText || responseText.trim().length === 0) {
    try {
      const parts = (response as any).output || [];
      responseText = parts
        .flatMap((p: any) => p.content || [])
        .map((c: any) => c.text?.value || c.text || '')
        .join('')
        .trim();
    } catch {
      // ignore
    }
  }

  console.log('=== OPENAI RAW RESPONSE (Evaluate via Responses) ===');
  console.log(responseText || '[empty]');
  console.log('=== END RAW RESPONSE ===');

  if (!responseText || responseText.trim().length === 0) {
    console.error('=== EMPTY RESPONSE ERROR ===');
    console.error('OpenAI Responses returned an empty response!');
    console.error('Current model:', model);
    console.error('=== END EMPTY RESPONSE ERROR ===');
    throw new Error(`OpenAI returned an empty response. Check server logs for details. Model: ${model}`);
  }

  responseText = responseText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  try {
    return JSON.parse(responseText);
  } catch (parseError: any) {
    console.error('=== JSON PARSE ERROR ===');
    console.error('Error message:', parseError.message);
    console.error('Response length:', responseText.length);
    console.error('Preview:', responseText.slice(0, 200));
    throw new Error(`Failed to parse AI response as JSON: ${parseError.message}. Check server logs for details.`);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { prompt } = await request.json();

    console.log('=== EVALUATE REQUEST ===');
    console.log('Prompt length:', prompt?.length || 0);
    console.log('Provider:', process.env.AI_PROVIDER || 'claude');
    console.log('=== END REQUEST ===');

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const provider = process.env.AI_PROVIDER || 'claude';

    let result;
    if (provider === 'openai') {
      result = await evaluateWithOpenAI(prompt);
    } else if (provider === 'claude') {
      result = await evaluateWithClaude(prompt);
    } else {
      return NextResponse.json(
        { error: 'Invalid AI_PROVIDER configuration. Must be "openai" or "claude"' },
        { status: 500 }
      );
    }

    console.log('=== EVALUATE SUCCESS ===');
    console.log('Result keys:', Object.keys(result));
    console.log('=== END SUCCESS ===');

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('=== EVALUATE ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');
    
    return NextResponse.json(
      { error: error.message || 'Failed to evaluate difficulty' },
      { status: 500 }
    );
  }
}

