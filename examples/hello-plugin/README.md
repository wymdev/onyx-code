# Hello Onyx Plugin

Install this folder from **Extensions → Local Plugins → Install from Folder**.

After installation, open the Command Palette and run **Hello Plugin: Show Message**.

An Onyx plugin contains an `onyx-plugin.json` manifest and an optional JavaScript entry file exporting `activate(api)`. Supported permissions are:

- `commands`: register Command Palette commands.
- `workspace.read`: read text files inside a trusted workspace.
- `workspace.write`: create or update text files inside a trusted workspace.

Plugin JavaScript runs in a sandbox without Node `require`, `process`, or unrestricted filesystem access. Only approved APIs are provided.
