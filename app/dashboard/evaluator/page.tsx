'use client';

import { useState } from 'react';
import { AlertCircle, CheckCircle, SpellCheck, XCircle, AlertTriangle, Mail, Copy, Check } from 'lucide-react';

interface EvaluationResult {
  difficulty: 'Easy' | 'Medium' | 'Hard';
  reasoning: string;
  matchedCriteria: string[];
  spellingFeedback?: {
    hasErrors: boolean;
    errors: string[];
    message: string;
    correctedPrompt?: string;
  };
  minorIssues?: {
    hasIssues: boolean;
    languageErrors: string[];
    formattingIssues: string[];
    contextOmissions: string[];
    expertFeedback: string;
  };
  majorIssues?: {
    promptNotObjective: {
      hasIssue: boolean;
      examples: string[];
      expertFeedback: string;
    };
    promptUnderspecified: {
      hasIssue: boolean;
      missingInfo: string[];
      expertFeedback: string;
    };
  };
}

export default function DifficultyEvaluator() {
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<EvaluationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedMinor, setCopiedMinor] = useState(false);
  const [copiedNotObjective, setCopiedNotObjective] = useState(false);
  const [copiedUnderspecified, setCopiedUnderspecified] = useState(false);
  const [copiedCorrectedPrompt, setCopiedCorrectedPrompt] = useState(false);

  const evaluateDifficulty = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt to evaluate');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/evaluate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
    } catch (err: any) {
      console.error('Error evaluating difficulty:', err);
      setError(err.message || 'Failed to evaluate difficulty. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy':
        return 'bg-green-900/20 text-green-400 border-green-500';
      case 'Medium':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-500';
      case 'Hard':
        return 'bg-red-900/20 text-red-400 border-red-500';
      default:
        return 'bg-zinc-900/20 text-zinc-400 border-zinc-600';
    }
  };

  const copyFeedback = async (text: string, setter: (val: boolean) => void) => {
    try {
      await navigator.clipboard.writeText(text);
      setter(true);
      setTimeout(() => setter(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-3xl mx-auto">
        <div className="bg-zinc-800/50 rounded-xl shadow-2xl p-8 border border-zinc-700">
          <div className="flex items-center gap-3 mb-6">
            <Mail className="w-8 h-8 text-indigo-400" />
            <h1 className="text-3xl font-bold text-white">
              AI Project Difficulty Evaluator
            </h1>
          </div>

          <p className="text-zinc-400 mb-6">
            Enter a task description and the AI will evaluate its complexity based on predefined difficulty criteria.
          </p>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2">
              Task Prompt
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Sort all emails from last week by date and categorize them as urgent or non-urgent..."
              className="w-full h-32 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none transition-colors"
            />
          </div>

          <button
            onClick={evaluateDifficulty}
            disabled={loading || !prompt.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Evaluating...
              </>
            ) : (
              'Evaluate Difficulty'
            )}
          </button>

          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300 flex items-start gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              {/* 1. Corrected Prompt (Grammar + Objectivity) */}
              {result.spellingFeedback && (
                <div className={`p-6 rounded-lg border-2 ${
                  result.spellingFeedback.hasErrors
                    ? 'bg-blue-900/20 border-blue-600'
                    : 'bg-green-900/20 border-green-600'
                }`}>
                  <div className="flex items-center gap-3 mb-4">
                    <SpellCheck className={`w-7 h-7 ${
                      result.spellingFeedback.hasErrors ? 'text-blue-400' : 'text-green-400'
                    }`} />
                    <h3 className={`text-2xl font-bold ${
                      result.spellingFeedback.hasErrors ? 'text-blue-300' : 'text-green-300'
                    }`}>
                      Corrected & Objective Version
                    </h3>
                  </div>
                  <p className={`mb-3 leading-relaxed ${
                    result.spellingFeedback.hasErrors ? 'text-blue-100' : 'text-green-100'
                  }`}>
                    {result.spellingFeedback.message}
                  </p>
                  {result.spellingFeedback.errors.length > 0 && (
                    <div className="mt-3 bg-blue-950/30 p-3 rounded-lg border border-blue-800">
                      <p className="text-blue-200 text-sm mb-2">Grammar fixes applied:</p>
                      <div className="space-y-1">
                        {result.spellingFeedback.errors.map((error, index) => (
                          <div key={index} className="text-blue-100 font-mono text-sm">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.spellingFeedback.correctedPrompt && (
                    <div className="mt-4 bg-zinc-950/50 p-4 rounded-lg border border-zinc-700">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-zinc-200 text-sm">Objective Prompt (Grammar Fixed + Subjectivity Removed):</h4>
                        <button
                          onClick={() => copyFeedback(result.spellingFeedback!.correctedPrompt!, setCopiedCorrectedPrompt)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors text-xs font-medium"
                          title="Copy corrected prompt"
                        >
                          {copiedCorrectedPrompt ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              Copied!
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              Copy
                            </>
                          )}
                        </button>
                      </div>
                      <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-wrap font-mono bg-zinc-900 p-3 rounded border border-zinc-800">
                        {result.spellingFeedback.correctedPrompt}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Difficulty */}
              <div className={`p-6 border-2 rounded-lg ${getDifficultyColor(result.difficulty)}`}>
                <div className="flex items-center gap-3 mb-3">
                  <CheckCircle className="w-7 h-7" />
                  <h2 className="text-2xl font-bold">
                    Difficulty: {result.difficulty}
                  </h2>
                </div>

                <div className="mt-4">
                  <h3 className="font-semibold mb-2 text-zinc-200">Reasoning:</h3>
                  <p className="leading-relaxed text-zinc-300">{result.reasoning}</p>
                </div>

                {result.matchedCriteria && result.matchedCriteria.length > 0 && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2 text-zinc-200">Matched Criteria:</h3>
                    <ul className="list-disc list-inside space-y-1 text-zinc-300">
                      {result.matchedCriteria.map((criteria, index) => (
                        <li key={index}>{criteria}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* 3. Minor Issues */}
              {result.minorIssues && result.minorIssues.hasIssues && result.minorIssues.expertFeedback && (
                <div className="p-6 rounded-lg border-2 bg-yellow-900/20 border-yellow-600">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertTriangle className="w-7 h-7 text-yellow-400" />
                    <h3 className="text-2xl font-bold text-yellow-300">
                      Minor Issues
                    </h3>
                  </div>

                  {/* All minor issues in one list */}
                  <div className="bg-yellow-950/30 p-4 rounded-lg border border-yellow-800 mb-3">
                    <ul className="space-y-2">
                      {result.minorIssues.languageErrors.map((error, index) => (
                        <li key={`lang-${index}`} className="text-yellow-100 text-sm flex items-start gap-2">
                          <span className="text-yellow-400 font-bold">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                      {result.minorIssues.formattingIssues.map((issue, index) => (
                        <li key={`format-${index}`} className="text-yellow-100 text-sm flex items-start gap-2">
                          <span className="text-yellow-400 font-bold">•</span>
                          <span>{issue}</span>
                        </li>
                      ))}
                      {result.minorIssues.contextOmissions.map((omission, index) => (
                        <li key={`context-${index}`} className="text-yellow-100 text-sm flex items-start gap-2">
                          <span className="text-yellow-400 font-bold">•</span>
                          <span>{omission}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Expert Feedback */}
                  <div className="bg-yellow-950/40 p-3 rounded-lg border border-yellow-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-1 text-yellow-200 text-xs">Expert Feedback:</h4>
                        <p className="text-yellow-50 text-xs leading-snug">
                          {result.minorIssues.expertFeedback}
                        </p>
                      </div>
                      <button
                        onClick={() => copyFeedback(result.minorIssues!.expertFeedback, setCopiedMinor)}
                        className="flex-shrink-0 p-1.5 hover:bg-yellow-800/30 rounded transition-colors"
                        title="Copy feedback"
                      >
                        {copiedMinor ? (
                          <Check className="w-3.5 h-3.5 text-yellow-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-yellow-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 4. Major Issue: Prompt Not Objective */}
              {result.majorIssues?.promptNotObjective.hasIssue && (
                <div className="p-6 rounded-lg border-2 bg-red-900/20 border-red-600">
                  <div className="flex items-center gap-3 mb-4">
                    <XCircle className="w-7 h-7 text-red-400" />
                    <h3 className="text-2xl font-bold text-red-300">
                      Major Issue: Outcome-Affecting Subjectivity
                    </h3>
                  </div>
                  <p className="text-red-200 text-sm mb-3">
                    The prompt contains subjective language that affects the OUTCOME of email actions. This prevents objective verification of what should be done. Note: Background context that doesn't affect which emails to process or what actions to take is fine.
                  </p>

                  {/* Examples */}
                  {result.majorIssues.promptNotObjective.examples.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-red-200">Subjective Phrases Affecting Outcome:</h4>
                      <ul className="space-y-2 bg-red-950/30 p-3 rounded-lg border border-red-800">
                        {result.majorIssues.promptNotObjective.examples.map((example, index) => (
                          <li key={index} className="text-red-100 text-sm leading-relaxed">
                            • {example}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expert Feedback */}
                  <div className="bg-red-950/40 p-3 rounded-lg border border-red-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2 text-red-200 text-sm">How to Fix (Copy This):</h4>
                        <p className="text-red-50 text-sm leading-relaxed whitespace-pre-wrap">
                          {result.majorIssues.promptNotObjective.expertFeedback}
                        </p>
                      </div>
                      <button
                        onClick={() => copyFeedback(result.majorIssues!.promptNotObjective.expertFeedback, setCopiedNotObjective)}
                        className="flex-shrink-0 p-1.5 hover:bg-red-800/30 rounded transition-colors"
                        title="Copy feedback"
                      >
                        {copiedNotObjective ? (
                          <Check className="w-3.5 h-3.5 text-red-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-red-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 5. Major Issue: Prompt Underspecified */}
              {result.majorIssues?.promptUnderspecified.hasIssue && (
                <div className="p-6 rounded-lg border-2 bg-orange-900/20 border-orange-600">
                  <div className="flex items-center gap-3 mb-4">
                    <AlertCircle className="w-7 h-7 text-orange-400" />
                    <h3 className="text-2xl font-bold text-orange-300">
                      Major Issue: Missing Essential Information
                    </h3>
                  </div>
                  <p className="text-orange-200 text-sm mb-3">
                    The prompt lacks essential information needed to reproduce the task. This includes missing recipients, email selection criteria, specific content for drafts/replies, or action parameters.
                  </p>

                  {/* Missing Info */}
                  {result.majorIssues.promptUnderspecified.missingInfo.length > 0 && (
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2 text-orange-200">What's Missing:</h4>
                      <ul className="space-y-2 bg-orange-950/30 p-3 rounded-lg border border-orange-800">
                        {result.majorIssues.promptUnderspecified.missingInfo.map((info, index) => (
                          <li key={index} className="text-orange-100 text-sm leading-relaxed">
                            • {info}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Expert Feedback */}
                  <div className="bg-orange-950/40 p-3 rounded-lg border border-orange-700">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <h4 className="font-semibold mb-2 text-orange-200 text-sm">How to Fix (Copy This):</h4>
                        <p className="text-orange-50 text-sm leading-relaxed whitespace-pre-wrap">
                          {result.majorIssues.promptUnderspecified.expertFeedback}
                        </p>
                      </div>
                      <button
                        onClick={() => copyFeedback(result.majorIssues!.promptUnderspecified.expertFeedback, setCopiedUnderspecified)}
                        className="flex-shrink-0 p-1.5 hover:bg-orange-800/30 rounded transition-colors"
                        title="Copy feedback"
                      >
                        {copiedUnderspecified ? (
                          <Check className="w-3.5 h-3.5 text-orange-300" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 text-orange-300" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Suggestions section removed per request */}

              <div className="bg-zinc-900/80 p-4 rounded-lg border border-zinc-700 transition-colors">
                <h3 className="font-semibold text-zinc-300 mb-2">Reference:</h3>
                <div className="text-sm text-zinc-400 space-y-2">
                  <div>
                    <span className="font-medium text-green-400">Easy:</span> Send/forward emails, Star/Label actions
                  </div>
                  <div>
                    <span className="font-medium text-yellow-400">Medium:</span> Sorting, Categorization, Multi-step tasks
                  </div>
                  <div>
                    <span className="font-medium text-red-400">Hard:</span> Drafting with context, Interpreting content, Calculations, Summarizing with recommendations
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

