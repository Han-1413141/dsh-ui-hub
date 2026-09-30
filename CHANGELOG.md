# Changelog

All notable changes to this project are documented in this file.

## Unreleased

- Keep promotional images in the repository while excluding them from the installable package.

- Add control/plugin/slot search and validated JSON layout export/import.
- Stop idle counter mutation loops and retain trailing discovery after throttled remounts.
- Flush settings on page hide/disposal and support reactivation of the same client module.
- Keep the full launcher in view and clear native Desktop titlebars; exclude native caption controls.
- Add Desktop-aware PowerShell installation, current runtime smoke checks, and Web/Windows/macOS marker regressions.
- Document DSH 0.2.0-rc.2 compatibility and add localized plugin-manager metadata.

## 0.1.0 - 2026-08-15

Initial release.

### Added

- Discovers every plugin UI inside platform `[data-slot]` anchors and floating
  widgets outside slots (marker-based + body-level scan).
- Official UI / plugin UI classification with a two-level collapsible panel
  (category → slot group), all collapsed by default; collapse state persists.
- Per-root and per-child (button / icon / chart / field) show/hide switches.
- Position modes: default, nudge (translate), float (fixed x/y), with numeric
  inputs and the per-item drag handle.
- Global drag mode: drag any UI directly to move it (slot-mounted UIs stay in
  layout via nudge; loose widgets float) and drag its bottom-right grip to
  resize; Esc exits. A drag never re-triggers the button's click, and plain
  clicks still pass through while the mode is on.
- Popup follower: popovers that still open at a floated UI's original spot are
  shifted to the floated position via the independent CSS `translate` property.
- Collision avoidance with off / smart / strict policies and per-item locks.
- One-click auto arrange: right-aligned vertical columns anchored to the
  conversation scrollport.
- Pick mode to capture any unmarked element; Ctrl+Shift+U (⌘⇧U) panel hotkey.
- localStorage persistence and full teardown restoration.
- `window.dshUiHub` debug/programmatic API.
- Mock-DOM Playwright verification suite (`test/verify.py`, 45 checks).
