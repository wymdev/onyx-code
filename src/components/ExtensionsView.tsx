import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  Cpu,
  Download,
  FolderPlus,
  Globe,
  Loader2,
  Package,
  Puzzle,
  RefreshCw,
  Search,
  Shield,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { getLocalModels, OllamaModelInfo, pullOllamaModelStream } from '../services/ollama';
import { InstalledOnyxPlugin, OnyxPluginManifest, PluginPermission } from '../types';
import { plugins as pluginsBridge } from '../platform/plugins';
import { marketplaceService, OnlineExtension } from '../services/marketplaceService';

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
  const [tab, setTab] = useState<'marketplace' | 'installed' | 'models'>('marketplace');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'Theme' | 'Tool' | 'Language'>('all');
  const [search, setSearch] = useState('');
  const [onlineExtensions, setOnlineExtensions] = useState<OnlineExtension[]>([]);
  const [isSearchingOnline, setIsSearchingOnline] = useState(false);
  const [plugins, setPlugins] = useState<InstalledOnyxPlugin[]>([]);
  const [models, setModels] = useState<OllamaModelInfo[]>([]);
  const [candidate, setCandidate] = useState<{ sourcePath: string; manifest: OnyxPluginManifest } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pullStatus, setPullStatus] = useState<string | null>(null);

  const loadPlugins = async () => {
    try {
      setPlugins(await pluginsBridge.list());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to load plugins');
    }
  };

  const loadModels = async () => setModels(await getLocalModels());

  const fetchOnlineExtensions = async (query = '') => {
    setIsSearchingOnline(true);
    try {
      const results = await marketplaceService.search(query);
      setOnlineExtensions(results);
    } catch {
      // Keep existing list on failure
    } finally {
      setIsSearchingOnline(false);
    }
  };

  useEffect(() => {
    loadPlugins();
    loadModels();
    fetchOnlineExtensions();
  }, []);

  // Debounced search for marketplace
  useEffect(() => {
    if (tab !== 'marketplace') return;
    const timer = setTimeout(() => {
      fetchOnlineExtensions(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, tab]);

  const inspectPlugin = async () => {
    setError(null);
    try {
      const result = await pluginsBridge.inspect();
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
      const result = await pluginsBridge.install({
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

  const handleInstallOnline = async (ext: OnlineExtension) => {
    setBusy(ext.id);
    setError(null);
    try {
      const res = await marketplaceService.install(ext);
      setStatusMessage(res.message);
      setTimeout(() => setStatusMessage(null), 4000);
      await fetchOnlineExtensions(search);
      await loadPlugins();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Installation failed');
    } finally {
      setBusy(null);
    }
  };

  const handleUninstallOnline = async (ext: OnlineExtension) => {
    setBusy(ext.id);
    try {
      await marketplaceService.uninstall(ext.id);
      setStatusMessage(`Uninstalled ${ext.displayName}`);
      setTimeout(() => setStatusMessage(null), 3000);
      await fetchOnlineExtensions(search);
    } finally {
      setBusy(null);
    }
  };

  const togglePlugin = async (plugin: InstalledOnyxPlugin) => {
    setBusy(plugin.manifest.id);
    try {
      setPlugins(await pluginsBridge.setEnabled(plugin.manifest.id, !plugin.enabled));
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
      await pluginsBridge.uninstall(plugin.manifest.id);
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

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return num.toString();
  };

  const filteredOnline = useMemo(() => {
    if (categoryFilter === 'all') return onlineExtensions;
    return onlineExtensions.filter((e) => e.category === categoryFilter);
  }, [onlineExtensions, categoryFilter]);

  const filteredPlugins = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? plugins.filter(({ manifest }) =>
          `${manifest.name} ${manifest.id} ${manifest.description || ''}`.toLowerCase().includes(query)
        )
      : plugins;
  }, [plugins, search]);

  const filteredModels = useMemo(() => {
    const query = search.toLowerCase().trim();
    return query
      ? RECOMMENDED_MODELS.filter((model) =>
          `${model.name} ${model.tag} ${model.detail}`.toLowerCase().includes(query)
        )
      : RECOMMENDED_MODELS;
  }, [search]);

  return (
    <div className="workbench-sidebar flex h-full flex-col bg-[var(--sidebar-bg,#18181b)] text-xs text-[var(--text-primary,#cccccc)] select-none">
      {/* VS Code Standard Sidebar Header - 35px height */}
      <div className="flex h-[35px] shrink-0 items-center justify-between px-3 border-b border-[var(--border-color,#2b2b2b)]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#bbbbbb]">Extensions</span>
        <div className="flex items-center gap-0.5 text-[#858585]">
          <button
            type="button"
            onClick={inspectPlugin}
            disabled={!pluginsBridge.isAvailable()}
            className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#2a2d2e] hover:text-white disabled:opacity-40"
            title="Install from Folder..."
          >
            <FolderPlus size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (tab === 'marketplace') fetchOnlineExtensions(search);
              else if (tab === 'installed') loadPlugins();
              else loadModels();
            }}
            className="flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[#2a2d2e] hover:text-white"
            title="Refresh"
          >
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Search Input Bar - VS Code Style */}
      <div className="p-2 space-y-2 border-b border-[var(--border-color,#2b2b2b)]">
        <div className="flex items-center gap-2 rounded-sm border border-[#3c3c3c] bg-[#252526] px-2 py-1 focus-within:border-[var(--accent-blue,#007acc)]">
          <Search size={13} className="shrink-0 text-[#858585]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={
              tab === 'marketplace'
                ? 'Search Extensions in Marketplace (Open VSX)...'
                : tab === 'installed'
                ? 'Search Installed Extensions...'
                : 'Search AI Models...'
            }
            className="min-w-0 flex-1 bg-transparent text-[12px] text-white outline-none placeholder:text-[#6e6e6e]"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-[#858585] hover:text-white">
              <X size={12} />
            </button>
          )}
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center gap-1 text-[11px]">
          <button
            type="button"
            onClick={() => setTab('marketplace')}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors ${
              tab === 'marketplace' ? 'bg-[#007acc] text-white font-medium' : 'text-[#858585] hover:text-white'
            }`}
          >
            <Globe size={11} />
            <span>Marketplace</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('installed')}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors ${
              tab === 'installed' ? 'bg-[#007acc] text-white font-medium' : 'text-[#858585] hover:text-white'
            }`}
          >
            <Package size={11} />
            <span>Installed</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('models')}
            className={`flex items-center gap-1 px-2 py-1 rounded-sm transition-colors ${
              tab === 'models' ? 'bg-[#007acc] text-white font-medium' : 'text-[#858585] hover:text-white'
            }`}
          >
            <Cpu size={11} />
            <span>AI Models</span>
          </button>
        </div>

        {/* Category Filters for Marketplace */}
        {tab === 'marketplace' && (
          <div className="flex items-center gap-1 pt-1 text-[10px] text-[#858585] overflow-x-auto">
            {(['all', 'Theme', 'Tool', 'Language'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-2 py-0.5 rounded-full border transition-colors ${
                  categoryFilter === cat
                    ? 'border-[#007acc] bg-[#007acc]/20 text-white'
                    : 'border-[#3c3c3c] hover:border-[#6e6e6e] text-[#a0a0a0]'
                }`}
              >
                {cat === 'all' ? 'All' : `${cat}s`}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Feedback & Error Notices */}
      {statusMessage && (
        <div className="mx-2 mt-2 flex items-center gap-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 p-2 text-[11px] text-emerald-300">
          <Check size={12} className="shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}
      {error && (
        <div className="mx-2 mt-2 flex items-start gap-1.5 rounded border border-red-400/25 bg-red-400/10 p-2 text-[11px] text-red-300">
          <AlertCircle size={13} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tab 1: Live Marketplace */}
      {tab === 'marketplace' && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#252526]">
          <div className="flex items-center justify-between px-3 py-1.5 text-[10px] font-medium text-[#777777] uppercase tracking-wider bg-[var(--titlebar-bg,#1f1f23)]">
            <span>Open VSX Online Registry</span>
            {isSearchingOnline && <Loader2 size={11} className="animate-spin text-[#007acc]" />}
          </div>

          {filteredOnline.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center text-[#858585]">
              <Package size={24} className="mb-2 text-[#555555]" />
              <p className="text-[12px] text-[#cccccc]">No extensions found</p>
              <p className="mt-1 text-[10px]">Try searching for "theme", "dracula", "python", or "prettier".</p>
            </div>
          ) : (
            filteredOnline.map((ext) => (
              <div
                key={ext.id}
                className="group flex gap-2.5 p-3 transition-colors hover:bg-[var(--bg-hover,#2a2d2e)]"
              >
                {/* Extension Icon */}
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-[#252526] border border-[#333333] overflow-hidden">
                  {ext.iconUrl ? (
                    <img
                      src={ext.iconUrl}
                      alt=""
                      className="h-8 w-8 object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Package size={20} className="text-[#007acc]" />
                  )}
                </div>

                {/* Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-1">
                    <h3 className="truncate text-[12px] font-semibold text-white group-hover:text-[#4daafc]">
                      {ext.displayName}
                    </h3>
                    <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded bg-[#2d2d2d] text-[#858585]">
                      {ext.category}
                    </span>
                  </div>

                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-[#a0a0a0]">{ext.description}</p>

                  {/* Metadata line: publisher, version, stars, downloads */}
                  <div className="mt-1 flex items-center gap-2 text-[9px] text-[#777777]">
                    <span className="truncate text-[#9d9d9d] font-medium">{ext.namespace}</span>
                    <span>v{ext.version}</span>
                    <span className="flex items-center gap-0.5 text-amber-300/80">
                      <Star size={9} fill="currentColor" />
                      {ext.averageRating}
                    </span>
                    <span>· {formatNumber(ext.downloadCount)}</span>
                  </div>

                  {/* Install / Action Button */}
                  <div className="mt-2 flex items-center gap-2">
                    {ext.installed ? (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleInstallOnline(ext)}
                          className="flex items-center gap-1 rounded bg-[#2d2d2d] px-2 py-1 text-[10px] font-medium text-emerald-400 hover:bg-[#383838]"
                          title="Click to apply"
                        >
                          <Check size={11} /> Installed
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUninstallOnline(ext)}
                          className="p-1 rounded text-[#858585] hover:bg-[#333333] hover:text-white"
                          title="Uninstall extension"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        disabled={busy === ext.id}
                        onClick={() => handleInstallOnline(ext)}
                        className="flex items-center gap-1 rounded bg-[#007acc] px-2.5 py-1 text-[10px] font-semibold text-white hover:bg-[#1177bb] transition-colors disabled:opacity-50"
                      >
                        {busy === ext.id ? (
                          <>
                            <Loader2 size={10} className="animate-spin" /> Installing...
                          </>
                        ) : (
                          <>
                            <Download size={10} /> Install
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 2: Installed Plugins (Local & Online) */}
      {tab === 'installed' && (
        <div className="flex-1 overflow-y-auto divide-y divide-[#252526]">
          <div className="flex h-7 items-center justify-between px-3 text-[10px] font-medium uppercase tracking-wider text-[#777777] bg-[var(--titlebar-bg,#1f1f23)]">
            <span>Installed ({filteredPlugins.length})</span>
            <button
              type="button"
              onClick={inspectPlugin}
              className="text-[#007acc] hover:underline"
            >
              + Install from Folder
            </button>
          </div>

          {filteredPlugins.length === 0 ? (
            <div className="flex flex-col items-center px-4 py-8 text-center text-[#858585]">
              <Puzzle size={24} className="mb-2 text-[#555555]" />
              <p className="text-[12px] text-[#cccccc]">No local plugins installed</p>
              <button
                type="button"
                onClick={inspectPlugin}
                className="mt-3 flex items-center gap-1.5 bg-[#007acc] px-2.5 py-1.5 text-[11px] font-medium text-white rounded hover:bg-[#1177bb]"
              >
                <FolderPlus size={13} /> Install from Folder...
              </button>
            </div>
          ) : (
            filteredPlugins.map((plugin) => (
              <div key={plugin.manifest.id} className="group flex gap-2.5 p-3 hover:bg-[var(--bg-hover,#2a2d2e)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#094771] text-[#75beff] rounded">
                  <Package size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between">
                    <h3 className="truncate text-[12px] font-semibold text-white">{plugin.manifest.name}</h3>
                    <span
                      className={`text-[9px] ${
                        plugin.active ? 'text-emerald-400' : plugin.enabled ? 'text-amber-300' : 'text-[#858585]'
                      }`}
                    >
                      {plugin.active ? 'Active' : plugin.enabled ? 'Restricted' : 'Disabled'}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-[10px] text-[#858585]">
                    {plugin.manifest.description || 'No description provided.'}
                  </p>
                  <div className="mt-2 flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busy === plugin.manifest.id}
                      onClick={() => togglePlugin(plugin)}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                        plugin.enabled ? 'bg-[#3a3d41] text-white hover:bg-[#45494e]' : 'bg-[#007acc] text-white'
                      }`}
                    >
                      {plugin.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      type="button"
                      disabled={busy === plugin.manifest.id}
                      onClick={() => uninstallPlugin(plugin)}
                      className="p-1 text-[#858585] hover:bg-[#3a3d41] hover:text-white rounded"
                      title="Uninstall"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab 3: Ollama Models */}
      {tab === 'models' && (
        <div className="flex-1 overflow-y-auto p-2.5 space-y-2">
          <div className="rounded border border-[#303035] bg-[#202023] p-2 text-[11px]">
            <div className="flex items-center gap-1.5 font-medium text-white">
              <Cpu size={13} className="text-sky-400" /> Installed Models
            </div>
            <p className="mt-1 text-[#85858d]">
              {models.length ? models.map((m) => m.name).join(', ') : 'No models installed.'}
            </p>
          </div>

          {pullStatus && <p className="rounded bg-sky-400/10 p-2 text-[10px] text-sky-300">{pullStatus}</p>}

          <div className="space-y-2">
            {filteredModels.map((model) => {
              const installed = models.some(
                (item) => item.name === model.tag || item.name.startsWith(model.tag.split(':')[0])
              );
              return (
                <div key={model.tag} className="rounded border border-[#303035] bg-[#202023] p-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-white">{model.name}</span>
                    <button
                      type="button"
                      disabled={installed || busy === model.tag}
                      onClick={() => pullModel(model.tag)}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] ${
                        installed
                          ? 'bg-emerald-400/10 text-emerald-300'
                          : 'bg-[#007acc] text-white hover:bg-[#1686c9]'
                      }`}
                    >
                      {installed ? (
                        <>
                          <Check size={10} /> Installed
                        </>
                      ) : (
                        <>
                          <Download size={10} /> Pull
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1 text-[10px] leading-4 text-[#85858d]">{model.detail}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Candidate Modal for Folder-based install */}
      {candidate && (
        <div className="fixed inset-0 z-[260] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#3a3a40] bg-[#222225] shadow-2xl">
            <div className="flex items-start justify-between border-b border-[#34343a] p-4">
              <div>
                <h2 className="text-sm font-semibold text-white">Install {candidate.manifest.name}?</h2>
                <p className="mt-0.5 text-[11px] text-[#85858d]">
                  {candidate.manifest.id} · v{candidate.manifest.version}
                </p>
              </div>
              <button type="button" onClick={() => setCandidate(null)}>
                <X size={15} />
              </button>
            </div>
            <div className="p-4">
              <p className="text-xs leading-5 text-[#b8b8c0]">
                {candidate.manifest.description || 'This plugin did not provide a description.'}
              </p>
              <h3 className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-[#777780]">
                Requested permissions
              </h3>
              <div className="mt-2 space-y-1.5">
                {(candidate.manifest.permissions || []).length ? (
                  candidate.manifest.permissions!.map((permission) => (
                    <div key={permission} className="flex items-start gap-2 rounded border border-[#34343a] bg-[#18181b] p-2">
                      <Shield size={13} className="mt-0.5 text-amber-300" />
                      <span>
                        <span className="block text-[11px] font-medium text-white">{permission}</span>
                        <span className="text-[10px] text-[#85858d]">{PERMISSION_TEXT[permission]}</span>
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-emerald-300">No privileged APIs requested.</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#34343a] px-4 py-3">
              <button
                type="button"
                onClick={() => setCandidate(null)}
                className="rounded px-3 py-1.5 text-[#b8b8c0] hover:bg-[#303035]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={installCandidate}
                disabled={busy === candidate.manifest.id}
                className="rounded bg-[#007acc] px-3 py-1.5 font-medium text-white hover:bg-[#1686c9]"
              >
                Install and Enable
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
