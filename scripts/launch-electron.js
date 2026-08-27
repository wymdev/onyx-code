// VS Code's integrated terminal can inherit ELECTRON_RUN_AS_NODE=1 from the
// Electron-based extension host. If that var is set, `electron .` boots as a
// plain Node process instead of the real Electron runtime, so `require('electron')`
// returns a path string instead of the app API and main.js crashes on startup.
delete process.env.ELECTRON_RUN_AS_NODE;

const { spawn } = require('child_process');
const electronPath = require('electron');

const child = spawn(electronPath, ['.'], { stdio: 'inherit', env: process.env });
child.on('exit', (code) => process.exit(code ?? 0));
