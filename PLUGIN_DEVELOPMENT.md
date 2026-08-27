# Onyx Code local plugins

Onyx Code plugins are local, sandboxed JavaScript extensions. They are not VS Code `.vsix` packages; supporting VS Code extensions would require embedding the VS Code extension host and its API surface.

## Install and run the included example

1. Open **Extensions** in the Activity Bar.
2. Select **Local Plugins** and choose **Install from Folder...**.
3. Select `examples/hello-plugin`.
4. Review the requested permissions and choose **Install and Enable**.
5. Open the Command Palette with `Ctrl+Shift+P`.
6. Run **Hello Plugin: Show Message**.

## Plugin structure

Every plugin folder needs an `onyx-plugin.json` manifest:

```json
{
  "id": "publisher.plugin-name",
  "name": "Plugin Name",
  "version": "1.0.0",
  "main": "main.js",
  "permissions": ["commands"]
}
```

The entry file exports an `activate` function:

```js
module.exports.activate = function activate(api) {
  api.registerCommand('hello', 'Plugin: Say Hello', function () {
    api.showMessage('Hello from the plugin.');
  });
};
```

Command IDs are automatically prefixed with the plugin ID unless they already use that prefix.

## APIs and permissions

- `commands`: `api.registerCommand(id, title, handler)` adds a real Command Palette action.
- No permission: `api.showMessage(message)` shows a temporary in-app notification.
- `workspace.read`: `api.workspace.readText(relativePath)` reads UTF-8 text inside the trusted workspace.
- `workspace.write`: `api.workspace.writeText(relativePath, content)` creates or updates UTF-8 text inside the trusted workspace.

Workspace APIs are path-confined to the open project and disabled in Restricted Mode. Plugin code runs without Node `require`, `process`, or unrestricted filesystem access.
