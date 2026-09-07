import { CompilerConfig, CppCompilerInfo, DiagnosticItem, RunOutputEvent, RunStatusEvent, ToolchainInfo } from '../types';

type ProfileId = 'powershell' | 'cmd' | 'gitbash';

function bridge() {
  return window.runtime;
}

export const runtime = {
  isAvailable(): boolean {
    return Boolean(bridge());
  },
  hasInteractiveTerminal(): boolean {
    return Boolean(bridge()?.createTerminal);
  },
  async runCurrentFile(filePath: string): Promise<void> {
    await bridge()?.runCurrentFile(filePath);
  },
  async compileCppFile(
    filePath: string,
    runAfter = false
  ): Promise<{ success: boolean; diagnostics: DiagnosticItem[]; output?: string } | undefined> {
    return bridge()?.compileCppFile?.(filePath, runAfter);
  },
  async compileFile(
    filePath: string,
    config?: CompilerConfig,
    runAfter = false
  ): Promise<{
    success: boolean;
    diagnostics?: DiagnosticItem[];
    output?: string;
    assembly?: string;
    assemblyPath?: string;
    error?: string;
  } | undefined> {
    if (bridge()?.compileFile) {
      return bridge()?.compileFile(filePath, config, runAfter);
    }
    return {
      success: false,
      error: 'Compilers (gcc/g++/rustc/go) run on local host binaries and require the Electron desktop app ("npm run dev").',
    };
  },
  async detectCppCompilers(): Promise<CppCompilerInfo[] | undefined> {
    return bridge()?.detectCppCompilers?.() || [];
  },
  async detectAllToolchains(): Promise<ToolchainInfo[] | undefined> {
    return bridge()?.detectAllToolchains?.() || [];
  },
  async cleanBuildArtifacts(targetDir?: string): Promise<{ success: boolean; count: number; error?: string } | undefined> {
    return bridge()?.cleanBuildArtifacts?.(targetDir);
  },
  async stopRun(): Promise<void> {
    await bridge()?.stopRun();
  },
  async restartRun(): Promise<void> {
    await bridge()?.restartRun();
  },
  onRunOutput(callback: (payload: RunOutputEvent) => void): () => void {
    return bridge()?.onRunOutput(callback) ?? (() => {});
  },
  onRunStatus(callback: (payload: RunStatusEvent) => void): () => void {
    return bridge()?.onRunStatus(callback) ?? (() => {});
  },
  onDiagnostics(callback: (diagnostics: DiagnosticItem[]) => void): () => void {
    return bridge()?.onDiagnostics?.(callback) ?? (() => {});
  },
  async runTerminalCommand(command: string): Promise<{ stdout: string; stderr: string; exitCode: number } | undefined> {
    if (bridge()?.runTerminalCommand) {
      return bridge()?.runTerminalCommand(command);
    }
    return {
      stdout: '',
      stderr: 'Terminal shell execution requires the Electron desktop app ("npm run dev"). Web browser sandboxes block terminal spawning.',
      exitCode: 1,
    };
  },
  async getTerminalProfiles(): Promise<Array<{ id: ProfileId; label: string; available: boolean }> | undefined> {
    return bridge()?.getTerminalProfiles?.();
  },
  createTerminal(payload: { id: string; profile: ProfileId; cols?: number; rows?: number }): void {
    bridge()?.createTerminal?.(payload);
  },
  onTerminalData(callback: (payload: { id: string; data: string }) => void): () => void {
    return bridge()?.onTerminalData?.(callback) ?? (() => {});
  },
  onTerminalExit(callback: (payload: { id: string; exitCode: number }) => void): () => void {
    return bridge()?.onTerminalExit?.(callback) ?? (() => {});
  },
  sendTerminalInput(id: string, data: string): void {
    bridge()?.sendTerminalInput?.(id, data);
  },
  resizeTerminal(id: string, cols: number, rows: number): void {
    bridge()?.resizeTerminal?.(id, cols, rows);
  },
  killTerminal(id: string): void {
    bridge()?.killTerminal?.(id);
  },
};
