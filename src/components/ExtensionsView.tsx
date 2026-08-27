import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Cpu, Download, FolderPlus, Package, Puzzle, RefreshCw, Search, Shield, Trash2, X } from 'lucide-react';
import { getLocalModels, OllamaModelInfo, pullOllamaModelStream } from '../services/ollama';
import { InstalledOnyxPlugin, OnyxPluginManifest, PluginPermission } from '../types';

const RECOMMENDED_MODELS = [
  { tag: 'qwen2.5-coder:7b', name: 'Qwen 2.5 Coder 7B', detail: 'Strong tool calling and coding performance.' },
  { tag: 'gemma3:4b', name: 'Gemma 3 4B', detail: 'Fast local chat and lightweight code assistance.' },
  { tag: 'llama3.1:8b', name: 'Llama 3.1 8B', detail: 'General reasoning and planning.' },
];

const PERMISSION_TEXT: Record<PluginPermission, string> = {
  commands: 'Register commands in the Onyx Command Palette',
  'workspace.read': 'Read files inside a trusted workspace',
  'workspace.write': 'Create or change files inside a trusted workspace',
};

export default function ExtensionsView() {
  const [tab, setTab] = useState<'plugins' | 'models'>('plugins');
  const [search, setSearch] = useState('');
  const [plugins, setPlugins] = useState<InstalledOnyxPlugin[]>([]);
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [candidate, setCandidate] = useState<{ sourcePath: string; manifest: OnyxPluginManifest } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  const loadPlugins = async () => {
    try {
      setPlugins((await window.plugins?.list()) || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load plugins');
    }
  };

  const loadModels = async () => setModels(await getLocalModels());

  useEffect(() => {
    loadPlugins();
    loadModels();
  }, []);

  const inspectPlugin = async () => {
    setError(null);
    try {
      const result = await window.plugins?.inspect();
      if (result) setCandidate(result);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'This folder is not a valid Onyx plugin');
    }
  };

  const installCandidate = async () => {
    if (!candidate) return;
    setBusy(candidate.manifest.id);
    setError(null);
    try {
      const result = await window.plugins?.install({
        sourcePath: candidate.sourcePath,
        approvedPermissions: candidate.manifest.permissions || [],
      });
      setCandidate(null);
      await loadPlugins();
      if (result?.error) setError(`Installed, but activation failed: ${result.error}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Plugin installation failed');
    } finally {
      setBusy(null);
    }
  };

  const togglePlugin = async (plugin: InstalledOnyxPlugin) => {
    setBusy(plugin.manifest.id);
    try {
      setPlugins((await window.plugins?.setEnabled(plugin.manifest.id, !plugin.enabled)) || []);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to update plugin');
    } finally {
      setBusy(null);
    }
  };

  const uninstallPlugin = async (plugin: InstalledOnyxPlugin) => {
    if (!confirm(`Uninstall ${plugin.manifest.name}? Its installed plugin files will be removed.`)) return;
    setBusy(plugin.manifest.id);
    try {
      await window.plugins?.uninstall(plugin.manifest.id);
      await loadPlugins();
    } finally {
      setBusy(null);
    }
  };

  const pullModel = async (tag: string) => {
    setBusy(tag);
    setPullStatus(`Starting ${tag}...`);
    const success = await pullOllamaModelStream(tag, (progress) => {
      setPullStatus(`${progress.status}${progress.percent !== undefined ? ` · ${progress.percent}%` : ''}`);
    });
    if (success) await loadModels();
    setBusy(null);
  };

  const filteredPlugins = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? plugins.filter(({ manifest }) => `${manifest.name} ${manifest.id} ${manifest.description || ''}`.toLowerCase().includes(query))
      : plugins;
  }, [plugins, search]);

  const filteredModels = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? RECOMMENDED_MODELS.filter((model) => `${model.name} ${model.tag} ${model.detail}`.toLowerCase().includes(query))
      : RECOMMENDED_MODELS;
  }, [search]);

  return (
    <div className="workbench-sidebar flex h-full flex-col bg-[#18181b] text-xs text-[#cccccc]">
      <div className="flex h-9 shrink-0 items-center justify-between px-4">
        <div className="text-[11px] font-medium uppercase tracking-wide text-[#bbbbbb]">Extensions</div>
        <div className="flex items-center gap-0.5 text-[#9d9d9d]">
          {tab === 'plugins' && (
            <button type="button" onClick={inspectPlugin} disabled={!window.plugins} className="rounded p-1 hover:bg-[#2a2d2e] hover:text-white disabled:opacity-40" title="Install from Folder"><FolderPlus size={14} /></button>
          )}
          <button type="button" onClick={tab === 'plugins' ? loadPlugins : loadModels} className="rounded p-1 hover:bg-[#2a2d2e] hover:text-white" title="Refresh"><RefreshCw size={14} /></button>
        </div>
      </div>

      <div className="space-y-2 px-2 pb-2">
        <div className="flex items-center gap-2 border border-[#3c3c3c] bg-[#313131] px-2 py-1 focus-within:border-[#0078d4]">
          <Search size={13} className="shrink-0 text-[#9d9d9d]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={tab === 'plugins' ? 'Search Extensions' : 'Search AI Models'}
            className="min-w-0 flex-1 bg-transparent text-[12px] text-[#cccccc] outline-none placeholder:text-[#8a8a8a]"
          />
        </div>
        <div className="flex border-b border-[#2b2b2b]">
          <button type="button" onClick={() => setTab('plugins')} className={`border-b px-2 py-1.5 text-[11px] ${tab === 'plugins' ? 'border-[#0078d4] text-white' : 'border-transparent text-[#969696] hover:text-white'}`}>Extensions</button>
          <button type="button" onClick={() => setTab('models')} className={`border-b px-2 py-1.5 text-[11px] ${tab === 'models' ? 'border-[#0078d4] text-white' : 'border-transparent text-[#969696] hover:text-white'}`}>AI Models</button>
        </div>
      </div>

      {error && <div className="m-2 flex items-start gap-2 rounded border border-red-400/25 bg-red-400/10 p-2 text-[11px] text-red-300"><AlertCircle size={13} className="mt-0.5 shrink-0" />{error}</div>}

      {tab === 'plugins' ? (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="flex h-7 items-center gap-1 border-y border-[#2b2b2b] px-2 text-[11px] font-semibold uppercase text-[#bbbbbb]">
              <ChevronDown size={13} /> Installed <span className="font-normal text-[#858585]">{filteredPlugins.length}</span>
            </div>
            {filteredPlugins.length === 0 ? (
              <div className="flex flex-col items-center px-5 py-8 text-center">
                <Puzzle size={28} strokeWidth={1.25} className="mb-3 text-[#6f6f6f]" />
                <p className="text-[12px] text-[#cccccc]">No installed extensions</p>
                <p className="mt-1 text-[10px] leading-4 text-[#858585]">Onyx extensions run locally with reviewed workspace permissions.</p>
                <button type="button" onClick={inspectPlugin} disabled={!window.plugins} className="mt-3 flex items-center gap-1.5 bg-[#0e639c] px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-[#1177bb] disabled:opacity-50"><FolderPlus size={13} /> Install from Folder</button>
              </div>
            ) : filteredPlugins.map((plugin) => (
              <div key={plugin.manifest.id} className="group flex gap-2.5 border-b border-[#2b2b2b] px-3 py-3 hover:bg-[#2a2d2e]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#094771] text-[#75beff]"><Package size={21} strokeWidth={1.5} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <h3 className="min-w-0 flex-1 truncate text-[12px] font-semibold text-white">{plugin.manifest.name}</h3>
                    <span className={`shrink-0 text-[9px] ${plugin.active ? 'text-emerald-300' : plugin.enabled ? 'text-amber-300' : 'text-[#858585]'}`}>{plugin.active ? 'Active' : plugin.enabled ? 'Restricted' : 'Disabled'}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#a7a7a7]">{plugin.manifest.description || 'No description provided.'}</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[9px] text-[#858585]"><span className="truncate">{plugin.manifest.publisher || plugin.manifest.id}</span><span>v{plugin.manifest.version}</span><span>·</span><span>{plugin.commandCount} commands</span></div>
                  {plugin.error && <p className="mt-1 text-[10px] text-red-300">{plugin.error}</p>}
                  <div className="mt-2 flex items-center gap-1.5">
                    <button type="button" disabled={busy === plugin.manifest.id} onClick={() => togglePlugin(plugin)} className={`px-2 py-1 text-[10px] font-medium ${plugin.enabled ? 'bg-[#3a3d41] text-white hover:bg-[#45494e]' : 'bg-[#0e639c] text-white hover:bg-[#1177bb]'}`}>{plugin.enabled ? 'Disable' : 'Enable'}</button>
                    <button type="button" disabled={busy === plugin.manifest.id} onClick={() => uninstallPlugin(plugin)} className="p-1 text-[#9d9d9d] hover:bg-[#3a3d41] hover:text-white" title="Uninstall Extension"><Trash2 size={12} /></button>
                  </div>
                </div>
              </div>
            ))}
            <div className="border-t border-[#2b2b2b] px-3 py-3 text-[10px] leading-4 text-[#858585]">
              <p className="font-medium text-[#bbbbbb]">Local extension host</p>
              <p className="mt-1">Install folders containing <code className="text-[#4daafc]">onyx-plugin.json</code>. VS Code Marketplace extensions are not binary-compatible with Onyx.</p>
            </div>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto p-2.5">
          <div className="mb-3 rounded border border-[#303035] bg-[#202023] p-2 text-[11px]"><div className="flex items-center gap-1.5 font-medium text-white"><Cpu size={13} className="text-sky-400" /> Installed by Ollama</div><p className="mt-1 text-[#85858d]">{models.length ? models.map((model) => model.name).join(', ') : 'No models installed.'}</p></div>
          {pullStatus && <p className="mb-2 rounded bg-sky-400/10 p-2 text-[10px] text-sky-300">{pullStatus}</p>}
          <div className="space-y-2">
            {filteredModels.map((model) => {
              const installed = models.some((item) => item.name === model.tag || item.name.startsWith(model.tag.split(':')[0]));
              return <div key={model.tag} className="rounded border border-[#303035] bg-[#202023] p-2.5"><div className="flex items-center justify-between gap-2"><span className="font-medium text-white">{model.name}</span><button type="button" disabled={installed || busy === model.tag} onClick={() => pullModel(model.tag)} className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] ${installed ? 'bg-emerald-400/10 text-emerald-300' : 'bg-[#007acc] text-white hover:bg-[#1686c9]'}`}>{installed ? <><Check size={10} /> Installed</> : <><Download size={10} /> Pull</>}</button></div><p className="mt-1 text-[10px] leading-4 text-[#85858d]">{model.detail}</p></div>;
            })}
          </div>
        </div>
      )}

      {candidate && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#3a3a40] bg-[#222225] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#34343a] p-4"><div><h2 className="text-sm font-semibold text-white">Install {candidate.manifest.name}?</h2><p className="mt-0.5 text-[11px] text-[#85858d]">{candidate.manifest.id} · v{candidate.manifest.version}</p></div><button type="button" onClick={() => setCandidate(null)}><X size={15} /></button></div>
            <div className="p-4"><p className="text-xs leading-5 text-[#b8b8c0]">{candidate.manifest.description || 'This plugin did not provide a description.'}</p><h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[#777780]">Requested permissions</h3><div className="mt-2 space-y-1.5">{(candidate.manifest.permissions || []).length ? candidate.manifest.permissions!.map((permission) => <div key={permission} className="flex items-start gap-2 rounded border border-[#34343a] bg-[#18181b] p-2"><Shield size={13} className="mt-0.5 text-amber-300" /><span><span className="block text-[11px] font-medium text-white">{permission}</span><span className="text-[10px] text-[#85858d]">{PERMISSION_TEXT[permission]}</span></span></div>) : <p className="text-[11px] text-emerald-300">No privileged APIs requested.</p>}</div></div>
            <div className="flex justify-end gap-2 border-t border-[#34343a] px-4 py-3"><button type="button" onClick={() => setCandidate(null)} className="rounded px-3 py-1.5 text-[#b8b8c0] hover:bg-[#303035]">Cancel</button><button type="button" onClick={installCandidate} disabled={busy === candidate.manifest.id} className="rounded bg-[#007acc] px-3 py-1.5 font-medium text-white hover:bg-[#1686c9]">Install and Enable</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
