import { useState, useEffect } from 'react';
import {
  AlertCircle,
  Cpu,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  Layers,
  RefreshCw,
  Server,
  Trash2,
  X,
} from 'lucide-react';
import {
  deleteOllamaModel,
  getLocalModels,
  getOllamaBaseUrl,
  OllamaModelInfo,
  pullOllamaModelStream,
  setOllamaBaseUrl,
  testOllamaConnection,
} from '../services/ollama';

interface OllamaConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onModelSelected?: (modelName: string) => void;
}

interface RecommendedModel {
  name: string;
  tag: string;
  size: string;
  description: string;
  recommendedFor: string;
  badgeColor: string;
}

const RECOMMENDED_MODELS: RecommendedModel[] = [
  {
    name: 'qwen2.5-coder:7b',
    tag: 'qwen2.5-coder:7b',
    size: '4.7 GB',
    description: 'State-of-the-art coding model with strong native tool calling for Agent Mode.',
    recommendedFor: 'Autonomous Agent',
    badgeColor: 'bg-[#8b5cf6]/20 text-[#c084fc] border-[#8b5cf6]/40',
  },
  {
    name: 'gemma3:4b',
    tag: 'gemma3:4b',
    size: '3.1 GB',
    description: 'Google’s lightweight, fast 4B parameter model. Ideal for fast chat and live edits.',
    recommendedFor: 'Fast Chat & Preview',
    badgeColor: 'bg-[#007acc]/20 text-[#38bdf8] border-[#007acc]/40',
  },
  {
    name: 'llama3.1:8b',
    tag: 'llama3.1:8b',
    size: '4.9 GB',
    description: 'Meta’s flagship open-weights model with excellent reasoning and multi-language support.',
    recommendedFor: 'Complex Planning',
    badgeColor: 'bg-[#f59e0b]/20 text-[#fbbf24] border-[#f59e0b]/40',
  },
  {
    name: 'deepseek-coder:6.7b',
    tag: 'deepseek-coder:6.7b',
    size: '3.8 GB',
    description: 'Specialized deep learning model trained on 2 trillion tokens of code.',
    recommendedFor: 'C++ & Python Code',
    badgeColor: 'bg-[#10b981]/20 text-[#34d399] border-[#10b981]/40',
  },
];

