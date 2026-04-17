# Overlay — Remaining Work

Phases 1–5 of the overlay feature are complete. This doc tracks the remaining items. Each has a dedicated self-contained plan doc in [docs/plans/](./plans/) that can be picked up in a fresh session.

## Execution Order

See [docs/plans/README.md](./plans/README.md) for the index and dependency graph.

| # | Task | Plan |
|---|------|------|
| 1 | Webcam position cycling hotkey (`Ctrl+Shift+P`) | [01-webcam-position-cycling.md](./plans/01-webcam-position-cycling.md) |
| 2 | Recording region outline | [02-recording-region-outline.md](./plans/02-recording-region-outline.md) |
| 3 | Microphone audio recording | [03-microphone-audio-recording.md](./plans/03-microphone-audio-recording.md) |
| 4 | Phase 6: region-sized overlay + DPI + multi-monitor | [04-phase-6-region-sizing-and-dpi.md](./plans/04-phase-6-region-sizing-and-dpi.md) |
| 5 | Timeout investigation (research) | [05-timeout-investigation.md](./plans/05-timeout-investigation.md) |
| 6 | Fix: pill buttons blocked by active overlay tool | [06-pill-buttons-blocked-by-overlay.md](./plans/06-pill-buttons-blocked-by-overlay.md) |

## Phase 6 Polish — grouped into Plan 04

- Size overlay to recording region (not full desktop)
- DPI scaling: physical-vs-logical pixel translation
- Cap concurrent ripples at ~10, GPU-accelerated animation
- Multi-monitor support
- Resolves latent gdigrab DPI bug in region selector

## Timeout Investigation — Findings

_To be filled in when Plan 05 is executed. See [plan doc](./plans/05-timeout-investigation.md) for investigation template._
