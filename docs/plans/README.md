# Implementation Plans

Sequenced plan documents for remaining overlay work. Each plan is self-contained and can be executed independently in a fresh session.

## Execution Order

1. [01 — Webcam Position Cycling Hotkey](./01-webcam-position-cycling.md) ✅
   `Ctrl+Shift+E` to cycle webcam bubble through four corners of the recording region.

2. [02 — Recording Region Outline](./02-recording-region-outline.md) ✅
   Visible light gray dashed border around the recording region.

3. [03 — Microphone Audio Recording](./03-microphone-audio-recording.md) ✅ (SYS deferred)
   Separate mic + system audio toggles, device selection, FFmpeg mixing. MIC shipped with live audio level indicator. SYS deferred to a future release.

4. [04 — Phase 6: Region-Sized Overlay + DPI + Multi-Monitor](./04-phase-6-region-sizing-and-dpi.md) ✅ (core)
   Region-sized overlay + outline + transparency-during-drawing shipped. DPI scaling, gdigrab DPI fix, ripple cap, and multi-monitor testing still pending (low priority at 100% DPI single-monitor).

5. [05 — Timeout Investigation](./05-timeout-investigation.md) ✅ (no app bug)
   Research task. Root cause was Claude Code's Monitor tool, not the SnippingZo app. No code change required.

6. [06 — Fix: Pill Buttons Blocked by Active Overlay Tool](./06-pill-buttons-blocked-by-overlay.md) ✅ (resolved by Plan 04)
   Auto-fixed — region-sized overlay no longer covers the recording pill area for typical recordings.

7. [07 — Context-Aware `Ctrl+Shift+S` (Screenshot / Stop Recording)](./07-stop-recording-hotkey.md) ✅
   Reuses the existing capture shortcut as a state-dependent toggle: takes a screenshot when idle, stops the recording when one is active. Provides keyboard escape for the Plan 06 blocking bug.

8. [08 — Root-Cause Fix: WebView2 Content Drift on First Interaction](./08-webview-content-drift-root-cause.md) 🚧
   Root-cause fix for the ~8px WebView2 content drift that caused the region outline to be captured on one side. Current release ships a workaround (larger outline pad); proper fix via WndProc subclass or DWM frame extension deferred to a future release.

9. [09 — Window Capture Mode](./09-window-capture-mode.md) 🚧
   The capture-mode dropdown has a "Window" option that currently does nothing. Plan covers enumerating top-level windows, highlighting the one under cursor, and click-to-capture its bounds.

## Dependencies

```
Plan 01 (cycling)     ┐
Plan 02 (outline)     ├─ built on current fullscreen overlay (screen coords)
                      │
Plan 03 (microphone)  ── independent, can run in parallel with others

Plan 04 (Phase 6)     ── revisits Plans 01 and 02 to adapt to window-local coords

Plan 05 (timeout)     ── independent research task

Plan 06 (pill bug)    ── after Plan 04 (Phase 6 may partially fix), last

Plan 07 (stop hotkey) ── independent; mitigates Plan 06 if done earlier
```

## Status Tracking

Mark a plan as complete by adding a line to the top of its file:

```markdown
> **Status**: ✅ Completed YYYY-MM-DD — commit <sha>
```

Or if a plan is abandoned/merged elsewhere:

```markdown
> **Status**: ❌ Superseded by <link>
```

## How to Start a New Session

1. Check this README for the next pending plan.
2. Open that plan doc; it should be self-contained.
3. Verify the "Current State" section still matches reality (run git log, read relevant files).
4. Execute the "Implementation Steps".
5. Run the "Verification" steps.
6. Commit using the suggested commit message.
7. Mark the plan complete in this README.
