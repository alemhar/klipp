# Architecture Notes

Short, focused write-ups on the **why** behind some of Klipp's engineering decisions. Each doc answers one question, references the actual source files, and mentions the alternatives that were considered and rejected.

These aren't blog posts — they're notes for people working on (or evaluating) the codebase. If you're adding a substantial new subsystem, consider adding one too.

## Index

1. [Why Konva.js for the annotation canvas](./01-konvajs-canvas-choice.md)
2. [The FFmpeg auto-downloader](./02-ffmpeg-auto-downloader.md)

> More to come — WebView2 transparency on Windows, region-sized overlay with chrome compensation, the global mouse hook, and the FFmpeg filter-complex graph are all candidates.

## Style

- Keep it to ~2–4 screens of scrolling.
- Lead with **what** and **why**; code snippets only when they clarify.
- Link to source files with line numbers when appropriate.
- Include a "Trade-offs" section — future readers need to know what you gave up, not just what you gained.
- End with "When to revisit" — conditions under which the decision should be reconsidered.
