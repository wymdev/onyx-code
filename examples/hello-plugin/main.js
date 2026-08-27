module.exports.activate = function activate(api) {
  api.registerCommand('hello', 'Hello Plugin: Show Message', function runHelloCommand() {
    api.showMessage('Hello from an installed Onyx plugin.');
    return { success: true };
  });
};
