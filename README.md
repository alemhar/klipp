# SnippingZo

An open-source screenshot and screen recording tool with powerful annotation support. Built as an alternative to Microsoft Snipping Tool — with features it's missing.

## Features

**Screenshot Capture**
- Rectangular, freeform, window, and fullscreen capture modes
- Configurable delay timer (3s, 5s, 10s)
- Global keyboard shortcut (Ctrl+Shift+S)
- Auto-copy to clipboard

**Annotation Tools**
- Pen and highlighter with customizable colors and thickness
- Shapes: rectangle, ellipse, arrow, line
- **Text annotation** — font, size, color, bold/italic, resizable, re-editable
- Emoji insertion
- Image overlay
- Ruler and protractor
- Crop tool
- Full undo/redo history

**Screen Recording**
- Record any region of your screen as MP4
- System audio + microphone capture
- **Mouse click indicator** for demos and tutorials
- Pause/resume controls

**Other**
- OCR text extraction from screenshots
- Save as PNG, JPG, GIF, BMP
- Dark and light mode
- System tray integration
- Cross-platform (Windows, macOS, Linux)

## Tech Stack

- **Backend:** Tauri v2 (Rust)
- **Frontend:** React 19 + TypeScript
- **Canvas:** Konva.js
- **State:** Zustand + Immer
- **Styling:** Tailwind CSS + Radix UI
- **License:** MIT

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) 1.77+
- Platform-specific Tauri prerequisites: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

### Setup

```bash
git clone https://github.com/FuselabsAI/SnippingZo.git
cd SnippingZo
npm install --legacy-peer-deps
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

Installers are generated in `src-tauri/target/release/bundle/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

[MIT](LICENSE)
