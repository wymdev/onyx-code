# Workbench and Agent Chat Design QA

## Evidence

- Source visual truth path: unavailable as a local file; the source is the user's attached VS Code desktop screenshot.
- Source pixels: 1920 × 1053.
- Agent chat visual truth path: unavailable as a local file; the source is the user's attached Codex panel screenshot.
- Agent chat source pixels: 577 × 970.
- Implementation screenshot path: unavailable.
- Implementation pixels / CSS viewport / density: not captured.
- Intended state: macOS desktop workbench using VS Code Dark, plus a Codex-style agent conversation with right-aligned user bubbles, borderless assistant replies, elapsed activity, visible live plans, a reviewable file-change card, and a rounded composer.

## Full-view Comparison

Blocked. The source screenshots are visible in the conversation, but the revised Electron application was not launched or captured. Launching another Electron/watch session was intentionally avoided because the user reported severe memory pressure and hangs on this 8GB Mac.

## Focused-region Comparison

Blocked for the same reason. The Extensions sidebar, account menu, status bar branch, theme-selected workbench, agent activity, message rhythm, and composer cannot be compared visually without a rendered implementation capture.

## Required Fidelity Surfaces

- Fonts and typography: code inspection confirms system UI typography and compact 10–12px sidebar text, but rendered weight, wrapping, and antialiasing are unverified.
- Spacing and layout rhythm: the Extensions view now follows the reference hierarchy—compact title actions, search, tabs, Installed section, and dense list rows—but rendered measurements are unverified.
- Colors and visual tokens: a selectable VS Code Dark palette was added using the reference's `#181818`, `#1f1f1f`, `#2b2b2b`, and `#0078d4` family. Rendered contrast is unverified.
- Image quality and asset fidelity: no raster assets were required. Existing library icons are used for workbench controls.
- Copy and content: Plugins are presented as Onyx Extensions, with explicit copy explaining that VS Code Marketplace packages are not API-compatible.
- Agent conversation structure: code inspection confirms compact right-aligned user bubbles, plain full-width assistant output, `Working/Worked for Ns`, pure shimmer status text, live task-plan details, and functional Undo/Review/Keep actions. Rendered fidelity is unverified.

## Findings

- [P2] Rendered fidelity is unverified.
  - Location: full workbench, Extensions sidebar, and agent chat panel.
  - Evidence: production compilation passes, but no implementation screenshot was captured.
  - Impact: spacing, clipping, theme propagation, and account-menu placement could still differ from the reference.
  - Fix: launch one Onyx instance when memory permits, capture the same viewport/state, and compare it with the reference.

## Open Questions

- None for implementation scope. Native VS Code Marketplace compatibility remains intentionally out of scope; Onyx uses its own sandboxed extension API.

## Implementation Checklist

- Open Settings → Appearance → VS Code Dark.
- Open Extensions and verify search, folder installation, enable/disable, uninstall, and AI-model filtering.
- Open the Accounts control and confirm the macOS/Git identity.
- Open a Git repository and confirm the real branch appears; open a non-repository and confirm no branch is shown.
- Capture and compare the rendered workbench when the machine can safely run Electron.
- Run one short Agent request and confirm tool JSON never renders, the live task list is visible, file actions occur after approval, and the completed activity collapses.

## Comparison History

- No visual iteration was possible because an implementation capture was intentionally not produced.

## Follow-up Polish

- Tune any P3 spacing or icon-alignment drift found in the eventual rendered comparison.

final result: blocked
