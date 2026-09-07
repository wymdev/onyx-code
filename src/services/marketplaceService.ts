import { ColorThemeId, settingsService } from './settingsService';

export interface OnlineExtension {
  id: string;
  namespace: string;
  name: string;
  displayName: string;
  description: string;
  version: string;
  downloadCount: number;
  averageRating: number;
  iconUrl?: string;
  category: 'Theme' | 'Snippets' | 'Tool' | 'Language' | 'AI';
  downloadUrl?: string;
  installed?: boolean;
  themeId?: ColorThemeId;
}

const INSTALLED_STORAGE_KEY = 'onyxcode_installed_online_extensions';

export const CURATED_EXTENSIONS: OnlineExtension[] = [
  {
    id: 'dracula-theme.theme-dracula',
    namespace: 'dracula-theme',
    name: 'theme-dracula',
    displayName: 'Dracula Official',
    description: 'The famous dark theme for Visual Studio Code, Monaco, and terminal. High-contrast vibrant colors.',
    version: '2.25.1',
    downloadCount: 7421900,
    averageRating: 4.9,
    category: 'Theme',
    iconUrl: 'https://draculatheme.com/static/icons/pack/svg/dracula.svg',
    themeId: 'dracula',
  },
  {
    id: 'zhuangtongfa.material-theme',
    namespace: 'zhuangtongfa',
    name: 'material-theme',
    displayName: 'One Dark Pro',
    description: "Atom's iconic One Dark theme for VS Code, one of the most popular editor themes in the world.",
    version: '3.19.0',
    downloadCount: 8932000,
    averageRating: 4.8,
    category: 'Theme',
    iconUrl: 'https://raw.githubusercontent.com/Binaryify/OneDark-Pro/master/images/icon.png',
    themeId: 'one-dark-pro',
  },
  {
    id: 'enkia.tokyo-night',
    namespace: 'enkia',
    name: 'tokyo-night',
    displayName: 'Tokyo Night',
    description: 'A clean Visual Studio Code dark theme celebrating the lights of Downtown Tokyo at night.',
    version: '1.0.8',
    downloadCount: 2315000,
    averageRating: 4.9,
    category: 'Theme',
    iconUrl: 'https://raw.githubusercontent.com/enkia/tokyo-night-vscode-theme/master/icons/tokyo-night.png',
    themeId: 'tokyo-night',
  },
  {
    id: 'github.github-vscode-theme',
    namespace: 'github',
    name: 'github-vscode-theme',
    displayName: 'GitHub Theme',
    description: "GitHub's official theme suite including GitHub Dark Default and GitHub Light.",
    version: '6.3.4',
    downloadCount: 9240000,
    averageRating: 4.7,
    category: 'Theme',
    iconUrl: 'https://github.githubassets.com/favicons/favicon.png',
    themeId: 'github-dark',
  },
  {
    id: 'monokai.theme-monokai-pro-vscode',
    namespace: 'monokai',
    name: 'theme-monokai-pro-vscode',
    displayName: 'Monokai Pro',
    description: 'Beautiful, sophisticated color scheme engineered by the original author of Monokai.',
    version: '1.2.2',
    downloadCount: 3120000,
    averageRating: 4.8,
    category: 'Theme',
    iconUrl: 'https://monokai.pro/static/favicon.png',
    themeId: 'monokai',
  },
  {
    id: 'esbenp.prettier-vscode',
    namespace: 'esbenp',
    name: 'prettier-vscode',
    displayName: 'Prettier - Code Formatter',
    description: 'Opinionated Code Formatter using Prettier. Enforces a consistent style across files.',
    version: '10.4.0',
    downloadCount: 41200000,
    averageRating: 4.6,
    category: 'Tool',
    iconUrl: 'https://prettier.io/icon.png',
  },
  {
    id: 'dbaeumer.vscode-eslint',
    namespace: 'dbaeumer',
    name: 'vscode-eslint',
    displayName: 'ESLint',
    description: 'Integrates ESLint JavaScript and TypeScript linter into your workspace in real-time.',
    version: '3.0.10',
    downloadCount: 32500000,
    averageRating: 4.5,
    category: 'Tool',
    iconUrl: 'https://eslint.org/favicon.ico',
  },
  {
    id: 'ms-python.python',
    namespace: 'ms-python',
    name: 'python',
    displayName: 'Python Language Support',
    description: 'IntelliSense, linting, code formatting, debugging, and code navigation for Python.',
    version: '2026.2.0',
    downloadCount: 98000000,
    averageRating: 4.4,
    category: 'Language',
    iconUrl: 'https://www.python.org/static/favicon.ico',
  },
  {
    id: 'ms-vscode.cpptools',
    namespace: 'ms-vscode',
    name: 'cpptools',
    displayName: 'C/C++ Toolchain & IntelliSense',
    description: 'C/C++ language support including syntax highlighting, code navigation, and GCC/Clang integration.',
    version: '1.20.5',
    downloadCount: 65000000,
    averageRating: 4.3,
    category: 'Language',
    iconUrl: 'https://isocpp.org/favicon.ico',
  },
  {
    id: 'formulahendry.auto-rename-tag',
    namespace: 'formulahendry',
    name: 'auto-rename-tag',
    displayName: 'Auto Rename Tag',
    description: 'Automatically rename paired HTML/XML/JSX tags as you type.',
    version: '0.1.10',
    downloadCount: 16800000,
    averageRating: 4.6,
    category: 'Tool',
  },
];

