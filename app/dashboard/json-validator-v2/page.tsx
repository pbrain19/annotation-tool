'use client';

import { useState } from 'react';
import { GitBranch, AlertCircle, CheckCircle, ArrowRight, ListChecks, CheckCircle2, XCircle, AlertTriangle, Copy, Star, Clock, DollarSign, Cpu } from 'lucide-react';

interface TaskChecklistItem {
  task: string;
  status: 'completed' | 'not_completed' | 'partially_completed';
  score: number; // 1-10
  details: string;
  actionNeeded?: string;
}

interface StepByStepItem {
  criterion: string;
  searchQuery: string;
}

interface ValidationResult {
  isValid: boolean;
  summary: {
    correctItems: string[];
    incorrectItems: string[];
  };
  taskEvaluation: string;
  stepByStep: StepByStepItem[];
  tasksChecklist: TaskChecklistItem[];
  metadata?: {
    processingTimeMs: number;
    processingTimeSec: number;
    model: string;
    tokens: {
      input: number;
      output: number;
      total: number;
    };
    cost: {
      input: number;
      output: number;
      total: number;
      currency: string;
    };
  };
}

export default function JsonValidatorV2() {
  const [inlineDiff, setInlineDiff] = useState('');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [copiedQuery, setCopiedQuery] = useState<number | null>(null);

  const validateChanges = async () => {
    setError(null);

    if (!inlineDiff.trim() || !prompt.trim()) {
      setError('Please provide inline diff and prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/validate-json-changes-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inlineDiff, prompt }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log(data);
      setResult(data);
      setCompletedSteps(new Set());
    } catch (err: any) {
      console.error('Error validating changes:', err);
      setError(err.message || 'Failed to validate changes. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleStepCompletion = (stepIndex: number) => {
    setCompletedSteps(prev => {
      const newSet = new Set(prev);
      if (newSet.has(stepIndex)) {
        newSet.delete(stepIndex);
      } else {
        newSet.add(stepIndex);
      }
      return newSet;
    });
  };

  const getStepProgress = () => {
    if (!result || !result.stepByStep) return { completed: 0, total: 0, percentage: 0 };
    const total = result.stepByStep.length;
    const completed = completedSteps.size;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

  const copySearchQuery = (query: string, index: number) => {
    navigator.clipboard.writeText(query);
    setCopiedQuery(index);
    setTimeout(() => setCopiedQuery(null), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 9) return 'text-green-400';
    if (score >= 7) return 'text-blue-400';
    if (score >= 5) return 'text-yellow-400';
    if (score >= 3) return 'text-orange-400';
    return 'text-red-400';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 9) return 'bg-green-900/30 border-green-600';
    if (score >= 7) return 'bg-blue-900/30 border-blue-600';
    if (score >= 5) return 'bg-yellow-900/30 border-yellow-600';
    if (score >= 3) return 'bg-orange-900/30 border-orange-600';
    return 'bg-red-900/30 border-red-600';
  };

  const loadExample = () => {
    const exampleDiff = `{
  messages: [
    {
      id: "fKSCmgw8"
      threadId: "fKSCmgw8"
      from: "Casey Edwards <casey.edwards@company.com>"
      to: [
        "you@example.com"
      ]
      subject: "Action required"
      date: "2023-11-15T08:54:28.009000Z"
      text: "I wanted to share the updates we discussed. Everything is on track."
      attachments: [
      ]
      labelIds: [
        "INBOX"
        "ALL"
      ]
-      isRead: false
+      isRead: true
      isStarred: false
      isImportant: false
      snoozeUntil: null
      isDraftDeleted: false
    }
    {
      id: "N8v9SQdH"
      threadId: "N8v9SQdH"
      from: "Amanda Matthews <amanda.matthews@company.com>"
      to: [
        "you@example.com"
      ]
      subject: "Quarterly results"
      date: "2023-11-15T11:32:39.617000Z"
      text: "I wanted to share the updates we discussed. Everything is on track."
      attachments: [
      ]
      labelIds: [
        "INBOX"
        "ALL"
      ]
-      isRead: false
+      isRead: true
      isStarred: false
      isImportant: true
      snoozeUntil: null
      isDraftDeleted: false
    }
+    {
+      id: "MY6BH_h3"
+      threadId: "N8v9SQdH"
+      replyToId: "N8v9SQdH"
+      from: "You <you@example.com>"
+      to: [
+        "amanda.matthews@company.com"
+      ]
+      subject: "Re: Quarterly results"
+      date: "2030-03-14T08:14:00.000Z"
+      text: "Thank you for the quarterly results report."
+      isRead: true
+      isStarred: false
+      isImportant: false
+      labelIds: [
+        "SENT"
+        "ALL"
+      ]
+      attachments: [
+      ]
+    }
  ]
}`;

    const examplePrompt = "Mark the email about Quarterly Results as read and reply thanking Amanda for the report";

    setInlineDiff(exampleDiff);
    setPrompt(examplePrompt);
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-zinc-800/50 rounded-xl shadow-2xl p-8 border border-zinc-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <GitBranch className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  New JSON State Validator
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Validate changes with inline diff, step-by-step actions, and scored task checklist
                </p>
              </div>
            </div>
            <button
              onClick={loadExample}
              className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
            >
              Load Example
            </button>
          </div>

          {/* Inline Diff Input */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-purple-400" />
              Inline Diff (JSON with + and - markers)
            </label>
            <textarea
              value={inlineDiff}
              onChange={(e) => setInlineDiff(e.target.value)}
              placeholder={'{\n  messages: [\n    {\n      labelIds: [\n+        "INBOX"\n         "ALL"\n-        "TRASH"\n      ]\n    }\n  ]\n}'}
              className="w-full h-96 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none font-mono text-sm transition-colors"
            />
          </div>

          {/* Prompt */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-purple-400" />
              Prompt / Instructions
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Mark all emails from my boss as urgent and star them..."
              className="w-full h-24 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none transition-colors"
            />
          </div>

          <button
            onClick={validateChanges}
            disabled={loading || !prompt.trim() || !inlineDiff.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Validating Changes...
              </>
            ) : (
              <>
                <GitBranch className="w-5 h-5" />
                Validate Changes
              </>
            )}
          </button>

          {error && (
            <div className="mt-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300 flex items-start gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {result && (
            <div className="mt-6 space-y-4">
              {/* Overall Result with Summary Checkmarks */}
              <div className={`p-6 border-2 rounded-lg ${
                result.isValid
                  ? 'bg-green-900/20 border-green-500'
                  : 'bg-red-900/20 border-red-500'
              }`}>
                <div className="flex items-center gap-3 mb-3">
                  {result.isValid ? (
                    <CheckCircle className="w-7 h-7 text-green-400" />
                  ) : (
                    <AlertCircle className="w-7 h-7 text-red-400" />
                  )}
                  <h2 className={`text-2xl font-bold ${
                    result.isValid ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {result.isValid ? 'Valid Changes' : 'Invalid Changes'}
                  </h2>
                </div>

                {/* Summary with Checkmarks */}
                <div className="mt-4 space-y-4">
                  {result.summary.correctItems.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-green-300 flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5" />
                        Correct Items:
                      </h3>
                      <div className="space-y-1">
                        {result.summary.correctItems.map((item, index) => (
                          <div key={index} className="flex items-start gap-2 text-green-100">
                            <CheckCircle2 className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {result.summary.incorrectItems.length > 0 && (
                    <div>
                      <h3 className="font-semibold mb-2 text-red-300 flex items-center gap-2">
                        <XCircle className="w-5 h-5" />
                        Incorrect/Missing Items:
                      </h3>
                      <div className="space-y-1">
                        {result.summary.incorrectItems.map((item, index) => (
                          <div key={index} className="flex items-start gap-2 text-red-100">
                            <XCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                            <span className="leading-relaxed">{item}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Task Evaluation */}
                <div className="mt-4 pt-4 border-t border-zinc-600">
                  <h3 className="font-semibold mb-2 text-zinc-200">Task Evaluation:</h3>
                  <p className={`leading-relaxed ${
                    result.isValid ? 'text-green-100' : 'text-red-100'
                  }`}>
                    {result.taskEvaluation}
                  </p>
                </div>
              </div>

              {/* Step by Step */}
              {result.stepByStep && result.stepByStep.length > 0 && (
                <div className="bg-purple-950/40 border-2 border-purple-600 p-6 rounded-lg">
                  <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <ArrowRight className="w-7 h-7 text-purple-400" />
                      <h3 className="text-2xl font-bold text-purple-300">
                        Step-by-Step Actions
                      </h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm text-gray-400">Progress</p>
                        <p className="text-lg font-bold text-purple-300">
                          {getStepProgress().completed} / {getStepProgress().total}
                        </p>
                      </div>
                      <div className="relative w-16 h-16">
                        <svg className="transform -rotate-90 w-16 h-16">
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            className="text-gray-700"
                          />
                          <circle
                            cx="32"
                            cy="32"
                            r="28"
                            stroke="currentColor"
                            strokeWidth="4"
                            fill="transparent"
                            strokeDasharray={`${2 * Math.PI * 28}`}
                            strokeDashoffset={`${2 * Math.PI * 28 * (1 - getStepProgress().percentage / 100)}`}
                            className="text-purple-500 transition-all duration-300"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-xs font-bold text-purple-300">{getStepProgress().percentage}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {result.stepByStep.map((step, index) => {
                      const isCompleted = completedSteps.has(index);
                      return (
                        <div
                          key={index}
                          onClick={() => toggleStepCompletion(index)}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                            isCompleted
                              ? 'bg-green-900/30 border-green-600 hover:bg-green-900/40'
                              : 'bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800/70'
                          }`}
                        >
                          <div className="flex items-center justify-center min-w-[2rem] mt-0.5">
                            {isCompleted ? (
                              <CheckCircle className="w-6 h-6 text-green-400" />
                            ) : (
                              <div className="w-6 h-6 rounded-full border-2 border-zinc-500" />
                            )}
                          </div>
                          <span className="font-bold text-purple-400 min-w-[2rem]">{index + 1}.</span>
                          <div className={`flex-1 ${isCompleted ? 'text-zinc-400 line-through' : 'text-zinc-200'}`}>
                            <p className="leading-relaxed mb-1">{step.criterion}</p>
                            <div className="flex items-center gap-2">
                              <code className="text-xs text-purple-300 bg-zinc-900/50 px-2 py-1 rounded flex-1">
                                {step.searchQuery}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copySearchQuery(step.searchQuery, index);
                                }}
                                className="p-1.5 rounded bg-zinc-700 hover:bg-zinc-600 transition-colors"
                                title="Copy search query"
                              >
                                {copiedQuery === index ? (
                                  <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tasks Checklist with Scoring */}
              {result.tasksChecklist && result.tasksChecklist.length > 0 && (
                <div className="bg-zinc-900/80 border-2 border-purple-600 p-6 rounded-lg">
                  <div className="flex items-center gap-3 mb-5">
                    <ListChecks className="w-7 h-7 text-purple-400" />
                    <h3 className="text-2xl font-bold text-purple-300">
                      Tasks Checklist with Scores
                    </h3>
                  </div>

                  <div className="space-y-3">
                    {result.tasksChecklist.map((item, index) => {
                      const getStatusIcon = () => {
                        if (item.status === 'completed') {
                          return <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />;
                        } else if (item.status === 'partially_completed') {
                          return <AlertTriangle className="w-6 h-6 text-yellow-400 flex-shrink-0" />;
                        } else {
                          return <XCircle className="w-6 h-6 text-red-400 flex-shrink-0" />;
                        }
                      };

                      const getStatusColor = () => {
                        if (item.status === 'completed') {
                          return 'bg-green-900/30 border-green-600';
                        } else if (item.status === 'partially_completed') {
                          return 'bg-yellow-900/30 border-yellow-600';
                        } else {
                          return 'bg-red-900/20 border-red-600';
                        }
                      };

                      const getStatusText = () => {
                        if (item.status === 'completed') {
                          return 'text-green-200';
                        } else if (item.status === 'partially_completed') {
                          return 'text-yellow-200';
                        } else {
                          return 'text-red-200';
                        }
                      };

                      return (
                        <div
                          key={index}
                          className={`p-4 rounded-lg border-2 ${getStatusColor()}`}
                        >
                          <div className="flex items-start gap-3">
                            {getStatusIcon()}
                            <div className="flex-1">
                              <div className="flex items-start justify-between gap-3 mb-1">
                                <h4 className={`font-semibold ${getStatusText()}`}>
                                  {item.task}
                                </h4>
                                <div className={`flex items-center gap-1 px-3 py-1 rounded-full border-2 ${getScoreBgColor(item.score)}`}>
                                  <Star className={`w-4 h-4 ${getScoreColor(item.score)}`} fill="currentColor" />
                                  <span className={`font-bold text-sm ${getScoreColor(item.score)}`}>
                                    {item.score}/10
                                  </span>
                                </div>
                              </div>
                              <p className="text-zinc-300 text-sm leading-relaxed mb-2">
                                {item.details}
                              </p>

                              {/* Action Needed Section */}
                              {item.actionNeeded && item.status !== 'completed' && (
                                <div className={`mt-3 p-3 rounded-md border ${
                                  item.status === 'partially_completed'
                                    ? 'bg-yellow-950/40 border-yellow-700'
                                    : 'bg-red-950/40 border-red-700'
                                }`}>
                                  <div className="flex items-start gap-2">
                                    <ArrowRight className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                                      item.status === 'partially_completed'
                                        ? 'text-yellow-400'
                                        : 'text-red-400'
                                    }`} />
                                    <div className="flex-1">
                                      <p className={`text-xs font-semibold mb-1 ${
                                        item.status === 'partially_completed'
                                          ? 'text-yellow-300'
                                          : 'text-red-300'
                                      }`}>
                                        Action Needed:
                                      </p>
                                      <p className={`text-sm leading-relaxed ${
                                        item.status === 'partially_completed'
                                          ? 'text-yellow-100'
                                          : 'text-red-100'
                                      }`}>
                                        {item.actionNeeded}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Metadata Section */}
              {result.metadata && (
                <div className="bg-zinc-900/60 border-2 border-zinc-700 p-6 rounded-lg">
                  <div className="flex items-center gap-3 mb-4">
                    <Cpu className="w-6 h-6 text-zinc-400" />
                    <h3 className="text-xl font-bold text-zinc-300">
                      Processing Metadata
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Processing Time */}
                    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-5 h-5 text-blue-400" />
                        <h4 className="font-semibold text-zinc-300">Processing Time</h4>
                      </div>
                      <p className="text-2xl font-bold text-blue-400">
                        {result.metadata.processingTimeSec}s
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        {result.metadata.processingTimeMs}ms
                      </p>
                    </div>

                    {/* Token Usage */}
                    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-5 h-5 text-purple-400" />
                        <h4 className="font-semibold text-zinc-300">Tokens Used</h4>
                      </div>
                      <p className="text-2xl font-bold text-purple-400">
                        {result.metadata.tokens.total.toLocaleString()}
                      </p>
                      <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                        <p>Input: {result.metadata.tokens.input.toLocaleString()}</p>
                        <p>Output: {result.metadata.tokens.output.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Cost */}
                    <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="w-5 h-5 text-green-400" />
                        <h4 className="font-semibold text-zinc-300">Total Cost</h4>
                      </div>
                      <p className="text-2xl font-bold text-green-400">
                        ${result.metadata.cost.total.toFixed(4)}
                      </p>
                      <div className="text-xs text-zinc-500 mt-1 space-y-0.5">
                        <p>Input: ${result.metadata.cost.input.toFixed(4)}</p>
                        <p>Output: ${result.metadata.cost.output.toFixed(4)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 text-xs text-zinc-500 text-center">
                    Model: {result.metadata.model}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
