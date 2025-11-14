import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

// Function to reconstruct initial JSON from inline diff (custom format without commas/quotes)
const reconstructInitialJSON = (inlineDiff: string): string => {
  // Parse the custom format by processing line by line
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

// Prompt 1: Generate Step-by-Step Actions from inline diff + prompt
const STEP_BY_STEP_PROMPT = (inlineDiff: string, prompt: string) => {
  // Reconstruct initial JSON
  const initialJSON = reconstructInitialJSON(inlineDiff);

  return `You are analyzing an email/thread state change task.

# OBJECTIVE
Given an initial JSON state and a prompt with instructions, generate a step-by-step checklist of actions to verify the task completion.

# INPUT DATA

**INITIAL JSON STATE**:
\`\`\`json
${initialJSON}
\`\`\`

**USER PROMPT/INSTRUCTIONS**: "${prompt.replace(/"/g, '\\"')}"

# TASK
Create a step-by-step checklist that breaks down the prompt into concrete, verifiable actions.

# RESPONSE FORMAT
Respond with ONLY this JSON (no markdown, no extra text):

{
  "stepByStep": [
    {
      "criterion": "Present tense action description",
      "searchQuery": "subject:\\"...\\" from:\\"...\\""
    }
  ]
}

**Requirements for stepByStep**:
- Use present simple verbs: Stars, Marks, Applies, Deletes, Archives, Replies, Forwards
- Include BOTH subject:"..." AND from:"..." in searchQuery
- For send/reply actions, include to:"..." and a message excerpt: message:"..."
- Be specific with thread identification (subject + sender)
- No explanatory comments, only clean actionable statements
- Each step must be verifiable as TRUE/FALSE in ~30 seconds

**JSON formatting**:
- Escape quotes with \\"
- No unescaped newlines (use \\n)
- Validate JSON before responding

Now analyze and provide the step-by-step checklist.`;
};

// Prompt 2: Generate Task Checklist with scores and evaluation
const TASK_CHECKLIST_PROMPT = (inlineDiff: string, prompt: string) => {
  return `You are an expert validator analyzing JSON state changes (email/thread data) to verify they follow given instructions.

# OBJECTIVE
Receive an inline JSON diff showing changes to state. Validate that ALL changes correctly implement the user's PROMPT/INSTRUCTIONS. Provide detailed scoring and evaluation.

# INPUT DATA

**JSON DIFF** (- = removed, + = added, no prefix = unchanged):
\`\`\`json
${inlineDiff}
\`\`\`

**USER INSTRUCTIONS**: "${prompt.replace(/"/g, '\\"')}"

# TASK
1. Break down the prompt into individual tasks
2. Check if each task was completed correctly
3. Score each change/task from 1-10 based on correctness
4. Provide an overall task evaluation

# RESPONSE FORMAT
Respond with ONLY this JSON (no markdown, no extra text):

{
  "isValid": true | false,
  "summary": {
    "correctItems": ["List of things done correctly"],
    "incorrectItems": ["List of things done wrong or missing"]
  },
  "taskEvaluation": "2-3 sentence evaluation of how well the task was performed overall",
  "tasksChecklist": [
    {
      "task": "Task extracted from prompt",
      "status": "completed" | "not_completed" | "partially_completed",
      "score": 1-10,
      "details": "What was found (use 'Subject' from 'sender@email.com' format)",
      "actionNeeded": "Required if not completed. Specific action: 'Star the thread \\"Weekend Plans\\" from \\"friend@email.com\\"'. Empty if completed."
    }
  ]
}

**Scoring Guidelines (1-10)**:
- 10: Perfect execution, exactly as requested
- 8-9: Excellent, minor issues
- 6-7: Good, some issues but mostly correct
- 4-5: Partial, significant issues
- 2-3: Poor, major problems
- 1: Failed or wrong

**Summary requirements**:
- correctItems: List ONLY items that were done perfectly (use checkmark-friendly format)
- incorrectItems: List ONLY items that were done wrong, partially, or missing

**tasksChecklist requirements**:
- Break prompt into ALL distinct tasks
- Assign a score 1-10 for each task
- For incomplete: actionNeeded MUST be specific with subject + sender
- Status reflects execution quality

**JSON formatting**:
- Escape quotes with \\"
- No unescaped newlines (use \\n)
- Validate JSON before responding

Now analyze and provide the validation response with scores.`;
};

async function validateWithClaude(inlineDiff: string, prompt: string): Promise<any> {
  const startTime = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514';

  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const anthropic = new Anthropic({
    apiKey: apiKey,
  });

  // Pricing per million tokens (as of 2025)
  const PRICING = {
    'claude-sonnet-4-20250514': { input: 3.00, output: 15.00 },
    'claude-sonnet-4-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20241022': { input: 3.00, output: 15.00 },
    'claude-3-5-sonnet-20240620': { input: 3.00, output: 15.00 },
    'claude-3-opus-20240229': { input: 15.00, output: 75.00 },
    'claude-sonnet-4-5-20250929': { input: 3.00, output: 15.00 },
  };

  const modelPricing = PRICING[model as keyof typeof PRICING] || { input: 3.00, output: 15.00 };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Call 1: Get step-by-step actions
  console.log('=== CLAUDE CALL 1: Step-by-Step ===');
  const stepByStepMessage = await anthropic.messages.create({
    model: model,
    max_tokens: 3500,
    messages: [
      {
        role: 'user',
        content: STEP_BY_STEP_PROMPT(inlineDiff, prompt),
      },
    ],
  });

  totalInputTokens += stepByStepMessage.usage.input_tokens;
  totalOutputTokens += stepByStepMessage.usage.output_tokens;

  let stepByStepText = '';
  if (stepByStepMessage.content[0].type === 'text') {
    stepByStepText = stepByStepMessage.content[0].text;
  }

  console.log('Step-by-step raw response:', stepByStepText);
  stepByStepText = stepByStepText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  let stepByStepData;
  try {
    stepByStepData = JSON.parse(stepByStepText);
  } catch (parseError: any) {
    console.error('Failed to parse step-by-step response:', parseError);
    throw new Error(`Failed to parse step-by-step response: ${parseError.message}`);
  }

  // Call 2: Get task checklist with scores
  console.log('=== CLAUDE CALL 2: Task Checklist ===');
  const taskChecklistMessage = await anthropic.messages.create({
    model: model,
    max_tokens: 3500,
    messages: [
      {
        role: 'user',
        content: TASK_CHECKLIST_PROMPT(inlineDiff, prompt),
      },
    ],
  });

  totalInputTokens += taskChecklistMessage.usage.input_tokens;
  totalOutputTokens += taskChecklistMessage.usage.output_tokens;

  let taskChecklistText = '';
  if (taskChecklistMessage.content[0].type === 'text') {
    taskChecklistText = taskChecklistMessage.content[0].text;
  }

  console.log('Task checklist raw response:', taskChecklistText);
  taskChecklistText = taskChecklistText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  let taskChecklistData;
  try {
    taskChecklistData = JSON.parse(taskChecklistText);
  } catch (parseError: any) {
    console.error('Failed to parse task checklist response:', parseError);
    throw new Error(`Failed to parse task checklist response: ${parseError.message}`);
  }

  const endTime = Date.now();
  const processingTimeMs = endTime - startTime;
  const processingTimeSec = (processingTimeMs / 1000).toFixed(2);

  // Calculate cost
  const inputCost = (totalInputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * modelPricing.output;
  const totalCost = inputCost + outputCost;

  // Merge both responses
  return {
    isValid: taskChecklistData.isValid,
    summary: taskChecklistData.summary,
    taskEvaluation: taskChecklistData.taskEvaluation,
    stepByStep: stepByStepData.stepByStep,
    tasksChecklist: taskChecklistData.tasksChecklist,
    metadata: {
      processingTimeMs,
      processingTimeSec: parseFloat(processingTimeSec),
      model,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      cost: {
        input: parseFloat(inputCost.toFixed(6)),
        output: parseFloat(outputCost.toFixed(6)),
        total: parseFloat(totalCost.toFixed(6)),
        currency: 'USD',
      },
    },
  };
}

async function validateWithOpenAI(inlineDiff: string, prompt: string): Promise<any> {
  const startTime = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-5';

  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  const openai = new OpenAI({
    apiKey: apiKey,
  });

  const maxOutputTokens = Number(process.env.OPENAI_MAX_OUTPUT_TOKENS || 50000);

  // Pricing per million tokens (as of 2025) - GPT-5 pricing TBD, using estimates
  const PRICING = {
    'gpt-5': { input: 1.25, output: 10.00 }, // Estimated pricing
  };

  const modelPricing = PRICING[model as keyof typeof PRICING] || { input: 10.00, output: 30.00 };

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // Call 1: Get step-by-step actions
  console.log('=== OPENAI CALL 1: Step-by-Step ===');
  const stepByStepResponse = await openai.responses.create({
    model: model,
    reasoning: { effort: 'medium' },
    input: STEP_BY_STEP_PROMPT(inlineDiff, prompt),
    max_output_tokens: maxOutputTokens,
  });
  console.log("stepByStepResponse", stepByStepResponse);

  // Extract token usage from response
  const stepUsage = (stepByStepResponse as any).usage;
  if (stepUsage) {
    totalInputTokens += stepUsage.input_tokens || 0;
    totalOutputTokens += stepUsage.output_tokens || 0;
  }

  let stepByStepText = (stepByStepResponse as any).output_text as string;
  if (!stepByStepText) {
    const parts = (stepByStepResponse as any).output || [];
    stepByStepText = parts
      .flatMap((p: any) => p.content || [])
      .map((c: any) => c.text?.value || c.text || '')
      .join('')
      .trim();
  }

  stepByStepText = stepByStepText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  let stepByStepData;
  try {
    stepByStepData = JSON.parse(stepByStepText);
  } catch (parseError: any) {
    throw new Error(`Failed to parse step-by-step response: ${parseError.message}`);
  }

  // Call 2: Get task checklist with scores
  console.log('=== OPENAI CALL 2: Task Checklist ===');
  const taskChecklistResponse = await openai.responses.create({
    model: model,
    reasoning: { effort: 'medium' },
    input: TASK_CHECKLIST_PROMPT(inlineDiff, prompt),
    max_output_tokens: maxOutputTokens,
  });
  console.log("taskChecklistResponse", taskChecklistResponse);

  // Extract token usage from response
  const taskUsage = (taskChecklistResponse as any).usage;
  if (taskUsage) {
    totalInputTokens += taskUsage.input_tokens || 0;
    totalOutputTokens += taskUsage.output_tokens || 0;
  }

  let taskChecklistText = (taskChecklistResponse as any).output_text as string;
  if (!taskChecklistText) {
    const parts = (taskChecklistResponse as any).output || [];
    taskChecklistText = parts
      .flatMap((p: any) => p.content || [])
      .map((c: any) => c.text?.value || c.text || '')
      .join('')
      .trim();
  }

  taskChecklistText = taskChecklistText.replace(/```json\s?/g, '').replace(/```\s?/g, '').trim();

  let taskChecklistData;
  try {
    taskChecklistData = JSON.parse(taskChecklistText);
  } catch (parseError: any) {
    throw new Error(`Failed to parse task checklist response: ${parseError.message}`);
  }

  const endTime = Date.now();
  const processingTimeMs = endTime - startTime;
  const processingTimeSec = (processingTimeMs / 1000).toFixed(2);

  // Calculate cost
  const inputCost = (totalInputTokens / 1_000_000) * modelPricing.input;
  const outputCost = (totalOutputTokens / 1_000_000) * modelPricing.output;
  const totalCost = inputCost + outputCost;

  // Merge both responses
  return {
    isValid: taskChecklistData.isValid,
    summary: taskChecklistData.summary,
    taskEvaluation: taskChecklistData.taskEvaluation,
    stepByStep: stepByStepData.stepByStep,
    tasksChecklist: taskChecklistData.tasksChecklist,
    metadata: {
      processingTimeMs,
      processingTimeSec: parseFloat(processingTimeSec),
      model,
      tokens: {
        input: totalInputTokens,
        output: totalOutputTokens,
        total: totalInputTokens + totalOutputTokens,
      },
      cost: {
        input: parseFloat(inputCost.toFixed(6)),
        output: parseFloat(outputCost.toFixed(6)),
        total: parseFloat(totalCost.toFixed(6)),
        currency: 'USD',
      },
    },
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { inlineDiff, prompt } = body;

    console.log('=== VALIDATE JSON V2 REQUEST ===');
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
      result = await validateWithOpenAI(inlineDiff, prompt);
    } else if (provider === 'claude') {
      result = await validateWithClaude(inlineDiff, prompt);
    } else {
      return NextResponse.json(
        { error: 'Invalid AI_PROVIDER configuration. Must be "openai" or "claude"' },
        { status: 500 }
      );
    }

    console.log('=== VALIDATE JSON V2 SUCCESS ===');
    console.log('Result keys:', Object.keys(result));
    console.log('isValid:', result.isValid);
    console.log('=== END SUCCESS ===');

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('=== VALIDATE JSON V2 ERROR ===');
    console.error('Error type:', error.constructor.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    console.error('=== END ERROR ===');

    return NextResponse.json(
      { error: error.message || 'Failed to validate JSON changes' },
      { status: 500 }
    );
  }
}
