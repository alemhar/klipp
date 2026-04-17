# Implementation Plans

Sequenced plan documents for remaining overlay work. Each plan is self-contained and can be executed independently in a fresh session.

## Execution Order

1. [01 — Webcam Position Cycling Hotkey](./01-webcam-position-cycling.md)
   `Ctrl+Shift+P` to cycle webcam bubble through four corners of the recording region.

2. [02 — Recording Region Outline](./02-recording-region-outline.md)
   Visible red dashed border around the recording region.

3. [03 — Microphone Audio Recording](./03-microphone-audio-recording.md)
   Separate mic + system audio toggles, device selection, FFmpeg mixing.

4. [04 — Phase 6: Region-Sized Overlay + DPI + Multi-Monitor](./04-phase-6-region-sizing-and-dpi.md)
   Replace fullscreen overlay with region-sized window. Fixes DPI issues and the latent gdigrab bug. Revisits Plans 01 and 02 to adapt to the new coordinate system.

5. [05 — Timeout Investigation](./05-timeout-investigation.md)
   Research task. Identify root cause of timeout errors, document findings.

## Dependencies

```
Plan 01 (cycling)     ┐
Plan 02 (outline)     ├─ built on current fullscreen overlay (screen coords)
                      │
Plan 03 (microphone)  ── independent, can run in parallel with others

Plan 04 (Phase 6)     ── revisits Plans 01 and 02 to adapt to window-local coords

Plan 05 (timeout)     ── last, independent research task
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
