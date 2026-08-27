export interface ToolchainInfo {
  id: string;
  name: string;
  language: string;
  compiler: string;
  debugger: string;
  versionCmd: string;
  fileExtensions: string[];
  isInstalled?: boolean;
  version?: string;
}

export const SUPPORTED_TOOLCHAINS: ToolchainInfo[] = [
  {
    id: 'cpp-gcc',
    name: 'C/C++ (GCC / GDB)',
    language: 'cpp',
    compiler: 'g++ -std=c++20 -O2',
    debugger: 'gdb',
    versionCmd: 'g++ --version',
    fileExtensions: ['cpp', 'cc', 'cxx', 'c', 'hpp', 'h'],
  },
  {
    id: 'python3',
    name: 'Python 3',
    language: 'python',
    compiler: 'python (bytecode interpreter)',
    debugger: 'pdb (Python Debugger)',
    versionCmd: 'python --version',
    fileExtensions: ['py', 'pyw'],
  },
  {
    id: 'nodejs-ts',
    name: 'TypeScript & Node.js',
    language: 'typescript',
    compiler: 'npx tsx (ESBuild JIT)',
    debugger: 'node --inspect',
    versionCmd: 'node --version',
    fileExtensions: ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'],
  },
  {
    id: 'rust',
    name: 'Rust (rustc / Cargo)',
    language: 'rust',
    compiler: 'rustc -O',
    debugger: 'rust-gdb / lldb',
    versionCmd: 'rustc --version',
    fileExtensions: ['rs'],
  },
  {
    id: 'golang',
    name: 'Go (Go Toolchain)',
    language: 'go',
    compiler: 'go build / go run',
    debugger: 'delve (dlv)',
    versionCmd: 'go version',
    fileExtensions: ['go'],
  },
  {
    id: 'java',
    name: 'Java (JDK / OpenJDK)',
    language: 'java',
    compiler: 'javac',
    debugger: 'jdb',
    versionCmd: 'java -version',
    fileExtensions: ['java', 'class'],
  },
];

export interface Breakpoint {
  id: string;
  filePath: string;
  fileName: string;
  line: number;
  enabled: boolean;
}

export interface WatchExpression {
  id: string;
  expression: string;
  value?: string;
  type?: string;
}

export interface DebugVariable {
  name: string;
  value: string;
  type: string;
}

export interface StackFrame {
  id: string;
  name: string;
  file: string;
  line: number;
}

export function getToolchainForFile(fileName: string): ToolchainInfo {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const match = SUPPORTED_TOOLCHAINS.find((t) => t.fileExtensions.includes(ext));
  return match || SUPPORTED_TOOLCHAINS[0];
}
