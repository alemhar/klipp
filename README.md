<div align="center">

# Klipp

**A modern, open-source screen capture and screen recording tool for Windows — built in Rust + React.**

A lightweight, native alternative to Microsoft Snipping Tool with real-time annotations during recording, mouse click indicators, webcam overlay, and microphone mixing. Free, MIT-licensed, no accounts, no tracking.

![License: MIT](https://img.shields.io/github/license/alemhar/klipp?color=blue)
![Release](https://img.shields.io/github/v/release/alemhar/klipp?include_prereleases)
![Tauri v2](https://img.shields.io/badge/built%20with-Tauri%20v2-24C8DB?logo=tauri)
![Rust](https://img.shields.io/badge/backend-Rust-dea584?logo=rust&logoColor=white)
![React 19](https://img.shields.io/badge/frontend-React%2019-61DAFB?logo=react&logoColor=white)

<!-- TODO: Drop a hero screenshot or demo GIF here to boost attention -->
<!-- Example: <img src="docs/images/hero.gif" alt="Klipp demo" width="720" /> -->

### [⬇ Download the latest release](https://github.com/alemhar/klipp/releases/latest)

</div>

---

## 📋 Table of Contents

- [Why Klipp?](#-why-klipp)
- [Features](#-features)
- [Screenshots & Demo](#-screenshots--demo)
- [Download & Getting Started](#-download--getting-started)
- [First Run](#first-run)
- [Tech Stack & Architecture](#-tech-stack--architecture)
- [Engineering Highlights](#-engineering-highlights)
- [Roadmap](#-roadmap)
- [Development](#-development)
- [Third-Party Dependencies](#third-party-dependencies)
- [Contributing](#-contributing)
- [License](#-license)
- [About the Creator](#-about-the-creator)

---

## 🎯 Why Klipp?

Existing screen tools each give up something. Klipp's goal is one small, fast, native app that covers the full capture-to-share loop without the usual tradeoffs.

| Tool | Missing |
|---|---|
| **Microsoft Snipping Tool** | No live annotations during recording, no webcam overlay, no microphone mix, clunky workflow |
| **Loom / Screenpresso** | Browser-based or closed-source, cloud-first, subscriptions, privacy concerns |
| **OBS Studio** | Powerful but overkill for a quick screenshot/recording; steep learning curve |
| **ShareX** | Feature-dense but dated UI; not a first-class recording experience |

**Klipp's positioning**: the modern, no-account, privacy-respecting native Windows recorder for developers, content creators, educators, product folks, and anyone who wants a clean capture tool that respects their time and disk space.

---

## ✨ Features

### Screenshot Capture
- Rectangular region **Selection** mode (drag to select)
- **Fullscreen** one-click capture
- **Window** capture (coming in a future release — see [Plan 09](docs/plans/09-window-capture-mode.md))
- Configurable delay timer (3s, 5s, 10s) for menu/hover captures
- Global keyboard shortcut: **`Ctrl+Shift+S`** (context-aware — screenshot when idle, stops recording when one is active)
- Auto-copy to clipboard

### Annotation Tools
- Pen and highlighter with customizable colors and stroke widths
- Shape tools: rectangle, ellipse, arrow, line
- **Rich text annotation** — font, size, color, bold/italic, resizable, re-editable
- Emoji insertion
- Image overlay
- Ruler and protractor
- Crop tool
- Full undo/redo history

### Screen Recording
- Record any region of your screen as MP4 (H.264)
- **System audio + microphone** capture with live mixing via FFmpeg `amix`
- **Live audio level indicator** — 5-bar spectrum visualizer reacts to voice in real time
- **Draggable circular webcam bubble** on the overlay, cyclable through four corners with `Ctrl+Shift+E`
- **Real-time drawing on top of the recording** — rectangles, arrows, click ripples — while you record
- **Mouse click indicator ripples** (yellow for left, blue for right) for demos and tutorials
- **Dashed region outline** around the captured area (never shows in the recording itself)

### Other
- OCR text extraction from screenshots
- Save as PNG, JPG, GIF, BMP
- Dark and light mode, system theme aware
- System tray integration with quick actions
- Cross-platform base (Windows + macOS + Linux via Tauri; current polish focused on Windows)

---

## 📸 Screenshots & Demo

<!-- TODO: Add a hero screenshot, an annotation example, and a short recording demo GIF
     Suggested assets under docs/images/:
       - docs/images/hero.png (title bar + annotation canvas)
       - docs/images/recording-overlay.png (region outline + webcam + ripples)
       - docs/images/demo.gif (20s walkthrough) -->

> _Screenshots and a demo video will be added in an upcoming release. Contributions welcome._

---

## 📦 Download & Getting Started

Grab the latest Windows build from the [Releases page](https://github.com/alemhar/klipp/releases/latest):

| Artifact | Best for |
|---|---|
| **`Klipp_<version>_x64-setup.exe`** (NSIS) | Most users — small wizard, Start-menu shortcut, clean uninstall |
| **`Klipp_<version>_x64_en-US.msi`** | IT admins — Group Policy, Intune, SCCM deployments |
| **`Klipp_<version>_x64-portable.exe`** | Power users — no installer, runs from any folder |

> Builds are currently **unsigned**, so Windows SmartScreen may warn on first launch — click "More info → Run anyway". Code signing is on the roadmap.

Prefer building from source? See [Development](#-development).

---

## First run

Screenshot capture, annotations, and all related tools work out of the box.

**FFmpeg install prompt.** The **first time** you click the **Record** button, Klipp will ask permission to download FFmpeg (~30MB, one-time, automatic). This takes around 30 seconds on a decent connection. The Record button will show a spinner during install, then continue to the region-selector automatically. FFmpeg is not bundled with Klipp because of licensing; see [Third-Party Dependencies](#third-party-dependencies).

**Camera & microphone permission prompts.** The first time you enable the on-overlay webcam bubble or the microphone toggle, Windows will show a permission dialog from WebView2 (e.g. "`localhost` wants to use your camera/microphone"). These are standard browser-level prompts because Klipp uses the Web `getUserMedia` API for the webcam preview and audio level indicator.

If you accidentally click **Block** and later want to enable it, the **CAM** or **MIC** button in the title bar will turn amber and its tooltip will say "Camera/Microphone blocked — click for help re-enabling". Clicking it opens a dialog with two recovery steps:
1. Check **Windows Settings → Privacy & Security → Camera** (or **Microphone**) is on for desktop apps.
2. If still blocked, clear the WebView2 cache folder at `%LOCALAPPDATA%\com.zyntaxzo.klipp\EBWebView\` and relaunch Klipp to re-prompt.

---

## 🏗 Tech Stack & Architecture

| Layer | Choice | Why |
|---|---|---|
| **Desktop shell** | [Tauri v2](https://tauri.app/) | Native webview, ~10x smaller and faster startup than Electron |
| **Backend** | Rust | Zero-cost abstractions, direct Win32 access, memory safety |
| **Frontend** | React 19 + TypeScript | Ecosystem, speed of iteration |
| **Canvas** | [Konva.js](https://konvajs.org/) | Performant 2D canvas for annotations |
| **State** | Zustand + Immer | Minimal boilerplate, great DX |
| **Styling** | Tailwind CSS + Radix UI | Consistent design tokens, accessible primitives |
| **Screen recording** | FFmpeg (gdigrab + amix) | Industry-standard, proven encoding pipeline |
| **License** | MIT | Developer-friendly, no strings attached |

---

## 🔧 Engineering Highlights

A few non-trivial problems Klipp solves under the hood. Each has a self-contained plan doc in [`docs/plans/`](docs/plans/) that captures the thinking, attempted approaches, and what shipped.

- **Transparent overlay on Windows**. WebView2 doesn't support transparent backgrounds via Tauri's config alone. Klipp solves this by accessing the underlying `ICoreWebView2Controller2` COM interface and setting `DefaultBackgroundColor` with alpha=0, plus manual preservation of `WS_EX_LAYERED` across click-through toggles so transparency survives drawing-tool activation.
- **Region-sized overlay with chrome compensation**. Tauri's `set_position` uses outer window coords but WebView2 renders inside the inner (client) area. On Windows, frameless windows get an invisible 8px frame. Klipp measures inner vs outer position and re-positions the outer window so the inner lands exactly on the target region — essential for the region outline to land outside the captured area.
- **Global mouse hook for click indicators**. Uses Win32 `SetWindowsHookExW(WH_MOUSE_LL, ...)` to detect clicks anywhere on the desktop, emitted as Tauri events to render ripples on the transparent overlay — visible to the FFmpeg screen capture.
- **FFmpeg audio graph**. When system audio + microphone + circular webcam overlay are all active, Klipp composes an `-filter_complex` string that (1) masks the webcam into a circle via `geq`, (2) overlays it on the screen capture, and (3) mixes audio sources via `amix`. One canonical place builds the string to keep the combinations sane.
- **WebView2 permission recovery UX**. Because `getUserMedia` prompts look like web prompts (not native), and "Block" persists silently per origin, Klipp adds an amber-state UI affordance + modal explaining the (non-obvious) recovery path. A future iteration intercepts WebView2's `PermissionRequested` event directly.

See [`docs/plans/`](docs/plans/) for the full list and current status of each.

### Architecture deep-dives

Short write-ups on individual decisions live under [`docs/architecture/`](docs/architecture/):

- [Why Konva.js for the annotation canvas](docs/architecture/01-konvajs-canvas-choice.md) — trade-offs vs Fabric.js, raw canvas, SVG, Pixi.js
- [The FFmpeg auto-downloader](docs/architecture/02-ffmpeg-auto-downloader.md) — licensing-driven design, the download/extract/verify pipeline, where it's stored

---

## 🗺 Roadmap

Current release: **v0.1.0**. Actively planned (see [`docs/plans/`](docs/plans/) for the full specs):

| # | Feature | Status |
|---|---|---|
| 04 | Phase 6 polish — DPI scaling, multi-monitor, ripple cap | Deferred (low priority at 100% DPI) |
| 08 | WebView2 content drift — root-cause fix (WndProc subclass / DWM intercept) | Deferred |
| 09 | Window capture mode (hover-to-highlight, click-to-capture) | Planned |
| 10 | Proactive FFmpeg install banner on first launch | Planned |
| 11 | WebView2 camera/mic permission intercept — native Klipp dialog instead of raw browser prompt | Planned |

Open to [GitHub Issues](https://github.com/alemhar/klipp/issues) for feature requests and bug reports.

---

## 🛠 Development

### Prerequisites
- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) 1.77+
- Platform-specific Tauri prerequisites: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Setup
```bash
git clone https://github.com/alemhar/klipp.git
cd klipp
npm install --legacy-peer-deps
npm run tauri dev
```

### Production build
```bash
npm run tauri build
```
Installers are generated in `src-tauri/target/release/bundle/`.

### Project layout
```
src-tauri/          # Rust backend (Tauri commands, Win32, FFmpeg)
  src/commands/     # IPC commands: capture, recording, overlay, ffmpeg, settings
src/                # React frontend
  components/       # UI: layout, canvas, capture, recording, settings
  overlay/          # Standalone webview app for the recording overlay
  stores/           # Zustand state stores
  hooks/            # Reusable React hooks
docs/plans/         # Per-feature implementation plans (self-contained)
```

---

## Third-Party Dependencies

**FFmpeg** — Screen recording uses [FFmpeg](https://ffmpeg.org/), licensed under LGPL/GPL. FFmpeg is **not bundled** with Klipp — it is downloaded automatically (~30MB) on first use of the screen recording feature from [BtbN's maintained Windows builds](https://github.com/BtbN/FFmpeg-Builds). You can also install it manually via `winget install Gyan.FFmpeg`. Screenshot capture and all annotation features work without FFmpeg.

---

## 🤝 Contributing

PRs welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines. Good first issues are labeled on the [Issues page](https://github.com/alemhar/klipp/issues).

**Ideas worth contributing**:
- Platform polish (macOS / Linux capture + overlay paths)
- Icon / branding design
- Video tutorials or marketing demos
- Any item from the [roadmap](#-roadmap)

---

## 📄 License

[MIT](LICENSE) — do whatever you want, just don't sue me.

---

## 👋 About the Creator

Klipp is built and maintained by **Alemhar** <!-- TODO: fill in --> — a software engineer building native developer tools.

- **GitHub**: [@alemhar](https://github.com/alemhar)
- **LinkedIn**: https://www.linkedin.com/in/alemhar-salihuddin/
- **Email**: alemhar@gmail.com
- **Portfolio**: https://alemhar.github.io/

### Connect

- **Collaborations welcome** — companion tools, integrations, or add-ons that pair well with Klipp
- **Happy to nerd out** about the engineering behind it — Tauri, Rust, Win32, WebView2, FFmpeg
- **Feature requests / bugs** — the [Issues page](https://github.com/alemhar/klipp/issues) is the best place

If Klipp caught your interest, feel free to reach out through any channel above.

---

<div align="center">

**If Klipp saved you a few minutes, consider starring the repo. It helps a lot.**

[⭐ Star Klipp on GitHub](https://github.com/alemhar/klipp)

</div>
