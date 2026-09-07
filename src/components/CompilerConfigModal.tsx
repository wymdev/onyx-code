import { useState, useEffect } from 'react';
import {
  Cpu,
  Zap,
  Trash2,
  Check,
  X,
  RefreshCw,
  Layers,
  Binary,
  ShieldAlert,
  Code,
} from 'lucide-react';
import { CompilerConfig, ToolchainInfo } from '../types';
import { runtime } from '../platform/runtime';
import Checkbox from './ui/Checkbox';

interface CompilerConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: CompilerConfig;
  onConfigChange: (config: CompilerConfig) => void;
}

export const DEFAULT_COMPILER_CONFIG: CompilerConfig = {
  optimization: 'O2',
  cppStandard: 'c++20',
  cStandard: 'c17',
  warnings: 'all',
  treatWarningsAsErrors: false,
  debugSymbols: true,
  emitAssembly: false,
  customFlags: '',
};

export default function CompilerConfigModal({
  isOpen,
  onClose,
  config,
  onConfigChange,
}: CompilerConfigModalProps) {
  const [localConfig, setLocalConfig] = useState<CompilerConfig>(config);
  const [cleanStatus, setCleanStatus] = useState<string | null>(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [toolchains, setToolchains] = useState<ToolchainInfo[]>([]);
  const [isScanning, setIsScanning] = useState(false);

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  useEffect(() => {
    if (isOpen) {
      loadToolchains();
    }
  }, [isOpen]);

  const loadToolchains = async () => {
    setIsScanning(true);
    try {
      const results = await runtime.detectAllToolchains();
      if (results) setToolchains(results);
    } catch (e) {
      console.error('Failed to detect toolchains', e);
    } finally {
      setIsScanning(false);
    }
  };

  if (!isOpen) return null;

  const handlePreset = (preset: 'debug' | 'release' | 'disasm' | 'strict') => {
    switch (preset) {
      case 'debug':
        setLocalConfig((prev) => ({
          ...prev,
          optimization: 'O0',
          debugSymbols: true,
          warnings: 'all',
          treatWarningsAsErrors: false,
          emitAssembly: false,
        }));
        break;
      case 'release':
        setLocalConfig((prev) => ({
          ...prev,
          optimization: 'O3',
          debugSymbols: false,
          warnings: 'all',
          treatWarningsAsErrors: false,
          emitAssembly: false,
        }));
        break;
      case 'disasm':
        setLocalConfig((prev) => ({
          ...prev,
          optimization: 'O2',
          debugSymbols: true,
          emitAssembly: true,
        }));
        break;
      case 'strict':
        setLocalConfig((prev) => ({
          ...prev,
          optimization: 'O2',
          warnings: 'extra',
          treatWarningsAsErrors: true,
        }));
        break;
    }
  };

  const handleClean = async () => {
    setIsCleaning(true);
    setCleanStatus(null);
    try {
      const res = await runtime.cleanBuildArtifacts();
      if (res?.success) {
        setCleanStatus(`Cleaned ${res.count} build artifacts (.exe, .o, .s, .class)`);
      } else {
        setCleanStatus(`Clean finished (${res?.count || 0} removed)`);
      }
    } catch {
      setCleanStatus('Failed to clean build artifacts');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSave = () => {
    onConfigChange(localConfig);
    try {
      localStorage.setItem('onyx_compiler_config', JSON.stringify(localConfig));
    } catch {}
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="flex flex-col w-full max-w-2xl max-h-[90vh] bg-[#1e1e1e] border border-[#3e3e42] rounded-lg shadow-2xl overflow-hidden text-[#cccccc]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#333333] bg-[#252526]">
          <div className="flex items-center gap-2.5">
            <Cpu className="h-5 w-5 text-[#007acc]" />
            <h2 className="text-sm font-semibold text-white tracking-wide">Compiler & Build Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-[#333333] text-[#858585] hover:text-white transition-colors"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar text-xs">
          {/* Quick Presets */}
          <div>
            <label className="block font-medium text-[#cccccc] mb-2 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" />
              Quick Presets
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => handlePreset('debug')}
                className="px-3 py-2 text-left rounded border border-[#3e3e42] bg-[#2d2d30] hover:bg-[#37373d] transition-colors"
              >
                <div className="font-semibold text-white">Debug</div>
                <div className="text-[10px] text-[#858585] mt-0.5">-O0, -g, -Wall</div>
              </button>
              <button
                type="button"
                onClick={() => handlePreset('release')}
                className="px-3 py-2 text-left rounded border border-[#3e3e42] bg-[#2d2d30] hover:bg-[#37373d] transition-colors"
              >
                <div className="font-semibold text-white">Release</div>
                <div className="text-[10px] text-[#858585] mt-0.5">-O3, No symbols</div>
              </button>
              <button
                type="button"
                onClick={() => handlePreset('disasm')}
                className="px-3 py-2 text-left rounded border border-[#3e3e42] bg-[#2d2d30] hover:bg-[#37373d] transition-colors"
              >
                <div className="font-semibold text-white">Assembly</div>
                <div className="text-[10px] text-[#858585] mt-0.5">-S Intel Disasm</div>
              </button>
              <button
                type="button"
                onClick={() => handlePreset('strict')}
                className="px-3 py-2 text-left rounded border border-[#3e3e42] bg-[#2d2d30] hover:bg-[#37373d] transition-colors"
              >
                <div className="font-semibold text-white">Strict</div>
                <div className="text-[10px] text-[#858585] mt-0.5">-Wall -Wextra -Werror</div>
              </button>
            </div>
          </div>

          {/* Optimization & Language Standards */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#cccccc] mb-1.5 flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-blue-400" />
                Optimization Level
              </label>
              <select
                value={localConfig.optimization || 'O2'}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    optimization: e.target.value as any,
                  })
                }
                className="w-full bg-[#252526] border border-[#3e3e42] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#007acc]"
              >
                <option value="O0">-O0 (No Optimization, Fast Build & Debugging)</option>
                <option value="O1">-O1 (Basic Optimization)</option>
                <option value="O2">-O2 (Default - Recommended for Most Builds)</option>
                <option value="O3">-O3 (Aggressive Optimization / Vectorization)</option>
                <option value="Os">-Os (Optimize for Binary Size)</option>
                <option value="Ofast">-Ofast (Fast Math & Max Performance)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#cccccc] mb-1.5 flex items-center gap-1.5">
                <Code className="h-3.5 w-3.5 text-emerald-400" />
                C++ Language Standard
              </label>
              <select
                value={localConfig.cppStandard || 'c++20'}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    cppStandard: e.target.value as any,
                  })
                }
                className="w-full bg-[#252526] border border-[#3e3e42] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#007acc]"
              >
                <option value="c++23">-std=c++23 (ISO C++ 2023)</option>
                <option value="c++20">-std=c++20 (ISO C++ 2020 - Default)</option>
                <option value="c++17">-std=c++17 (ISO C++ 2017)</option>
                <option value="c++14">-std=c++14 (ISO C++ 2014)</option>
                <option value="c++11">-std=c++11 (ISO C++ 2011)</option>
              </select>
            </div>
          </div>

          {/* C Standard & Warnings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-[#cccccc] mb-1.5 flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-400" />
                C Language Standard
              </label>
              <select
                value={localConfig.cStandard || 'c17'}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    cStandard: e.target.value as any,
                  })
                }
                className="w-full bg-[#252526] border border-[#3e3e42] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#007acc]"
              >
                <option value="c17">-std=c17 (Default C Standard)</option>
                <option value="c11">-std=c11 (ISO C 2011)</option>
                <option value="c99">-std=c99 (ISO C 1999)</option>
              </select>
            </div>

            <div>
              <label className="block font-medium text-[#cccccc] mb-1.5 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5 text-amber-400" />
                Compiler Diagnostics & Warnings
              </label>
              <select
                value={localConfig.warnings || 'all'}
                onChange={(e) =>
                  setLocalConfig({
                    ...localConfig,
                    warnings: e.target.value as any,
                  })
                }
                className="w-full bg-[#252526] border border-[#3e3e42] rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-[#007acc]"
              >
                <option value="all">-Wall (Standard Recommended Warnings)</option>
                <option value="extra">-Wall -Wextra (Strict Pedantic Warnings)</option>
                <option value="none">No Warning Flags</option>
              </select>
            </div>
          </div>

          {/* Compilation Flags & Options */}
          <div className="bg-[#252526] p-3.5 rounded border border-[#333333] space-y-3">
            <div className="font-semibold text-white mb-1">Compiler Flags & Output Format</div>

            <Checkbox
              checked={localConfig.debugSymbols !== false}
              onChange={(checked) => setLocalConfig({ ...localConfig, debugSymbols: checked })}
              label="Generate Debug Symbols (-g)"
              description="(Enables GDB / LLDB / Onyx breakpoint debugging)"
              className="w-full"
            />

            <Checkbox
              checked={Boolean(localConfig.treatWarningsAsErrors)}
              onChange={(checked) => setLocalConfig({ ...localConfig, treatWarningsAsErrors: checked })}
              label="Treat Warnings as Errors (-Werror)"
              description="(Prevents compilation if any warning occurs)"
              className="w-full"
            />

            <Checkbox
              checked={Boolean(localConfig.emitAssembly)}
              onChange={(checked) => setLocalConfig({ ...localConfig, emitAssembly: checked })}
              label={
                <span className="flex items-center gap-1.5 font-medium">
                  <Binary className="h-3.5 w-3.5 text-blue-400" />
                  Emit Intel Assembly Disassembly (-S -masm=intel)
                </span>
              }
              description="(Generates readable .s assembly in output console)"
              className="w-full"
            />
          </div>

          {/* Custom Arguments */}
          <div>
            <label className="block font-medium text-[#cccccc] mb-1.5">
              Custom Compiler Flags (passed directly to compiler)
            </label>
            <input
              type="text"
              value={localConfig.customFlags || ''}
              onChange={(e) => setLocalConfig({ ...localConfig, customFlags: e.target.value })}
              placeholder="e.g. -pthread -lm -DDEBUG -I./include"
              className="w-full bg-[#252526] border border-[#3e3e42] rounded px-3 py-2 text-xs text-white font-mono placeholder:text-[#6e6e6e] focus:outline-none focus:border-[#007acc]"
            />
          </div>

          {/* Detected Toolchains Overview */}
          <div className="bg-[#252526] p-3.5 rounded border border-[#333333]">
            <div className="flex items-center justify-between mb-2">
              <span className="font-semibold text-white flex items-center gap-1.5">
                <Cpu className="h-3.5 w-3.5 text-blue-400" />
                Detected System Toolchains ({toolchains.filter((t) => t.available).length} Installed)
              </span>
              <button
                type="button"
                onClick={loadToolchains}
                disabled={isScanning}
                className="flex items-center gap-1 text-[11px] text-[#007acc] hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isScanning ? 'animate-spin' : ''}`} />
                Rescan
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              {toolchains.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center justify-between p-2 rounded border ${
                    t.available
                      ? 'border-[#2d3748] bg-[#1a202c]/40 text-[#cbd5e0]'
                      : 'border-[#333333] bg-[#1e1e1e]/60 text-[#718096]'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        t.available ? 'bg-emerald-400' : 'bg-zinc-600'
                      }`}
                    />
                    <span className="font-medium truncate">{t.name}</span>
                  </div>
                  <span className="text-[10px] text-[#858585] ml-2 truncate max-w-[120px]">
                    {t.available ? t.version || 'Available' : 'Not found'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Clean Build Artifacts Section */}
          <div className="flex items-center justify-between p-3 rounded border border-[#3e3e42] bg-[#252526]">
            <div>
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5 text-red-400" />
                Clean Build Artifacts
              </div>
              <div className="text-[11px] text-[#858585]">
                Removes compiled binaries (.exe, .o, .obj, .out, .s, .class, .pdb) in the workspace.
              </div>
              {cleanStatus && (
                <div className="text-[11px] text-emerald-400 font-medium mt-1">{cleanStatus}</div>
              )}
            </div>
            <button
              type="button"
              onClick={handleClean}
              disabled={isCleaning}
              className="px-3 py-1.5 rounded border border-[#e51400] text-[#f48771] hover:bg-[#e51400]/20 transition-colors flex items-center gap-1.5 font-medium disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isCleaning ? 'Cleaning...' : 'Clean Artifacts'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-5 py-3 border-t border-[#333333] bg-[#252526]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-[#cccccc] hover:bg-[#333333] rounded transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 text-xs bg-[#007acc] hover:bg-[#0062a3] text-white font-medium rounded flex items-center gap-1.5 transition-colors"
          >
            <Check className="h-3.5 w-3.5" />
            Apply & Save
          </button>
        </div>
      </div>
    </div>
  );
}
