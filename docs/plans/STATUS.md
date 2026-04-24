# Plans — Status Tracker

Quick at-a-glance status of every plan in [`docs/plans/`](.). For execution order, descriptions, and dependencies, see [README.md](./README.md). For full implementation detail, open the individual plan file.

**Summary:** 9 shipped · 2 partially shipped · 4 pending · **13 total**

| # | Plan | Status | Notes |
|---|------|--------|-------|
| 01 | [Webcam Position Cycling Hotkey](./01-webcam-position-cycling.md) | ✅ Shipped | `Ctrl+Shift+E` cycles through four corners |
| 02 | [Recording Region Outline](./02-recording-region-outline.md) | ✅ Shipped | Dashed light-gray border around capture region |
| 03 | [Microphone Audio Recording](./03-microphone-audio-recording.md) | ✅ Partial | MIC + live audio level indicator shipped; **SYS audio deferred** |
| 04 | [Phase 6: Region-Sized Overlay + DPI + Multi-Monitor](./04-phase-6-region-sizing-and-dpi.md) | ✅ Partial | Region-sized overlay + outline + drawing-transparency shipped; **DPI scaling, gdigrab DPI fix, ripple cap, multi-monitor pending** |
| 05 | [Timeout Investigation](./05-timeout-investigation.md) | ✅ Shipped | Research only — root cause was Claude Code's Monitor tool, no app fix needed |
| 06 | [Pill Buttons Blocked by Overlay](./06-pill-buttons-blocked-by-overlay.md) | ✅ Resolved | Auto-fixed by Plan 04 (region-sized overlay no longer covers pill area) |
| 07 | [Context-Aware `Ctrl+Shift+S`](./07-stop-recording-hotkey.md) | ✅ Shipped | Toggles screenshot ↔ stop-recording based on app state |
| 08 | [WebView2 Content Drift Root-Cause Fix](./08-webview-content-drift-root-cause.md) | 🚧 Pending | Workaround (larger outline pad) shipped; proper fix via WndProc subclass / DWM frame extension still owed |
| 09 | [Window Capture Mode](./09-window-capture-mode.md) | 🚧 Pending | "Window" option in capture-mode dropdown is currently a no-op |
| 10 | [Proactive FFmpeg First-Run UX](./10-ffmpeg-proactive-first-run-ux.md) | 🚧 Pending | Minimal fix (spinner + auto-proceed) shipped; proactive install banner pending |
| 11 | [WebView2 Camera Permission Intercept](./11-webview2-permission-intercept.md) | ✅ Shipped | Rust `PermissionRequested` handler + Klipp-branded `PermissionConsentModal` + persisted consent in `settings.json`. Chromium dialog never surfaces. |
| 12 | [Compact Pill-Mode Launch](./12-compact-pill-launch-mode.md) | ✅ Shipped | Two-row pill (560×90) with native OS popup menus for Mode/Delay/Options. Auto-resizes to fit captured region after Snip. TitleBar nav reordered to match pill sequence. |
| 13 | [Recording File-Size Optimization](./13-recording-file-size-optimization.md) | 🚧 Pending | Settings toggle "Smaller recording files" (~50% reduction via `veryfast`/crf 26 + `aac 96k`) + silent hardware-encoder auto-detect (NVENC/QSV/AMF). |

## Legend

- ✅ **Shipped** — fully implemented, in current release
- ✅ **Partial** — core shipped, some sub-items deferred (see Notes)
- ✅ **Resolved** — no implementation needed (auto-fixed by another plan or non-issue)
- 🚧 **Pending** — written but not yet implemented
- ❌ **Superseded** — abandoned or merged into another plan

## Maintenance

When a plan ships:
1. Update its individual file with `> **Status**: ✅ Completed YYYY-MM-DD — commit <sha>` at the top.
2. Flip the row in this table from 🚧 → ✅.
3. Update the **Summary** counts in the second line of this file.
