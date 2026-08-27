import { useState, useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  GitBranch,
  ExternalLink,
  RefreshCw,
  ShieldAlert,
  Zap,
} from 'lucide-react';
import { checkOllamaStatus } from '../services/ollama';
import { DiagnosticItem, OpenFile } from '../types';
import { AppSettings } from '../services/settingsService';

interface StatusBarProps {
  activeFile?: OpenFile;
  settings?: AppSettings;
  diagnostics?: DiagnosticItem[];
  onToggleProblems?: () => void;
  branchName?: string | null;
  onRefreshGit?: () => void;
  onOpenOllamaSettings?: () => void;
  onOpenPreview?: () => void;
  isWorkspaceTrusted?: boolean;
  onRequestWorkspaceTrust?: () => void;
}

export default function StatusBar({
  activeFile,
  settings,
  diagnostics = [],
  onToggleProblems,
  branchName,
  onRefreshGit,
  onOpenOllamaSettings,
  onOpenPreview,
  isWorkspaceTrusted = false,
  onRequestWorkspaceTrust,
}: StatusBarProps) {
  const [isOllamaConnected, setIsOllamaConnected] = useState(false);

  const errorCount = diagnostics.filter((d) => d.severity === 'error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'warning').length;

  useEffect(() => {
    const checkStatus = async () => {
      const connected = await checkOllamaStatus();
      setIsOllamaConnected(connected);
    };
    checkStatus();
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getLanguageLabel = (file?: OpenFile) => {
    if (!file) return 'Plain Text';
    const ext = file.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'cpp':
      case 'cc':
      case 'cxx':
      case 'hpp':
      case 'h':
        return 'C++';
      case 'c':
        return 'C';
      case 'ts':
      case 'tsx':
        return 'TypeScript React';
      case 'js':
      case 'jsx':
        return 'JavaScript';
      case 'py':
        return 'Python 3.12';
      case 'json':
        return 'JSON';
      case 'html':
        return 'HTML5';
      case 'css':
        return 'CSS';
      case 'md':
        return 'Markdown';
      default:
        return file.language || 'Plain Text';
    }
  };

  const isCpp =
    activeFile?.name.endsWith('.cpp') ||
    activeFile?.name.endsWith('.c') ||
    activeFile?.name.endsWith('.hpp') ||
    activeFile?.name.endsWith('.h');

  return (
    <div className="workbench-statusbar flex h-6 w-full items-center justify-between border-t border-[#252526] bg-[#18181b] px-2 text-[11px] text-[#858585] font-sans select-none">
      {/* Left items */}
      <div className="flex items-center h-full">
        {/* Git Branch */}
        {branchName && (
          <button
            type="button"
            onClick={onRefreshGit}
            className="flex h-full items-center gap-1 px-2 text-[#cccccc] hover:bg-[#27272a]"
            title="Current Git branch · Click to refresh"
          >
            <GitBranch size={12} className="text-[#38bdf8]" />
            <span>{branchName}</span>
            <RefreshCw size={10} className="ml-1 text-[#858585]" />
          </button>
        )}

        {/* Problems / Diagnostics Counter */}
        <div
          onClick={onToggleProblems}
          className="flex h-full items-center gap-2 px-2 hover:bg-[#27272a] cursor-pointer transition-colors"
          title="Toggle Problems"
        >
          <span className="flex items-center gap-1 text-[#cccccc]">
            <AlertCircle size={11} className={errorCount > 0 ? 'text-red-400' : 'text-[#858585]'} />
            <span className={errorCount > 0 ? 'text-red-400 font-bold' : ''}>{errorCount}</span>
          </span>
          <span className="flex items-center gap-1 text-[#cccccc]">
            <AlertTriangle size={11} className={warningCount > 0 ? 'text-yellow-400' : 'text-[#858585]'} />
            <span className={warningCount > 0 ? 'text-yellow-400 font-bold' : ''}>{warningCount}</span>
          </span>
        </div>

        {/* C++ Build Target Indicator */}
        {isCpp && (
          <div className="hidden sm:flex h-full items-center gap-1 px-2 text-[#38bdf8] bg-[#007acc]/10 font-mono text-[10px]">
            <Zap size={10} />
            <span>C++20 (GCC)</span>
          </div>
        )}

        {!isWorkspaceTrusted && (
          <button
            type="button"
            onClick={onRequestWorkspaceTrust}
            className="flex h-full items-center gap-1 bg-amber-400/10 px-2 text-amber-300 hover:bg-amber-400/20"
            title="Restricted Mode: click to trust this workspace"
          >
            <ShieldAlert size={11} />
            <span>Restricted Mode</span>
          </button>
        )}
      </div>

      {/* Right items */}
      <div className="flex items-center h-full">
        {activeFile && (
          <>
            <div className="hidden md:flex h-full items-center px-2 text-[#cccccc]">
              Spaces: {settings?.tabSize ?? 4}
            </div>
            <div className="hidden sm:flex h-full items-center px-2 text-[#cccccc]">
              UTF-8
            </div>
            <div className="hidden sm:flex h-full items-center px-2 text-[#cccccc]">
              LF
            </div>
            <div className="flex h-full items-center px-2 text-[#38bdf8] font-medium">
              {getLanguageLabel(activeFile)}
            </div>
          </>
        )}

        {activeFile?.name.toLowerCase().endsWith('.html') && onOpenPreview && (
          <button
            onClick={onOpenPreview}
            className="flex h-full items-center gap-1 px-2 text-[#cccccc] transition-colors hover:bg-[#27272a] hover:text-white"
            title="Open this HTML file in your default browser"
          >
            <ExternalLink size={11} />
            <span>Open Preview</span>
          </button>
        )}

        {/* Local Ollama Status */}
        <div
          onClick={onOpenOllamaSettings}
          className="flex h-full items-center gap-1.5 px-2 text-[#cccccc] hover:bg-[#27272a] cursor-pointer transition-colors"
          title="Local Ollama AI Engine (Click to manage connection & models)"
        >
          <span
            className={`h-2 w-2 rounded-full ${
              isOllamaConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-500/50' : 'bg-red-400'
            }`}
          />
          <span className="text-[11px]">
            {isOllamaConnected ? 'Ollama: Connected' : 'Ollama: Offline'}
          </span>
        </div>
      </div>
    </div>
  );
}
