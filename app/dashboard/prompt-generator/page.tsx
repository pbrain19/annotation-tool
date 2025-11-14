'use client';

import { useState } from 'react';
import { Sparkles, AlertCircle, ArrowRight, RefreshCw, ClipboardCheck, Copy, Check, ChevronDown, ChevronUp, Download, FileJson, FileText, FileSpreadsheet, MessageSquare, Wand2 } from 'lucide-react';

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

type DifficultyLevel = 'easy' | 'medium' | 'hard';

export default function PromptGenerator() {
  // Step 1: Input
  const [initialState, setInitialState] = useState('');
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('medium');
  
  // Step 2: Generated Prompt
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [inlineDiff, setInlineDiff] = useState('');
  
  // Step 3: Rubrics
  const [rubrics, setRubrics] = useState<RubricsResponse | null>(null);
  
  // UI State
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
  // Debug: Log step changes
  console.log('Current step:', currentStep);
  const [loadingPrompt, setLoadingPrompt] = useState(false);
  const [loadingRubrics, setLoadingRubrics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Rubrics UI state (from rubrics-creator)
  const [expandedRubrics, setExpandedRubrics] = useState<Set<number>>(new Set());
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'required' | 'non-required'>('all');

  const generatePrompt = async () => {
    if (!initialState.trim()) {
      setError('Please provide initial state JSON');
      return;
    }

    setLoadingPrompt(true);
    setError(null);

    try {
      const response = await fetch('/api/prompts/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ initialState, difficulty }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Prompt generated successfully, moving to step 2:', data);
      setGeneratedPrompt(data.prompt);
      setInlineDiff(data.inlineDiff);
      setCurrentStep(2);
    } catch (err: any) {
      console.error('Error generating prompt:', err);
      setError(err.message || 'Failed to generate prompt. Please try again.');
    } finally {
      setLoadingPrompt(false);
    }
  };

  const regeneratePrompt = async () => {
    await generatePrompt();
  };

  const generateRubrics = async () => {
    if (!generatedPrompt.trim()) {
      setError('Please provide a prompt');
      return;
    }

    setLoadingRubrics(true);
    setError(null);

    try {
      const response = await fetch('/api/rubrics/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          inlineDiff: inlineDiff,
          prompt: generatedPrompt 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Rubrics generated successfully, moving to step 3:', data);
      setRubrics(data);
      setCurrentStep(3);
      // Expand all rubrics by default
      setExpandedRubrics(new Set(data.rubrics.map((_: any, idx: number) => idx)));
    } catch (err: any) {
      console.error('Error generating rubrics:', err);
      setError(err.message || 'Failed to generate rubrics. Please try again.');
    } finally {
      setLoadingRubrics(false);
    }
  };

  const loadExample = () => {
    const exampleState = `{
  messages: [
    {
      id: "aPhcfl9a"
      threadId: "TG59SEK1"
      from: "Monica Davis <monica.davis@corp.co>"
      to: [
        "You <you@example.com>"
      ]
      subject: "Vacation plans"
      date: "2023-11-14T22:35:33.143000Z"
      text: "Thanks again for the meeting today — I appreciated the discussion and next steps."
      attachments: [
      ]
      labelIds: [
        "INBOX"
        "STARRED"
        "ALL"
      ]
      isRead: false
      isStarred: true
      isImportant: false
      snoozeUntil: null
      isDraftDeleted: false
    }
    {
      id: "lEUOOrqc"
      threadId: "13KuwSqQ"
      replyToId: "s68dNmWB"
      from: "Ashley Wilcox <ashley.wilcox@company.com>"
      to: [
        "You <you@example.com>"
      ]
      subject: "Event invitation"
      date: "2023-11-15T06:27:18.793000Z"
      text: "Congratulations on the milestone! Looking forward to the next phase."
      attachments: [
      ]
      labelIds: [
        "INBOX"
        "ALL"
      ]
      isRead: true
      isStarred: false
      isImportant: false
      snoozeUntil: null
      isDraftDeleted: false
    }
    {
      id: "PCnFJt9H"
      threadId: "WC9y9yv3"
      from: "Sherri Moran <sherri.moran@corp.co>"
      to: [
        "You <you@example.com>"
      ]
      subject: "Your order confirmation"
      date: "2023-11-15T06:51:43.522000Z"
      text: "Congratulations on the milestone! Looking forward to the next phase."
      attachments: [
      ]
      labelIds: [
        "INBOX"
        "ALL"
      ]
      isRead: false
      isStarred: false
      isImportant: false
      snoozeUntil: null
      isDraftDeleted: false
    }
  ]
}`;
    setInitialState(exampleState);
    setDifficulty('medium');
  };

  const resetToStep1 = () => {
    setCurrentStep(1);
    setGeneratedPrompt('');
    setInlineDiff('');
    setRubrics(null);
    setError(null);
  };

  const resetToStep2 = () => {
    setCurrentStep(2);
    setRubrics(null);
    setError(null);
  };

  // Rubrics UI functions (from rubrics-creator)
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

  const copyAllAsJSON = async () => {
    if (!rubrics) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(rubrics, null, 2));
      alert('Copied all rubrics as JSON!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const copyForSlack = async () => {
    if (!rubrics) return;

    let slackMessage = `📋 *RUBRICS*\n`;
    slackMessage += `*Total:* ${rubrics.totalPoints} pts | *Required:* ${rubrics.requiredPoints} pts | *Non-Required:* ${rubrics.nonRequiredPoints} pts\n`;
    slackMessage += `*Difficulty:* ${getDifficultyLabel(rubrics.difficultyEstimate)}\n`;
    slackMessage += `*Criteria Count:* ${rubrics.criteriaCount}\n\n`;
    slackMessage += `━━━━━━━━━━━━━━━━━━━━\n\n`;

    rubrics.rubrics.forEach((rubric, index) => {
      slackMessage += `*${index + 1}.* ${rubric.criterion}\n`;
      slackMessage += `   • *${rubric.weight} pts* · ${rubric.required ? '✅ Required' : '🔵 Non-Required'}\n`;
      slackMessage += `   → _Grading:_ ${rubric.gradingFunction}\n\n`;
    });

    try {
      await navigator.clipboard.writeText(slackMessage);
      alert('Copied for Slack!');
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const downloadAsJSON = () => {
    if (!rubrics) return;
    const blob = new Blob([JSON.stringify(rubrics, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rubrics.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAsCSV = () => {
    if (!rubrics) return;

    const headers = ['#', 'Criterion', 'Weight', 'Required', 'Grading Function'];
    const rows = rubrics.rubrics.map((rubric, index) => [
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
    if (!rubrics) return;

    let markdown = `# Rubrics\n\n`;
    markdown += `**Total Points:** ${rubrics.totalPoints} | **Required:** ${rubrics.requiredPoints} | **Non-Required:** ${rubrics.nonRequiredPoints}\n\n`;
    markdown += `**Difficulty:** ${rubrics.difficultyEstimate}\n\n`;
    markdown += `---\n\n`;

    rubrics.rubrics.forEach((rubric, index) => {
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

  const filteredRubrics = rubrics?.rubrics.filter(rubric => {
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
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Wand2 className="w-8 h-8 text-purple-400" />
              <div>
                <h1 className="text-3xl font-bold text-white">
                  Prompt Generator
                </h1>
                <p className="text-zinc-400 text-sm mt-1">
                  Generate contextual prompts and rubrics from email state
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {currentStep > 1 && (
                <button
                  onClick={resetToStep1}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Start Over
                </button>
              )}
              {currentStep === 1 && (
                <button
                  onClick={loadExample}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm"
                >
                  Load Example
                </button>
              )}
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center justify-center mb-8 gap-4">
            <div className={`flex items-center gap-2 ${currentStep >= 1 ? 'text-purple-400' : 'text-zinc-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 1 ? 'bg-purple-600' : 'bg-zinc-700'}`}>
                1
              </div>
              <span className="font-medium">Initial State</span>
            </div>
            <ArrowRight className={currentStep >= 2 ? 'text-purple-400' : 'text-zinc-600'} />
            <div className={`flex items-center gap-2 ${currentStep >= 2 ? 'text-purple-400' : 'text-zinc-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 2 ? 'bg-purple-600' : 'bg-zinc-700'}`}>
                2
              </div>
              <span className="font-medium">Verify Prompt</span>
            </div>
            <ArrowRight className={currentStep >= 3 ? 'text-purple-400' : 'text-zinc-600'} />
            <div className={`flex items-center gap-2 ${currentStep >= 3 ? 'text-purple-400' : 'text-zinc-600'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${currentStep >= 3 ? 'bg-purple-600' : 'bg-zinc-700'}`}>
                3
              </div>
              <span className="font-medium">View Rubrics</span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-700 rounded-lg text-red-300 flex items-start gap-3 transition-colors">
              <AlertCircle className="w-5 h-5 text-red-400 mt-0.5" />
              <p>{error}</p>
            </div>
          )}

          {/* Step 1: Input Initial State */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Initial Email State (JSON)
                </label>
                <textarea
                  value={initialState}
                  onChange={(e) => setInitialState(e.target.value)}
                  placeholder={'{\n  messages: [\n    {\n      id: "abc123"\n      from: "John <john@example.com>"\n      subject: "Q4 Report"\n      ...\n    }\n  ]\n}'}
                  className="w-full h-96 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none font-mono text-sm transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2">
                  Difficulty Level
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as DifficultyLevel)}
                  className="w-full p-3 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none transition-colors"
                >
                  <option value="easy">Easy (1-2 simple actions)</option>
                  <option value="medium">Medium (3-5 actions with conditions)</option>
                  <option value="hard">Hard (Complex multi-step with replies)</option>
                </select>
              </div>

              <button
                onClick={generatePrompt}
                disabled={loadingPrompt || !initialState.trim()}
                className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                {loadingPrompt ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Generating Prompt...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5" />
                    Generate Prompt
                  </>
                )}
              </button>
            </div>
          )}

          {/* Step 2: Verify Prompt */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-300 mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  Generated Task Prompt (Editable)
                </label>
                <textarea
                  value={generatedPrompt}
                  onChange={(e) => setGeneratedPrompt(e.target.value)}
                  className="w-full h-48 p-4 bg-zinc-900 border-2 border-zinc-700 text-zinc-100 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none resize-none transition-colors"
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={regeneratePrompt}
                  disabled={loadingPrompt}
                  className="flex-1 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-zinc-300 font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loadingPrompt ? (
                    <>
                      <div className="w-5 h-5 border-2 border-zinc-300 border-t-transparent rounded-full animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5" />
                      Regenerate Prompt
                    </>
                  )}
                </button>

                <button
                  onClick={generateRubrics}
                  disabled={loadingRubrics || !generatedPrompt.trim()}
                  className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-zinc-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  {loadingRubrics ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Generating Rubrics...
                    </>
                  ) : (
                    <>
                      <ClipboardCheck className="w-5 h-5" />
                      Generate Rubrics
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: View Rubrics */}
          {currentStep === 3 && rubrics && (
            <div className="space-y-4">
              {/* Edit Prompt Option */}
              <div className="bg-zinc-900/60 p-4 rounded-lg border border-zinc-700 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-zinc-300">Task Prompt</p>
                  <p className="text-zinc-400 text-sm mt-1">{generatedPrompt}</p>
                </div>
                <button
                  onClick={resetToStep2}
                  className="bg-zinc-700 hover:bg-zinc-600 text-zinc-300 font-medium py-2 px-4 rounded-lg transition-colors text-sm whitespace-nowrap"
                >
                  Edit Prompt
                </button>
              </div>

              {/* Statistics Dashboard */}
              <div className="bg-zinc-900/80 border-2 border-purple-600 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-4">
                  <ClipboardCheck className="w-7 h-7 text-purple-400" />
                  <h2 className="text-2xl font-bold text-purple-300">
                    Rubric Statistics
                  </h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Total Criteria</p>
                    <p className="text-3xl font-bold text-purple-400">{rubrics.criteriaCount}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Total Points</p>
                    <p className="text-3xl font-bold text-purple-400">{rubrics.totalPoints}</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Required Points</p>
                    <p className="text-3xl font-bold text-green-400">{rubrics.requiredPoints}</p>
                    <p className="text-xs text-zinc-500 mt-1">{Math.round((rubrics.requiredPoints / rubrics.totalPoints) * 100)}% of total</p>
                  </div>
                  <div className="bg-zinc-800/50 p-4 rounded-lg border border-zinc-700">
                    <p className="text-sm text-zinc-400 mb-1">Non-Required Points</p>
                    <p className="text-3xl font-bold text-blue-400">{rubrics.nonRequiredPoints}</p>
                    <p className="text-xs text-zinc-500 mt-1">{Math.round((rubrics.nonRequiredPoints / rubrics.totalPoints) * 100)}% of total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-zinc-400 mb-2">Difficulty Estimate</p>
                    <div className={`inline-block px-4 py-2 rounded-lg border-2 font-bold ${getDifficultyColor(rubrics.difficultyEstimate)}`}>
                      {getDifficultyLabel(rubrics.difficultyEstimate)}
                    </div>
                  </div>

                  <div className="flex-1 max-w-md ml-8">
                    <p className="text-sm text-zinc-400 mb-2">Point Distribution</p>
                    <div className="w-full h-6 bg-zinc-800 rounded-full overflow-hidden flex">
                      <div
                        className="bg-green-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${(rubrics.requiredPoints / rubrics.totalPoints) * 100}%` }}
                      >
                        {rubrics.requiredPoints > 0 && `${Math.round((rubrics.requiredPoints / rubrics.totalPoints) * 100)}%`}
                      </div>
                      <div
                        className="bg-blue-500 flex items-center justify-center text-xs font-bold text-white"
                        style={{ width: `${(rubrics.nonRequiredPoints / rubrics.totalPoints) * 100}%` }}
                      >
                        {rubrics.nonRequiredPoints > 0 && `${Math.round((rubrics.nonRequiredPoints / rubrics.totalPoints) * 100)}%`}
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
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 rounded-lg focus:ring-2 focus:ring-purple-600 focus:outline-none"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setFilterType('all')}
                      className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                        filterType === 'all'
                          ? 'bg-purple-600 text-white'
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
              <div className="bg-zinc-900/60 border-2 border-purple-600 p-6 rounded-lg">
                <div className="flex items-center gap-3 mb-5">
                  <ClipboardCheck className="w-7 h-7 text-purple-400" />
                  <h3 className="text-2xl font-bold text-purple-300">
                    Rubrics ({filteredRubrics.length})
                  </h3>
                </div>

                <div className="space-y-3">
                  {filteredRubrics.map((rubric, index) => {
                    const actualIndex = rubrics.rubrics.indexOf(rubric);
                    const isExpanded = expandedRubrics.has(actualIndex);

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
                                className="p-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
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
                                className="absolute top-4 right-4 p-2 bg-purple-600 hover:bg-purple-700 rounded transition-colors"
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

