<p align="center">
  <img src="public/icon.png" width="72" height="72" alt="Onyx Code logo" />
</p>

# Onyx Code — Project Documentation

## Overview

Onyx Code is an offline-first desktop IDE built on Electron, React, and TypeScript. It pairs a
VS Code-style editing environment - Monaco editor, file explorer, integrated terminal, Run &
Debug view, Problems panel, Source Control panel, Command Palette - with a local, Ollama-backed
AI assistant that can chat about code or, in Agent Mode, autonomously read/edit files and run
commands inside the open workspace.

There is no cloud dependency for the core workflow: model inference happens entirely through a
local Ollama instance on `127.0.0.1:11434` (or a remote host you point it at on your own LAN).

## Architecture

### Renderer (`src/`)

A React + TypeScript SPA (Vite-built) that owns:

- editor/tab state (`src/App.tsx`, `src/components/EditorArea.tsx`)
- the file explorer tree and workspace root (`src/components/Sidebar.tsx`)
- AI chat state, streaming, and the autonomous agent loop (`src/components/AIChatPanel.tsx`,
  `src/services/agentLoop.ts`)
- settings, theme, and the bottom dock (Problems/Output/Debug/Terminal)
  (`src/services/settingsService.ts`, `src/components/EditorLayout.tsx`)

The renderer talks to Ollama directly over `fetch` (`src/services/ollama.ts`) - no main-process
proxy needed, since it's plain HTTP to localhost. It talks to the OS/filesystem/PTY only through
a narrow `contextBridge` surface exposed by the preload script.

### Main Process (`electron/`)

- `electron/main.ts` - window lifecycle, all file-system IPC handlers, C++/Python/Rust/etc.
  run+build, PTY terminal spawning, git command handlers, and Ollama process management.
- `electron/preload.ts` - the only bridge between renderer and Node/Electron APIs
  (`contextIsolation: true`, `nodeIntegration: false`).
- `electron/database.ts`, `electron/auth.ts`, `electron/feedback.ts` - an optional local
  SQLite-backed auth/feedback subsystem. **Not currently wired into the UI** (no login gate
  exists in `App.tsx`); a database init failure is non-fatal and never blocks the app from
  launching.

### Local AI Layer

- `src/services/ollama.ts` - all Ollama HTTP calls (`/api/generate`, `/api/chat` with tools,
  `/api/tags`, `/api/pull`, `/api/delete`). Status/list requests use `cache: 'no-store'` so a
  stopped server is detected promptly instead of serving a stale cached response.
- `src/services/agentLoop.ts` - the Agent Mode tool-execution loop: `read_file`, `list_directory`,
  `search_files`, `edit_file`, `write_file`, `delete_file`, `run_command`, `update_task_list`,
  `task_complete`. Falls back to a JSON-based tool-call parser for models without native
  tool-calling.
- `electron/main.ts`'s `startOllama()` only auto-spawns a local `ollama serve` when the
  configured host resolves to localhost and nothing's already listening on that port; a remote
  host is left alone entirely.

## Important Feature Areas

### Workspace Security

- `electron/main.ts`'s `assertWorkspacePath()` validates every file-system IPC call (read,
  write, create, delete, edit, run, compile) against the currently open workspace root -
  including calls made on the AI agent's behalf. A path outside the workspace is rejected before
  it touches disk.
- Git and compiler invocations use `execFile`/`spawn` with argv arrays, not shell strings, so
  crafted filenames or commit messages can't inject shell commands.
- `open-local-file` is the one deliberate exception (user-picked files via native dialog, never
  read into the app - only opened via the OS's default handler).

### C++ / Multi-Language Tooling

- `src/services/cppService.ts` - starter templates (hello world, competitive-programming fast
  I/O, OOP, BST, C++20 ranges/concepts) and a Monaco completion provider for common C++
  snippets.
- `src/services/languageService.ts` - the toolchain registry (C++/GCC, Python, TypeScript/Node,
  Rust, Go, Java) used to drive the Run & Debug view's launch-config selector.
- `electron/main.ts`'s `compileAndRunCpp`/`parseCppDiagnostics` - detects an available compiler,
  compiles, and parses GCC/Clang/MSVC diagnostic output into structured entries for the
  Problems panel.

### AI Chat Rendering

- `src/components/AIMessageList.tsx` - full Markdown rendering (`react-markdown` + `remark-gfm`)
  with syntax-highlighted fenced code blocks (`react-syntax-highlighter`). Fence metadata
  (`// FILE:`/`// COMMAND:` markers, delete markers) is parsed once via `extractFences()` and
  reused for both the Apply/Run button chrome and the "Apply All Files" action, so there's a
  single source of truth instead of two independently-parsed regexes.
- Fence-to-metadata matching is done by source offset (via react-markdown's AST node position),
  not by a mutable render-order counter - the latter breaks under React 18 StrictMode's
  double-invocation of render functions.

### Agent Mode's "Pending Changes" (be precise about what this actually does)

`write_file`/`edit_file`/`delete_file` write to the real filesystem immediately when the agent
calls them. `PendingChangesBar` tracks before/after content for each touched file and offers
**Accept** (keep) or **Reject** (best-effort revert: restore original content, or delete a
newly-created file). It is not a pre-commit staging area - nothing is held back from disk while
you review it. Real pre-commit staging (buffering agent writes in memory, reconciling with open
editor tabs and the file-tree/watcher) is a larger architectural change than the current
implementation and is not in place.

## Security Notes

- `contextIsolation: true`, `nodeIntegration: false` on every `BrowserWindow`.
- No hardcoded cloud API keys; the core AI flow is 100% local.
- A top-level React error boundary (`src/components/ErrorBoundary.tsx`) prevents an uncaught
  render error from silently unmounting the whole app into a blank page.

## Current Limitations

- The optional local auth/feedback database has no UI entry point (dead code in the current
  build) - `AuthScreen.tsx` is unused.
- Real pre-commit staging for Agent Mode changes (see above) isn't implemented; treat "Reject"
  as an undo, not a guarantee nothing happened.
- The renderer bundle is a single ~900KB chunk; code-splitting (e.g. lazy-loading Monaco or the
  syntax highlighter's language definitions) hasn't been done yet.

## License

MIT
