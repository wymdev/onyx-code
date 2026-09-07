import { useState } from 'react';
import {
  Check,
  DownloadCloud,
  FileCode2,
  LucideIcon,
  MessageSquare,
  Palette,
  Settings as SettingsIcon,
  X,
} from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import {
  settingsService,
  AppSettings,
  THEME_CONFIGS,
  ColorThemeId,
} from '../services/settingsService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
}

type Tab = 'general' | 'appearance' | 'feedback';

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'appearance', label: 'Appearance & Themes', icon: Palette },
  { id: 'feedback', label: 'Feedback', icon: MessageSquare },
];

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<{ success?: boolean; message?: string } | null>(null);

  if (!isOpen) {
    return null;
  }

  const handleSave = (updated: Partial<AppSettings>) => {
    const next = { ...settings, ...updated };
    onSettingsChange(next);
    settingsService.save(next);
  };

  const handleImportVSCode = async () => {
    setImporting(true);
    setImportStatus(null);
    try {
      if (!window.vscode?.readSettings) {
        setImportStatus({
          success: false,
          message: 'VS Code integration is available in the desktop application.',
        });
        return;
      }

      const res = await window.vscode.readSettings();
      if (!res.success || !res.mapped) {
        setImportStatus({
          success: false,
          message: res.error || 'No VS Code settings found on this machine.',
        });
        return;
      }

      const { updated, count } = settingsService.importFromVSCode(res.mapped);
      if (count > 0) {
        const next = { ...settings, ...updated };
        onSettingsChange(next);
        settingsService.save(next);
        setImportStatus({
          success: true,
          message: `Successfully imported ${count} settings from VS Code (${res.path})!`,
        });
      } else {
        setImportStatus({
          success: true,
          message: `VS Code settings detected at ${res.path}, but all matching values are already applied.`,
        });
      }
    } catch (err) {
      setImportStatus({
        success: false,
        message: err instanceof Error ? err.message : 'Failed to import VS Code settings.',
      });
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative mx-4 flex h-[560px] w-full max-w-[760px] overflow-hidden rounded-xl border border-[#2a2a32] bg-[#1a1a1f] shadow-2xl text-[13px]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Left Nav Sidebar */}
        <div className="flex w-[190px] shrink-0 flex-col border-r border-[#2a2a32] bg-[#0e0e11] select-none">
          <div className="px-4 pb-3 pt-5 text-xs font-semibold uppercase tracking-widest text-[#666688]">Settings</div>
          <nav className="flex flex-col gap-1 px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#007acc] text-white font-medium'
                    : 'text-[#858585] hover:bg-[#1a1a1f] hover:text-[#cccccc]'
                }`}
              >
                <tab.icon size={15} />
                {tab.label}
              </button>
            ))}
          </nav>

          <div className="flex-1" />
          <div className="p-3 border-t border-[#1a1a1f]">
            <button
              type="button"
              onClick={handleImportVSCode}
              disabled={importing}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-[#252526] hover:bg-[#333333] border border-[#3c3c3c] px-2 py-1.5 text-[11px] font-medium text-white transition-colors"
            >
              <DownloadCloud size={13} className="text-[#38bdf8]" />
              <span>Import from VS Code</span>
            </button>
          </div>
          <div className="px-4 py-2 text-[10px] text-[#444455]">Onyx Code v1.0.0</div>
        </div>

        {/* Right Content Area */}
        <div className="flex flex-1 flex-col overflow-hidden bg-[#18181b]">
          <div className="flex items-center justify-between border-b border-[#2a2a32] px-6 py-3.5">
            <h2 className="text-base font-semibold text-[#cccccc]">
              {TABS.find((tab) => tab.id === activeTab)?.label}
            </h2>
            <button
              onClick={onClose}
              className="rounded p-1 text-[#858585] transition-colors hover:bg-[#2a2a32] hover:text-white"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* Import from VS Code Notification / Status Banner */}
            {importStatus && (
              <div
                className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-5 ${
                  importStatus.success
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-400/30 bg-red-400/10 text-red-300'
                }`}
              >
                <FileCode2 size={16} className="shrink-0 mt-0.5" />
                <div className="flex-1">{importStatus.message}</div>
                <button
                  onClick={() => setImportStatus(null)}
                  className="text-[#858585] hover:text-white"
                >
                  <X size={13} />
                </button>
              </div>
            )}

            {/* TAB: GENERAL */}
            {activeTab === 'general' && (
              <div className="flex flex-col gap-6">
                {/* VS Code Settings Integration Box */}
                <div className="rounded-lg border border-[#2a2a32] bg-[#121215] p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                        <FileCode2 size={15} className="text-[#007acc]" />
                        Sync with Visual Studio Code
                      </h3>
                      <p className="mt-1 text-xs text-[#858585]">
                        Automatically read your existing <code className="text-[#38bdf8]">settings.json</code> from VS Code and apply your font, tab size, word wrap, and theme preferences.
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={importing}
                      onClick={handleImportVSCode}
                      className="shrink-0 rounded bg-[#007acc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#1177bb] transition-colors"
                    >
                      {importing ? 'Importing...' : 'Import from VS Code'}
                    </button>
                  </div>
                </div>

                <SettingRow label="Auto Save" description="Automatically save modified files">
                  <Toggle value={settings.autoSave} onChange={(value) => handleSave({ autoSave: value })} />
                </SettingRow>

                <SettingRow label="Word Wrap" description="Wrap long lines in editor view">
                  <Toggle value={settings.wordWrap} onChange={(value) => handleSave({ wordWrap: value })} />
                </SettingRow>

                <SettingRow label="Tab Size" description="Number of spaces per indentation level">
                  <select
                    value={settings.tabSize}
                    onChange={(event) => handleSave({ tabSize: Number(event.target.value) })}
                    className="rounded-md border border-[#2a2a32] bg-[#0e0e11] px-2.5 py-1 text-xs text-[#cccccc] focus:border-[#007acc] focus:outline-none"
                  >
                    {[2, 4, 8].map((size) => (
                      <option key={size} value={size}>
                        {size} spaces
                      </option>
                    ))}
                  </select>
                </SettingRow>

                <SettingRow label="Line Numbers" description="Show line numbers in editor gutter">
                  <Toggle value={settings.lineNumbers} onChange={(value) => handleSave({ lineNumbers: value })} />
                </SettingRow>

                <SettingRow label="Font Size" description="Editor font size in pixels">
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={10}
                      max={32}
                      value={settings.fontSize}
                      onChange={(e) => handleSave({ fontSize: Number(e.target.value) || 14 })}
                      className="w-16 rounded-md border border-[#2a2a32] bg-[#0e0e11] px-2 py-1 text-xs text-white focus:border-[#007acc] focus:outline-none"
                    />
                    <span className="text-xs text-[#858585]">px</span>
                  </div>
                </SettingRow>

                <SettingRow label="Font Family" description="Font family for the code editor">
                  <input
                    type="text"
                    value={settings.fontFamily}
                    onChange={(e) => handleSave({ fontFamily: e.target.value })}
                    className="w-48 rounded-md border border-[#2a2a32] bg-[#0e0e11] px-2.5 py-1 text-xs text-white focus:border-[#007acc] focus:outline-none"
                  />
                </SettingRow>
              </div>
            )}

            {/* TAB: APPEARANCE & THEMES */}
            {activeTab === 'appearance' && (
              <div className="flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-semibold text-white">Color Themes</h3>
                  <p className="mt-0.5 text-xs text-[#858585]">
                    Select a theme preset or install new ones live from the Marketplace in the Extensions view.
                  </p>
                </div>

                {/* Theme Selection Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {(Object.keys(THEME_CONFIGS) as ColorThemeId[]).map((themeId) => {
                    const cfg = THEME_CONFIGS[themeId];
                    const isSelected = settings.theme === themeId;

                    return (
                      <div
                        key={themeId}
                        onClick={() => handleSave({ theme: themeId })}
                        className={`group cursor-pointer rounded-lg border p-3 transition-all ${
                          isSelected
                            ? 'border-[#007acc] bg-[#007acc]/10 ring-1 ring-[#007acc]'
                            : 'border-[#2a2a32] bg-[#121215] hover:border-[#3f3f4e]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-white">{cfg.name}</span>
                          {isSelected && <Check size={14} className="text-[#38bdf8]" />}
                        </div>

                        {/* Color Swatches Preview */}
                        <div className="mt-2.5 flex h-7 w-full overflow-hidden rounded border border-black/30">
                          {/* Sidebar preview */}
                          <div className="w-1/4" style={{ backgroundColor: cfg.preview.sidebar }} />
                          {/* Editor preview */}
                          <div
                            className="relative flex flex-1 items-center px-2 text-[10px]"
                            style={{
                              backgroundColor: cfg.preview.bg,
                              color: cfg.preview.text,
                            }}
                          >
                            <div
                              className="h-1.5 w-6 rounded-full"
                              style={{ backgroundColor: cfg.preview.accent }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB: FEEDBACK */}
            {activeTab === 'feedback' && (
              <div className="max-w-md">
                <FeedbackForm />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-[#242428] pb-4">
      <div>
        <div className="text-xs font-semibold text-[#cccccc]">{label}</div>
        <div className="text-[11px] text-[#858585]">{description}</div>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
        value ? 'bg-[#007acc]' : 'bg-[#2a2a32]'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          value ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}
