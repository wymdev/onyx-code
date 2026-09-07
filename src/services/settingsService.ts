export type ColorThemeId =
  | 'dark'
  | 'vscode-dark'
  | 'light'
  | 'system'
  | 'dracula'
  | 'one-dark-pro'
  | 'tokyo-night'
  | 'github-dark'
  | 'monokai';

export interface ThemeConfig {
  id: ColorThemeId;
  name: string;
  type: 'dark' | 'light';
  preview: {
    bg: string;
    sidebar: string;
    accent: string;
    text: string;
  };
  colors: {
    bgPrimary: string;
    bgSecondary: string;
    bgTertiary: string;
    bgHover: string;
    bgActive: string;
    borderColor: string;
    borderActive: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    accentBlue: string;
    titlebarBg: string;
    activityBarBg: string;
    sidebarBg: string;
    editorBg: string;
    panelBg: string;
    statusBarBg: string;
  };
  monacoRules: Array<{ token: string; foreground?: string; fontStyle?: string }>;
}

export const THEME_CONFIGS: Record<ColorThemeId, ThemeConfig> = {
  dark: {
    id: 'dark',
    name: 'VS Code Dark+ (Default)',
    type: 'dark',
    preview: { bg: '#1e1e1e', sidebar: '#252526', accent: '#007acc', text: '#cccccc' },
    colors: {
      bgPrimary: '#1e1e1e',
      bgSecondary: '#252526',
      bgTertiary: '#2d2d2d',
      bgHover: '#3c3c3c',
      bgActive: '#37373d',
      borderColor: '#2b2b2b',
      borderActive: '#007acc',
      textPrimary: '#cccccc',
      textSecondary: '#858585',
      textMuted: '#6e6e6e',
      accentBlue: '#007acc',
      titlebarBg: '#323233',
      activityBarBg: '#333333',
      sidebarBg: '#252526',
      editorBg: '#1e1e1e',
      panelBg: '#1e1e1e',
      statusBarBg: '#007acc',
    },
    monacoRules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569cd6' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'type', foreground: '4ec9b0' },
    ],
  },
  'vscode-dark': {
    id: 'vscode-dark',
    name: 'VS Code Dark Modern',
    type: 'dark',
    preview: { bg: '#1f1f1f', sidebar: '#181818', accent: '#0078d4', text: '#cccccc' },
    colors: {
      bgPrimary: '#1f1f1f',
      bgSecondary: '#181818',
      bgTertiary: '#2b2b2b',
      bgHover: '#2a2d2e',
      bgActive: '#37373d',
      borderColor: '#2b2b2b',
      borderActive: '#0078d4',
      textPrimary: '#cccccc',
      textSecondary: '#9d9d9d',
      textMuted: '#737373',
      accentBlue: '#0078d4',
      titlebarBg: '#181818',
      activityBarBg: '#181818',
      sidebarBg: '#181818',
      editorBg: '#1f1f1f',
      panelBg: '#181818',
      statusBarBg: '#181818',
    },
    monacoRules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '4daafc' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'type', foreground: '4ec9b0' },
    ],
  },
  light: {
    id: 'light',
    name: 'VS Code Light Modern',
    type: 'light',
    preview: { bg: '#ffffff', sidebar: '#f3f3f3', accent: '#007acc', text: '#3b3b3b' },
    colors: {
      bgPrimary: '#ffffff',
      bgSecondary: '#f3f3f3',
      bgTertiary: '#e8e8e8',
      bgHover: '#e4e6f1',
      bgActive: '#d0d4e4',
      borderColor: '#d4d4d4',
      borderActive: '#007acc',
      textPrimary: '#3b3b3b',
      textSecondary: '#616161',
      textMuted: '#767676',
      accentBlue: '#007acc',
      titlebarBg: '#dddddd',
      activityBarBg: '#2c2c2c',
      sidebarBg: '#f3f3f3',
      editorBg: '#ffffff',
      panelBg: '#f8f8f8',
      statusBarBg: '#007acc',
    },
    monacoRules: [
      { token: 'comment', foreground: '008000', fontStyle: 'italic' },
      { token: 'keyword', foreground: '0000ff' },
      { token: 'string', foreground: 'a31515' },
      { token: 'number', foreground: '098658' },
      { token: 'function', foreground: '795e26' },
      { token: 'type', foreground: '267f99' },
    ],
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula Official',
    type: 'dark',
    preview: { bg: '#282a36', sidebar: '#21222c', accent: '#bd93f9', text: '#f8f8f2' },
    colors: {
      bgPrimary: '#282a36',
      bgSecondary: '#21222c',
      bgTertiary: '#343746',
      bgHover: '#44475a',
      bgActive: '#44475a',
      borderColor: '#343746',
      borderActive: '#bd93f9',
      textPrimary: '#f8f8f2',
      textSecondary: '#9ca0b0',
      textMuted: '#6272a4',
      accentBlue: '#bd93f9',
      titlebarBg: '#191a21',
      activityBarBg: '#191a21',
      sidebarBg: '#21222c',
      editorBg: '#282a36',
      panelBg: '#21222c',
      statusBarBg: '#191a21',
    },
    monacoRules: [
      { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff79c6' },
      { token: 'string', foreground: 'f1fa8c' },
      { token: 'number', foreground: 'bd93f9' },
      { token: 'function', foreground: '50fa7b' },
      { token: 'type', foreground: '8be9fd' },
    ],
  },
  'one-dark-pro': {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    type: 'dark',
    preview: { bg: '#282c34', sidebar: '#21252b', accent: '#61afef', text: '#abb2bf' },
    colors: {
      bgPrimary: '#282c34',
      bgSecondary: '#21252b',
      bgTertiary: '#2c313a',
      bgHover: '#353b45',
      bgActive: '#3e4451',
      borderColor: '#181a1f',
      borderActive: '#61afef',
      textPrimary: '#abb2bf',
      textSecondary: '#828997',
      textMuted: '#5c6370',
      accentBlue: '#61afef',
      titlebarBg: '#21252b',
      activityBarBg: '#21252b',
      sidebarBg: '#21252b',
      editorBg: '#282c34',
      panelBg: '#21252b',
      statusBarBg: '#21252b',
    },
    monacoRules: [
      { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'c678dd' },
      { token: 'string', foreground: '98c379' },
      { token: 'number', foreground: 'd19a66' },
      { token: 'function', foreground: '61afef' },
      { token: 'type', foreground: 'e5c07b' },
    ],
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    type: 'dark',
    preview: { bg: '#1a1b26', sidebar: '#16161e', accent: '#7aa2f7', text: '#c0caf5' },
    colors: {
      bgPrimary: '#1a1b26',
      bgSecondary: '#16161e',
      bgTertiary: '#24283b',
      bgHover: '#292e42',
      bgActive: '#343b58',
      borderColor: '#1f2335',
      borderActive: '#7aa2f7',
      textPrimary: '#c0caf5',
      textSecondary: '#9aa5ce',
      textMuted: '#565f89',
      accentBlue: '#7aa2f7',
      titlebarBg: '#16161e',
      activityBarBg: '#16161e',
      sidebarBg: '#16161e',
      editorBg: '#1a1b26',
      panelBg: '#16161e',
      statusBarBg: '#16161e',
    },
    monacoRules: [
      { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'bb9af7' },
      { token: 'string', foreground: '9ece6a' },
      { token: 'number', foreground: 'ff9e64' },
      { token: 'function', foreground: '7aa2f7' },
      { token: 'type', foreground: '2ac3de' },
    ],
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    type: 'dark',
    preview: { bg: '#0d1117', sidebar: '#010409', accent: '#2f81f7', text: '#c9d1d9' },
    colors: {
      bgPrimary: '#0d1117',
      bgSecondary: '#010409',
      bgTertiary: '#161b22',
      bgHover: '#21262d',
      bgActive: '#30363d',
      borderColor: '#21262d',
      borderActive: '#2f81f7',
      textPrimary: '#c9d1d9',
      textSecondary: '#8b949e',
      textMuted: '#6e7681',
      accentBlue: '#2f81f7',
      titlebarBg: '#010409',
      activityBarBg: '#010409',
      sidebarBg: '#010409',
      editorBg: '#0d1117',
      panelBg: '#010409',
      statusBarBg: '#010409',
    },
    monacoRules: [
      { token: 'comment', foreground: '8b949e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'ff7b72' },
      { token: 'string', foreground: 'a5d6ff' },
      { token: 'number', foreground: '79c0ff' },
      { token: 'function', foreground: 'd2a8ff' },
      { token: 'type', foreground: 'ffa657' },
    ],
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai Pro',
    type: 'dark',
    preview: { bg: '#272822', sidebar: '#1e1f1c', accent: '#a6e22e', text: '#f8f8f2' },
    colors: {
      bgPrimary: '#272822',
      bgSecondary: '#1e1f1c',
      bgTertiary: '#383830',
      bgHover: '#49483e',
      bgActive: '#49483e',
      borderColor: '#383830',
      borderActive: '#a6e22e',
      textPrimary: '#f8f8f2',
      textSecondary: '#cfcfc2',
      textMuted: '#75715e',
      accentBlue: '#a6e22e',
      titlebarBg: '#1e1f1c',
      activityBarBg: '#1e1f1c',
      sidebarBg: '#1e1f1c',
      editorBg: '#272822',
      panelBg: '#1e1f1c',
      statusBarBg: '#1e1f1c',
    },
    monacoRules: [
      { token: 'comment', foreground: '75715e', fontStyle: 'italic' },
      { token: 'keyword', foreground: 'f92672' },
      { token: 'string', foreground: 'e6db74' },
      { token: 'number', foreground: 'ae81ff' },
      { token: 'function', foreground: 'a6e22e' },
      { token: 'type', foreground: '66d9ef' },
    ],
  },
  system: {
    id: 'system',
    name: 'Match System',
    type: 'dark',
    preview: { bg: '#1e1e1e', sidebar: '#252526', accent: '#007acc', text: '#cccccc' },
    colors: {
      bgPrimary: '#1e1e1e',
      bgSecondary: '#252526',
      bgTertiary: '#2d2d2d',
      bgHover: '#3c3c3c',
      bgActive: '#37373d',
      borderColor: '#2b2b2b',
      borderActive: '#007acc',
      textPrimary: '#cccccc',
      textSecondary: '#858585',
      textMuted: '#6e6e6e',
      accentBlue: '#007acc',
      titlebarBg: '#323233',
      activityBarBg: '#333333',
      sidebarBg: '#252526',
      editorBg: '#1e1e1e',
      panelBg: '#1e1e1e',
      statusBarBg: '#007acc',
    },
    monacoRules: [
      { token: 'comment', foreground: '6a9955', fontStyle: 'italic' },
      { token: 'keyword', foreground: '569cd6' },
      { token: 'string', foreground: 'ce9178' },
      { token: 'number', foreground: 'b5cea8' },
      { token: 'function', foreground: 'dcdcaa' },
      { token: 'type', foreground: '4ec9b0' },
    ],
  },
};

export interface AppSettings {
  autoSave: boolean;
  wordWrap: boolean;
  tabSize: number;
  lineNumbers: boolean;
  theme: ColorThemeId;
  fontSize: number;
  fontFamily: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoSave: false,
  wordWrap: false,
  tabSize: 4,
  lineNumbers: true,
  theme: 'dark',
  fontSize: 14,
  fontFamily: 'Consolas',
};

const STORAGE_KEY = 'onyxcode_settings';

export const settingsService = {
  load(): AppSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_SETTINGS;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_SETTINGS, ...parsed };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  save(settings: AppSettings): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      this.applyTheme(settings.theme);
    } catch {
      console.error('Failed to save settings');
    }
  },

  applyTheme(themeId: ColorThemeId, monacoInstance?: any): void {
    const config = THEME_CONFIGS[themeId] || THEME_CONFIGS.dark;
    const root = document.documentElement;

    root.setAttribute('data-color-theme', themeId);

    // Apply CSS Variables directly
    const s = root.style;
    s.setProperty('--bg-primary', config.colors.bgPrimary);
    s.setProperty('--bg-secondary', config.colors.bgSecondary);
    s.setProperty('--bg-tertiary', config.colors.bgTertiary);
    s.setProperty('--bg-hover', config.colors.bgHover);
    s.setProperty('--bg-active', config.colors.bgActive);
    s.setProperty('--border-color', config.colors.borderColor);
    s.setProperty('--border-active', config.colors.borderActive);
    s.setProperty('--text-primary', config.colors.textPrimary);
    s.setProperty('--text-secondary', config.colors.textSecondary);
    s.setProperty('--text-muted', config.colors.textMuted);
    s.setProperty('--accent-blue', config.colors.accentBlue);
    s.setProperty('--titlebar-bg', config.colors.titlebarBg);
    s.setProperty('--activity-bar-bg', config.colors.activityBarBg);
    s.setProperty('--sidebar-bg', config.colors.sidebarBg);
    s.setProperty('--editor-bg', config.colors.editorBg);
    s.setProperty('--panel-bg', config.colors.panelBg);
    s.setProperty('--status-bar-bg', config.colors.statusBarBg);
    s.setProperty('--workbench-bg', config.colors.bgSecondary);
    s.setProperty('--workbench-sidebar', config.colors.sidebarBg);
    s.setProperty('--workbench-editor', config.colors.editorBg);
    s.setProperty('--workbench-panel', config.colors.panelBg);
    s.setProperty('--workbench-border', config.colors.borderColor);

    // Update Monaco editor if available
    if (monacoInstance) {
      this.defineMonacoThemes(monacoInstance);
      monacoInstance.editor.setTheme(`onyx-${themeId}`);
    }
  },

  defineMonacoThemes(monaco: any): void {
    if (!monaco?.editor) return;

    Object.values(THEME_CONFIGS).forEach((cfg) => {
      monaco.editor.defineTheme(`onyx-${cfg.id}`, {
        base: cfg.type === 'light' ? 'vs' : 'vs-dark',
        inherit: true,
        rules: cfg.monacoRules,
        colors: {
          'editor.background': cfg.colors.editorBg,
          'editor.lineHighlightBackground': cfg.colors.bgHover,
          'editorLineNumber.foreground': cfg.colors.textMuted,
          'editorLineNumber.activeForeground': cfg.colors.textPrimary,
          'editorIndentGuide.background': cfg.colors.bgTertiary,
          'editorIndentGuide.activeBackground': cfg.colors.borderActive,
        },
      });
    });
  },

  matchVSCodeTheme(vsCodeThemeName = ''): ColorThemeId {
    const t = vsCodeThemeName.toLowerCase();
    if (t.includes('dracula')) return 'dracula';
    if (t.includes('one dark')) return 'one-dark-pro';
    if (t.includes('tokyo night')) return 'tokyo-night';
    if (t.includes('github dark')) return 'github-dark';
    if (t.includes('monokai')) return 'monokai';
    if (t.includes('light')) return 'light';
    if (t.includes('modern')) return 'vscode-dark';
    return 'dark';
  },

  importFromVSCode(mapped: Record<string, any>): { updated: Partial<AppSettings>; count: number } {
    const updated: Partial<AppSettings> = {};
    let count = 0;

    if (typeof mapped.fontSize === 'number') {
      updated.fontSize = mapped.fontSize;
      count++;
    }
    if (typeof mapped.fontFamily === 'string') {
      updated.fontFamily = mapped.fontFamily;
      count++;
    }
    if (typeof mapped.tabSize === 'number') {
      updated.tabSize = mapped.tabSize;
      count++;
    }
    if (typeof mapped.wordWrap === 'boolean') {
      updated.wordWrap = mapped.wordWrap;
      count++;
    }
    if (typeof mapped.lineNumbers === 'boolean') {
      updated.lineNumbers = mapped.lineNumbers;
      count++;
    }
    if (typeof mapped.autoSave === 'boolean') {
      updated.autoSave = mapped.autoSave;
      count++;
    }
    if (mapped.theme) {
      updated.theme = this.matchVSCodeTheme(String(mapped.theme));
      count++;
    }

    return { updated, count };
  },
};