export default function OllamaConnectionModal({
  isOpen,
  onClose,
  onModelSelected,
}: OllamaConnectionModalProps) {
  const [activeTab, setActiveTab] = useState<'status' | 'models' | 'pull'>('status');
  const [hostUrl, setHostUrl] = useState(getOllamaBaseUrl());
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    latencyMs: number;
    version?: string;
    error?: string;
  } | null>(null);

  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  const [pullModelName, setPullModelName] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<{
    status: string;
    completed?: number;
    total?: number;
    percent?: number;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const initialize = async () => {
        const savedHost = (await window.appConfig?.getOllamaHost?.().catch(() => undefined)) || getOllamaBaseUrl();
        setHostUrl(savedHost);
        setOllamaBaseUrl(savedHost);
        await Promise.all([runTest(), fetchModels()]);
      };
      initialize();
    }
  }, [isOpen]);

  const runTest = async (targetUrl?: string) => {
    setIsTesting(true);
    const result = await testOllamaConnection(targetUrl || hostUrl);
    setTestResult(result);
    setIsTesting(false);
  };

  const handleSaveHost = async () => {
    setOllamaBaseUrl(hostUrl);
    await window.appConfig?.setOllamaHost(hostUrl).catch(() => {
      // Non-fatal: the renderer's own localStorage copy still governs this session;
      // the main process will just fall back to its default host on next launch.
    });
    await Promise.all([runTest(), fetchModels()]);
  };

  const fetchModels = async () => {
    setIsLoadingModels(true);
    const list = await getLocalModels();
    setModels(list);
    setIsLoadingModels(false);
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Are you sure you want to remove model "${name}" from local disk?`)) {
      const ok = await deleteOllamaModel(name);
      if (ok) {
        fetchModels();
      } else {
        alert('Failed to delete model.');
      }
    }
  };

  const handleStartPull = async (targetName?: string) => {
    const nameToPull = (targetName || pullModelName).trim();
    if (!nameToPull || isPulling) return;

    setIsPulling(true);
    setPullProgress({ status: `Starting download for ${nameToPull}...` });

    const success = await pullOllamaModelStream(nameToPull, (progress) => {
      setPullProgress(progress);
    });

    setIsPulling(false);
    if (success) {
      setPullProgress({ status: `✓ Model "${nameToPull}" installed successfully!`, percent: 100 });
      fetchModels();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 font-sans select-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal Card */}
      <div
        className="relative w-full max-w-2xl overflow-hidden rounded-lg border border-[#2d2d2d] bg-[#1e1e1e] shadow-2xl flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b border-[#2d2d2d] bg-[#18181b] px-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded bg-[#007acc]/20 text-[#38bdf8]">
              <Cpu size={14} />
            </div>
            <div>
              <span className="font-semibold text-white">Local Ollama Engine & Model Manager</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {testResult && (
              <span
                className={`flex items-center gap-1 text-[11px] font-medium ${
                  testResult.success ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    testResult.success ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-red-400'
                  }`}
                />
                <span>
                  {testResult.success
                    ? `Connected (${testResult.latencyMs}ms)`
                    : 'Offline'}
                </span>
              </span>
            )}

            <button
              onClick={onClose}
              className="p-1 rounded text-[#858585] hover:text-white hover:bg-[#2d2d2d] transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex h-9 border-b border-[#2d2d2d] bg-[#18181b] px-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('status')}
            className={`flex items-center gap-1.5 px-3 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-[#007acc] text-white'
                : 'border-transparent text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <Server size={13} />
            <span>Connection & Host</span>
          </button>

          <button
            onClick={() => setActiveTab('models')}
            className={`flex items-center gap-1.5 px-3 border-b-2 transition-colors ${
              activeTab === 'models'
                ? 'border-[#007acc] text-white'
                : 'border-transparent text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <Layers size={13} />
            <span>Installed Models ({models.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pull')}
            className={`flex items-center gap-1.5 px-3 border-b-2 transition-colors ${
              activeTab === 'pull'
                ? 'border-[#007acc] text-white'
                : 'border-transparent text-[#858585] hover:text-[#cccccc]'
            }`}
          >
            <Download size={13} />
            <span>Pull & Recommended Models</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-[#cccccc]">
          {/* Tab 1: Connection & Host */}
          {activeTab === 'status' && (
            <div className="space-y-5">
              {/* Host URL setting */}
              <div className="rounded border border-[#2d2d2d] bg-[#252526] p-4 space-y-3">
                <label className="block text-xs font-semibold text-white">
                  Ollama API Host Endpoint
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={hostUrl}
                    onChange={(e) => setHostUrl(e.target.value)}
                    placeholder="http://localhost:11434"
                    className="flex-1 rounded border border-[#333333] bg-[#1e1e1e] px-3 py-1.5 text-xs text-white outline-none focus:border-[#007acc]"
                  />
                  <button
                    onClick={handleSaveHost}
                    disabled={isTesting}
                    className="rounded bg-[#007acc] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0062a3] transition-colors"
                  >
                    Save & Test
                  </button>
                </div>
                <p className="text-[11px] text-[#858585]">
                  Default is <code className="text-[#38bdf8]">http://localhost:11434</code>. Local discovery checks both IPv4 and IPv6 and selects the daemon that owns your models.
                </p>
              </div>

              {/* Status & Diagnostic Card */}
              <div className="rounded border border-[#2d2d2d] bg-[#252526] p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-semibold text-white">Engine Diagnostic Status</span>
                  <button
                    onClick={() => runTest()}
                    disabled={isTesting}
                    className="flex items-center gap-1 rounded border border-[#333333] bg-[#1e1e1e] px-2 py-1 text-[11px] hover:text-white hover:border-[#555555]"
                  >
                    <RefreshCw size={11} className={isTesting ? 'animate-spin' : ''} />
                    <span>Ping Test</span>
                  </button>
                </div>

                {testResult?.success ? (
                  <div className="space-y-2 text-emerald-300 bg-emerald-950/20 border border-emerald-800/30 p-3 rounded">
                    <div className="flex items-center gap-2 font-medium">
                      <CheckCircle2 size={16} className="text-emerald-400" />
                      <span>Ollama is active and responding locally!</span>
                    </div>
                    <div className="text-[11px] text-[#858585] space-y-0.5">
                      <p>Version / Tag: <span className="text-white">{testResult.version}</span></p>
                      <p>Response Latency: <span className="text-emerald-400 font-mono">{testResult.latencyMs} ms</span></p>
                      <p>Available Models: <span className="text-white">{models.length} installed</span></p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 text-red-300 bg-red-950/20 border border-red-800/30 p-3 rounded">
                    <div className="flex items-center gap-2 font-medium">
                      <AlertCircle size={16} className="text-red-400" />
                      <span>Ollama daemon is currently offline or unreachable.</span>
                    </div>
                    <p className="text-[11px] text-[#cccccc]">
                      To start Ollama, open your terminal and run:
                    </p>
                    <pre className="rounded bg-[#141414] p-2 text-[11px] font-mono text-[#38bdf8]">
                      ollama serve
                    </pre>
                    <p className="text-[11px] text-[#858585]">
                      If Ollama is not installed yet, download it from{' '}
                      <a
                        href="https://ollama.com"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[#007acc] underline inline-flex items-center gap-0.5"
                      >
                        ollama.com <ExternalLink size={10} />
                      </a>.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Installed Models */}
          {activeTab === 'models' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-[#858585]">
                <span>Models available for Local AI Assistant & Agent:</span>
                <button
                  onClick={fetchModels}
                  disabled={isLoadingModels}
                  className="flex items-center gap-1 hover:text-white"
                >
                  <RefreshCw size={11} className={isLoadingModels ? 'animate-spin' : ''} />
                  <span>Refresh</span>
                </button>
              </div>

              {models.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 border border-dashed border-[#333333] rounded-lg text-center space-y-2">
                  <Cpu size={28} className="text-[#858585]" />
                  <p className="text-xs font-medium text-white">No models installed yet</p>
                  <p className="text-[11px] text-[#858585] max-w-sm">
                    Switch to the &ldquo;Pull & Recommended Models&rdquo; tab to download a fast coding model with one click.
                  </p>
                  <button
                    onClick={() => setActiveTab('pull')}
                    className="mt-2 rounded bg-[#007acc] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#0062a3]"
                  >
                    Browse Models
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {models.map((m) => {
                    const sizeGb = (m.size / (1024 * 1024 * 1024)).toFixed(2);
                    return (
                      <div
                        key={m.name}
                        className="flex items-center justify-between rounded border border-[#2d2d2d] bg-[#252526] p-3 hover:border-[#38bdf8]/40 transition-colors"
                      >
                        <div className="min-w-0 flex-1 pr-3">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-white text-xs">{m.name}</span>
                            <span className="rounded bg-[#007acc]/15 px-1.5 py-0.2 text-[10px] font-mono text-[#38bdf8]">
                              {sizeGb} GB
                            </span>
                          </div>
                          <p className="text-[10px] text-[#858585] mt-0.5">
                            Modified: {new Date(m.modified_at).toLocaleDateString()}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          {onModelSelected && (
                            <button
                              onClick={() => {
                                onModelSelected(m.name);
                                onClose();
                              }}
                              className="rounded bg-[#2a2d2e] px-2.5 py-1 text-[11px] font-medium text-[#cccccc] hover:bg-[#007acc] hover:text-white transition-colors"
                            >
                              Select for Chat
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(m.name)}
                            className="p-1 rounded text-[#858585] hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            title="Delete model from disk"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Pull & Recommended Models */}
          {activeTab === 'pull' && (
            <div className="space-y-5">
              {/* Custom Pull Bar */}
              <div className="rounded border border-[#2d2d2d] bg-[#252526] p-4 space-y-3">
                <label className="block text-xs font-semibold text-white">
                  Pull Model by Tag Name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={pullModelName}
                    onChange={(e) => setPullModelName(e.target.value)}
                    placeholder="e.g. qwen2.5-coder:7b, gemma3:4b, llama3.1, deepseek-coder"
                    disabled={isPulling}
                    className="flex-1 rounded border border-[#333333] bg-[#1e1e1e] px-3 py-1.5 text-xs text-white outline-none focus:border-[#007acc]"
                  />
                  <button
                    onClick={() => handleStartPull()}
                    disabled={!pullModelName.trim() || isPulling}
                    className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium text-white transition-colors ${
                      !pullModelName.trim() || isPulling
                        ? 'bg-[#333333] text-[#666666] cursor-not-allowed'
                        : 'bg-[#007acc] hover:bg-[#0062a3]'
                    }`}
                  >
                    <Download size={13} />
                    <span>{isPulling ? 'Pulling...' : 'Pull Model'}</span>
                  </button>
                </div>

                {/* Pull Progress Bar */}
                {pullProgress && (
                  <div className="rounded bg-[#18181b] p-3 border border-[#333333] space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-[#cccccc]">{pullProgress.status}</span>
                      {typeof pullProgress.percent === 'number' && (
                        <span className="font-mono text-[#38bdf8] font-bold">
                          {pullProgress.percent}%
                        </span>
                      )}
                    </div>
                    {typeof pullProgress.percent === 'number' && (
                      <div className="h-1.5 w-full rounded-full bg-[#2a2a2e] overflow-hidden">
                        <div
                          className="h-full bg-[#007acc] transition-all duration-300"
                          style={{ width: `${pullProgress.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recommended 1-Click Cards */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-semibold text-white">Recommended AI Models for Coding</h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {RECOMMENDED_MODELS.map((rec) => {
                    const isInstalled = models.some(
                      (m) => m.name === rec.tag || m.name.startsWith(rec.tag.split(':')[0])
                    );

                    return (
                      <div
                        key={rec.tag}
                        className="flex flex-col justify-between rounded border border-[#2d2d2d] bg-[#252526] p-3 space-y-3 hover:border-[#38bdf8]/40 transition-all"
                      >
                        <div>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-white text-xs">{rec.name}</span>
                            <span className={`rounded px-1.5 py-0.2 text-[9px] font-medium border ${rec.badgeColor}`}>
                              {rec.recommendedFor}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#858585] leading-relaxed">
                            {rec.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#333333] text-[11px]">
                          <span className="text-[#858585] font-mono">{rec.size}</span>

                          {isInstalled ? (
                            <span className="flex items-center gap-1 text-emerald-400 font-medium">
                              <Check size={12} /> Installed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleStartPull(rec.tag)}
                              disabled={isPulling}
                              className="flex items-center gap-1 rounded bg-[#007acc] px-2.5 py-1 font-medium text-white hover:bg-[#0062a3] transition-colors"
                            >
                              <Download size={11} />
                              <span>Install</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex h-11 items-center justify-between border-t border-[#2d2d2d] bg-[#18181b] px-4 text-xs">
          <span className="text-[11px] text-[#858585]">
            Onyx Code runs 100% locally with zero cloud telemetry.
          </span>
          <button
            onClick={onClose}
            className="rounded bg-[#2a2d2e] px-3 py-1 text-xs font-medium text-[#cccccc] hover:bg-[#383b3d] hover:text-white transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
