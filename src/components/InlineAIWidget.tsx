import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Check, X, RotateCcw, Loader2, ArrowRight } from 'lucide-react';
import { generateResponseStream } from '../services/ollama';

interface InlineAIWidgetProps {
  selectedText: string;
  language: string;
  fileName: string;
  model: string;
  onAccept: (replacementCode: string) => void;
  onClose: () => void;
}

export default function InlineAIWidget({
  selectedText,
  language,
  fileName,
  model,
  onAccept,
  onClose,
}: InlineAIWidgetProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleGenerate = async () => {
    const trimmedPrompt = prompt.trim();
    if (!trimmedPrompt || isGenerating) return;

    setIsGenerating(true);
    setError(null);
    setGeneratedCode('');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fullPrompt = `You are an expert AI code generator inside Onyx Code IDE.
File: ${fileName}
Language: ${language}

Selected code to modify or replace:
\`\`\`${language}
${selectedText || '// (No code selected, write new code here)'}
\`\`\`

User instruction:
${trimmedPrompt}

IMPORTANT RULES:
1. Return ONLY the replacement code inside a single markdown code block (\`\`\`${language} ... \`\`\`).
2. Do not include any explanations, greetings, or commentary outside the code block.
3. Produce clean, correct, and high-quality code matching the existing style.`;

    let accumulated = '';
    try {
      const stream = generateResponseStream(fullPrompt, model, {}, controller.signal);
      for await (const chunk of stream) {
        accumulated += chunk;
        // Strip markdown fences in real-time if present
        let clean = accumulated;
        const codeBlockMatch = clean.match(/```(?:\w+)?\r?\n([\s\S]*?)(?:```|$)/);
        if (codeBlockMatch) {
          clean = codeBlockMatch[1];
        } else {
          clean = clean.replace(/^```(?:\w+)?\r?\n?/, '').replace(/```$/, '');
        }
        setGeneratedCode(clean);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        setError(err.message || 'Generation failed');
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    } else if (e.key === 'Enter' && !e.shiftKey) {
      if (generatedCode !== null && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        onAccept(generatedCode);
      } else if (!isGenerating && generatedCode === null) {
        e.preventDefault();
        handleGenerate();
      }
    }
  };

  return (
    <div
      onKeyDown={handleKeyDown}
      className="absolute top-8 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-2xl rounded-xl border border-[#3b82f6]/50 bg-[#16171d]/95 p-3 shadow-2xl backdrop-blur-md text-[#cccccc] text-xs transition-all animate-in fade-in duration-150"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#2a2b36]">
        <div className="flex items-center gap-2">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-sm">
            <Cpu size={12} />
          </div>
          <span className="font-semibold text-white tracking-wide text-[11.5px]">Inline Code Composer</span>
          <span className="rounded bg-[#20222e] px-1.5 py-0.5 text-[10px] font-mono text-sky-400 border border-[#2e3144]">
            {model}
          </span>
          {selectedText.trim() && (
            <span className="text-[10.5px] text-[#8b91aa]">
              ({selectedText.split('\n').length} line{selectedText.split('\n').length > 1 ? 's' : ''} selected)
            </span>
          )}
        </div>
        <button
          onClick={handleCancel}
          className="rounded p-1 text-[#8b91aa] hover:bg-[#252736] hover:text-white transition-colors"
          title="Close (Esc)"
        >
          <X size={13} />
        </button>
      </div>

      {/* Prompt Input */}
      <div className="flex items-center gap-2 rounded-lg border border-[#2a2b38] bg-[#0d0e13] px-3 py-2 focus-within:border-sky-500/70 focus-within:ring-1 focus-within:ring-sky-500/30 transition-all">
        <input
          ref={inputRef}
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ask local Ollama to edit or generate code... (e.g. 'Add error checking', 'Refactor into helper')"
          disabled={isGenerating}
          className="flex-1 bg-transparent text-xs text-white placeholder:text-[#55586d] outline-none"
        />
        {isGenerating ? (
          <button
            onClick={handleCancel}
            className="flex items-center gap-1.5 rounded bg-red-500/20 px-2.5 py-1 text-[11px] font-medium text-red-400 hover:bg-red-500/30 transition-colors"
          >
            <Loader2 size={12} className="animate-spin" />
            <span>Stop</span>
          </button>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={!prompt.trim()}
            className="flex items-center gap-1 rounded bg-sky-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-sky-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <span>Generate</span>
            <ArrowRight size={11} />
          </button>
        )}
      </div>

      {/* Error Notice */}
      {error && (
        <div className="mt-2 rounded bg-red-500/10 border border-red-500/20 p-2 text-[11px] text-red-400">
          {error}
        </div>
      )}

      {/* Generated Preview */}
      {generatedCode !== null && (
        <div className="mt-3 flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] text-[#8b91aa]">
            <span className="font-medium text-[#e4e4e7]">Proposed Replacement:</span>
            <span className="text-[10px] font-mono">Press Ctrl+Enter to Accept</span>
          </div>
          <pre className="max-h-48 overflow-auto rounded-lg border border-[#2a2b38] bg-[#0c0d12] p-2.5 font-mono text-[11px] leading-relaxed text-[#7dd3fc]">
            <code>{generatedCode || '// Generating code...'}</code>
          </pre>

          {/* Accept / Reject Bar */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={() => handleGenerate()}
              disabled={isGenerating || !prompt.trim()}
              className="flex items-center gap-1 rounded bg-[#20222e] hover:bg-[#2a2d3d] px-2.5 py-1 text-[11px] text-[#b3b7cb] transition-colors"
              title="Regenerate"
            >
              <RotateCcw size={11} />
              <span>Retry</span>
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 rounded bg-[#20222e] hover:bg-red-500/20 hover:text-red-400 px-2.5 py-1 text-[11px] text-[#b3b7cb] transition-colors"
            >
              <X size={12} />
              <span>Discard (Esc)</span>
            </button>
            <button
              onClick={() => onAccept(generatedCode)}
              className="flex items-center gap-1 rounded bg-emerald-600 hover:bg-emerald-500 px-3 py-1 text-[11px] font-medium text-white shadow transition-colors"
            >
              <Check size={12} />
              <span>Accept (Ctrl+Enter)</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
