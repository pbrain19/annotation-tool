'use client';

import { useState } from 'react';
import { ClipboardCheck, AlertCircle, GitBranch, ArrowRight, Copy, Check, ChevronDown, ChevronUp, Download, FileJson, FileText, FileSpreadsheet, MessageSquare } from 'lucide-react';
import { RUBRICS_SYSTEM_PROMPT } from '@/lib/prompt';

interface RubricItem {
  criterion: string;
  weight: number;
  required: boolean;
  gradingFunction: string;
}

interface RubricsResponse {
  rubrics: RubricItem[];
  totalPoints: number;
  requiredPoints: number;
  nonRequiredPoints: number;
  criteriaCount: number;
  difficultyEstimate: 'too_easy' | 'easy' | 'medium' | 'difficult' | 'too_difficult';
}

export default function RubricsCreator() {
  const [inlineDiff, setInlineDiff] = useState('');
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState<RubricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRubrics, setExpandedRubrics] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'required' | 'non-required'>('all');
  const [copiedSystemPrompt, setCopiedSystemPrompt] = useState(false);

  const generateRubrics = async () => {
    if (!inlineDiff.trim() || !prompt.trim()) {
      setError('Please provide both inline diff and prompt');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch('/api/rubrics/create', {
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
      // Expand all rubrics by default
      setExpandedRubrics(new Set(data.rubrics.map((_: any, idx: number) => idx)));
    } catch (err: any) {
      console.error('Error generating rubrics:', err);
      setError(err.message || 'Failed to generate rubrics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRubricExpansion = (index: number) => {
    setExpandedRubrics(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const copyGradingFunction = async (gradingFunction: string, index: number) => {
    try {
      await navigator.clipboard.writeText(gradingFunction);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copySystemPrompt = async () => {
    try {
      await navigator.clipboard.writeText(RUBRICS_SYSTEM_PROMPT);
      setCopiedSystemPrompt(true);
      setTimeout(() => setCopiedSystemPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyAllAsJSON = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(result, null, 2));
      alert('Copied all rubrics as JSON!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyForSlack = async () => {
    if (!result) return;

    let slackMessage = `📋 *RUBRICS*\n`;
    slackMessage += `*Total:* ${result.totalPoints} pts | *Required:* ${result.requiredPoints} pts | *Non-Required:* ${result.nonRequiredPoints} pts\n`;
    slackMessage += `*Difficulty:* ${getDifficultyLabel(result.difficultyEstimate)}\n`;
    slackMessage += `*Criteria Count:* ${result.criteriaCount}\n\n`;
    slackMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    result.rubrics.forEach((rubric, index) => {
      slackMessage += `*${index + 1}.* ${rubric.criterion}\n`;
      slackMessage += `   • *${rubric.weight} pts* · ${rubric.required ? '✅ Required' : '🔵 Non-Required'}\n`;
      slackMessage += `   → _Grading:_ ${rubric.gradingFunction}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(slackMessage);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadAsJSON = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubrics.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsCSV = () => {
    if (!result) return;

    const headers = ['#', 'Criterion', 'Weight', 'Required', 'Grading Function'];
    const rows = result.rubrics.map((rubric, index) => [
      (index + 1).toString(),
      `"${rubric.criterion.replace(/"/g, '""')}"`,
      rubric.weight.toString(),
      rubric.required ? 'Required' : 'Non-Required',
      `"${rubric.gradingFunction.replace(/"/g, '""')}"`
    ]);

    const csv = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubrics.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsMarkdown = () => {
    if (!result) return;

    let markdown = `# Rubrics\n\n`;
    markdown += `**Total Points:** ${result.totalPoints} | **Required:** ${result.requiredPoints} | **Non-Required:** ${result.nonRequiredPoints}\n\n`;
    markdown += `**Difficulty:** ${result.difficultyEstimate}\n\n`;
    markdown += `---\n\n`;

    result.rubrics.forEach((rubric, index) => {
      markdown += `## ${index + 1}. ${rubric.criterion}\n\n`;
      markdown += `- **Weight:** ${rubric.weight} points\n`;
      markdown += `- **Type:** ${rubric.required ? 'Required' : 'Non-Required'}\n`;
      markdown += `- **Grading Function:** ${rubric.gradingFunction}\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubrics.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadExample = () => {
    const exampleDiff = `{
  messages: [
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
-      isImportant: false
+      isImportant: true
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

    const examplePrompt = "Mark the email about Quarterly Results from Amanda Matthews as read and important, and reply thanking her for the report.";

    setInlineDiff(exampleDiff);
    setPrompt(examplePrompt);
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'too_easy':
        return 'bg-blue-900/20 text-blue-400 border-blue-500';
      case 'easy':
        return 'bg-green-900/20 text-green-400 border-green-500';
      case 'medium':
        return 'bg-yellow-900/30 text-yellow-400 border-yellow-500';
      case 'difficult':
        return 'bg-orange-900/20 text-orange-400 border-orange-500';
      case 'too_difficult':
        return 'bg-red-900/20 text-red-400 border-red-500';
      default:
        return 'bg-zinc-900/20 text-zinc-400 border-zinc-600';
    }
  };

  const getDifficultyLabel = (difficulty: string) => {
    return difficulty.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const filteredRubrics = result?.rubrics.filter(rubric => {
    const matchesSearch = rubric.criterion.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          rubric.gradingFunction.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterType === 'all' ||
                          (filterType === 'required' && rubric.required) ||
                          (filterType === 'non-required' && !rubric.required);
    return matchesSearch && matchesFilter;
  }) || [];

  return (
    <div className="min-h-screen bg-zinc-950 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-zinc-800/50 rounded-xl shadow-2xl p-8 border border-zinc-700">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <ClipboardCheck className="w-8 h-8 text-indigo-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Rubrics Creator
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Generate comprehensive rubrics with grading functions
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={copySystemPrompt}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors text-sm flex items-center gap-2"
                title="Copy system prompt used to generate rubrics"
              >
                {copiedSystemPrompt ? (
                  <>
                    <Check className="w-4 h-4" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy System Prompt
                  </>
                )}
              </button>
              <button
                onClick={loadExample}
                className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
              >
                Load Example
              </button>
            </div>
          </div>

          {/* Input Section */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-indigo-400" />
              Inline Diff (JSON with + and - markers)
            </label>
            <textarea
              value={inlineDiff}
              onChange={(e) => setInlineDiff(e.target.value)}
              placeholder={'{\n  messages: [\n    {\n      labelIds: [\n+        "important"\n         "ALL"\n-        "INBOX"\n      ]\n    }\n  ]\n}'}
              className="w-full h-96 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none font-mono text-sm transition-colors"
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-indigo-400" />
              Task Prompt / Instructions
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="E.g., Mark all emails from Amanda Matthews as important and reply thanking her..."
              className="w-full h-24 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-none resize-none transition-colors"
            />
          </div>

          <button
            onClick={generateRubrics}
            disabled={loading || !prompt.trim() || !inlineDiff.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating Rubrics...
              </>
            ) : (
              <>
                <ClipboardCheck className="w-5 h-5" />
                Generate Rubrics & Grading Functions
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
              {/* Statistics Dashboard */}
              <div className="bg-zinc-900/80 border-2 border-indigo-600 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardCheck className="w-7 h-7 text-indigo-400" />
                  <h2 className="text-2xl font-bold text-indigo-300">
                    Rubric Statistics
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Total Criteria</p>
                    <p className="text-3xl font-bold text-indigo-400">{result.criteriaCount}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Total Points</p>
                    <p className="text-3xl font-bold text-indigo-400">{result.totalPoints}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Required Points</p>
                    <p className="text-3xl font-bold text-green-400">{result.requiredPoints}</p>
                    <p className="text-xs text-zinc-500 mt-1">{Math.round((result.requiredPoints / result.totalPoints) * 100)}% of total</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Non-Required Points</p>
                    <p className="text-3xl font-bold text-blue-400">{result.nonRequiredPoints}</p>
                    <p className="text-xs text-zinc-500 mt-1">{Math.round((result.nonRequiredPoints / result.totalPoints) * 100)}% of total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400 mb-2">Difficulty Estimate</p>
                    <div className={`inline-block px-4 py-2 rounded-lg border-2 font-bold ${getDifficultyColor(result.difficultyEstimate)}`}>
                      {getDifficultyLabel(result.difficultyEstimate)}
                    </div>
                  </div>

                  <div className="flex-1 max-w-md ml-8">
                    <p className="text-sm text-zinc-400 mb-2">Point Distribution</p>
                    <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${(result.requiredPoints / result.totalPoints) * 100}%` }}
                      >
                        {result.requiredPoints > 0 && `${Math.round((result.requiredPoints / result.totalPoints) * 100)}%`}
                      </div>
                      <div
                        className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${(result.nonRequiredPoints / result.totalPoints) * 100}%` }}
                      >
                        {result.nonRequiredPoints > 0 && `${Math.round((result.nonRequiredPoints / result.totalPoints) * 100)}%`}
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                      <span>Required</span>
                      <span>Non-Required</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Search and Filter */}
              <div className="bg-zinc-900/60 p-4 rounded-lg border border-zinc-700">
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="flex-1">
                    <input
                      type="text"
                      placeholder="Search rubrics..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setFilterType('required')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filterType === 'required'
                          ? 'bg-green-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      Required
                    </button>
                    <button
                      onClick={() => setFilterType('non-required')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filterType === 'non-required'
                          ? 'bg-blue-600 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      Non-Required
                    </button>
                  </div>
                </div>
              </div>

              {/* Rubrics List */}
              <div className="bg-zinc-900/60 border-2 border-indigo-600 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-5">
                  <ClipboardCheck className="w-7 h-7 text-indigo-400" />
                  <h3 className="text-2xl font-bold text-indigo-300">
                    Rubrics ({filteredRubrics.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {filteredRubrics.map((rubric, index) => {
                    const isExpanded = expandedRubrics.has(index);
                    const actualIndex = result.rubrics.indexOf(rubric);

                    return (
                      <div
                        key={actualIndex}
                        className={`border-2 rounded-lg transition-all ${
                          rubric.required
                            ? 'bg-green-900/20 border-green-600'
                            : 'bg-blue-900/20 border-blue-600'
                        }`}
                      >
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => toggleRubricExpansion(actualIndex)}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className={`font-bold text-lg ${
                                  rubric.required ? 'text-green-400' : 'text-blue-400'
                                }`}>
                                  #{actualIndex + 1}
                                </span>
                                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                  rubric.required
                                    ? 'bg-green-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}>
                                  {rubric.weight} pts · {rubric.required ? 'Required' : 'Non-Required'}
                                </span>
                              </div>
                              <p className={`leading-relaxed ${
                                rubric.required ? 'text-green-100' : 'text-blue-100'
                              }`}>
                                {rubric.criterion}
                              </p>
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyGradingFunction(rubric.criterion, actualIndex + 1000);
                                }}
                                className="p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                                title="Copy criterion"
                              >
                                {copiedIndex === actualIndex + 1000 ? (
                                  <Check className="w-4 h-4 text-white" />
                                ) : (
                                  <Copy className="w-4 h-4 text-white" />
                                )}
                              </button>
                              <button className="p-2 hover:bg-zinc-700/50 rounded transition-colors">
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-zinc-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-zinc-400" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className={`px-4 pb-4 border-t-2 pt-4 ${
                            rubric.required ? 'border-green-700' : 'border-blue-700'
                          }`}>
                            <p className="text-sm font-semibold text-zinc-300 mb-2">
                              Grading Function:
                            </p>
                            <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700 relative">
                              <p className="text-zinc-200 leading-relaxed pr-12">
                                {rubric.gradingFunction}
                              </p>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyGradingFunction(rubric.gradingFunction, actualIndex);
                                }}
                                className="absolute top-4 right-4 p-2 bg-indigo-600 hover:bg-indigo-700 rounded transition-colors"
                                title="Copy grading function"
                              >
                                {copiedIndex === actualIndex ? (
                                  <Check className="w-4 h-4 text-white" />
                                ) : (
                                  <Copy className="w-4 h-4 text-white" />
                                )}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Export Options */}
              <div className="bg-zinc-900/60 border-2 border-zinc-700 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <Download className="w-6 h-6 text-zinc-400" />
                  <h3 className="text-xl font-bold text-zinc-300">
                    Export Rubrics
                  </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
                  <button
                    onClick={copyForSlack}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <MessageSquare className="w-4 h-4" />
                    Copy for Slack
                  </button>
                  <button
                    onClick={copyAllAsJSON}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                    Copy as JSON
                  </button>
                  <button
                    onClick={downloadAsJSON}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    <FileJson className="w-4 h-4" />
                    Download JSON
                  </button>
                  <button
                    onClick={downloadAsCSV}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4" />
                    Download CSV
                  </button>
                  <button
                    onClick={downloadAsMarkdown}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium rounded-lg transition-colors"
                  >
                    <FileText className="w-4 h-4" />
                    Download Markdown
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