export const marketplaceService = {
  getInstalledExtensionIds(): Set<string> {
    try {
      const raw = localStorage.getItem(INSTALLED_STORAGE_KEY);
      if (!raw) return new Set();
      return new Set(JSON.parse(raw));
    } catch {
      return new Set();
    }
  },

  saveInstalledExtensionIds(ids: Set<string>): void {
    try {
      localStorage.setItem(INSTALLED_STORAGE_KEY, JSON.stringify([...ids]));
    } catch (err) {
      console.error('Failed to persist installed extensions', err);
    }
  },

  async search(query = ''): Promise<OnlineExtension[]> {
    const installedIds = this.getInstalledExtensionIds();
    const cleanQuery = query.trim().toLowerCase();

    // Try fetching live from Open VSX Registry
    if (cleanQuery) {
      try {
        const url = `https://open-vsx.org/api/-/search?query=${encodeURIComponent(cleanQuery)}&size=20&sort=downloads`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);

        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data?.extensions) && data.extensions.length > 0) {
            const mapped: OnlineExtension[] = data.extensions.map((ext: any) => {
              const extId = `${ext.namespace}.${ext.name}`;
              const isCurated = CURATED_EXTENSIONS.find((c) => c.id.toLowerCase() === extId.toLowerCase());

              return {
                id: extId,
                namespace: ext.namespace,
                name: ext.name,
                displayName: ext.displayName || ext.name,
                description: ext.description || 'No description provided.',
                version: ext.version || '1.0.0',
                downloadCount: ext.downloadCount || 0,
                averageRating: ext.averageRating || 4.5,
                iconUrl: ext.files?.icon || isCurated?.iconUrl,
                category: isCurated?.category || (ext.name.includes('theme') ? 'Theme' : 'Tool'),
                downloadUrl: ext.files?.download,
                installed: installedIds.has(extId),
                themeId: isCurated?.themeId,
              };
            });

            return mapped;
          }
        }
      } catch {
        // Fall back to curated list if network fails or offline
      }
    }

    // Return curated list filtered by query
    return CURATED_EXTENSIONS.map((ext) => ({
      ...ext,
      installed: installedIds.has(ext.id),
    })).filter((ext) => {
      if (!cleanQuery) return true;
      return (
        ext.displayName.toLowerCase().includes(cleanQuery) ||
        ext.description.toLowerCase().includes(cleanQuery) ||
        ext.name.toLowerCase().includes(cleanQuery) ||
        ext.namespace.toLowerCase().includes(cleanQuery) ||
        ext.category.toLowerCase().includes(cleanQuery)
      );
    });
  },

  async install(extension: OnlineExtension): Promise<{ success: boolean; message: string }> {
    const installedIds = this.getInstalledExtensionIds();
    installedIds.add(extension.id);
    this.saveInstalledExtensionIds(installedIds);

    // If it is a Theme extension, apply it immediately
    if (extension.themeId) {
      const current = settingsService.load();
      const updated = { ...current, theme: extension.themeId };
      settingsService.save(updated);
      settingsService.applyTheme(extension.themeId);
      return {
        success: true,
        message: `Theme '${extension.displayName}' installed and activated!`,
      };
    }

    return {
      success: true,
      message: `'${extension.displayName}' installed successfully!`,
    };
  },

  async uninstall(extensionId: string): Promise<void> {
    const installedIds = this.getInstalledExtensionIds();
    installedIds.delete(extensionId);
    this.saveInstalledExtensionIds(installedIds);
  },
};
