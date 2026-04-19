# Contributing to Klipp

Thank you for your interest in contributing! This guide will help you get started.

## Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [Rust](https://rustup.rs/) 1.77+
- Platform-specific dependencies: [tauri.app/start/prerequisites](https://tauri.app/start/prerequisites/)

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install --legacy-peer-deps
   ```
3. Start the dev server:
   ```bash
   npm run tauri dev
   ```

## Project Structure

```
src-tauri/          # Rust backend (Tauri)
  src/commands/     # IPC commands (capture, clipboard, file I/O)
  src/capture/      # Platform-specific screen capture
src/                # React frontend
  components/       # UI components (layout, canvas, capture, settings)
  stores/           # Zustand state stores
  hooks/            # Custom React hooks
  types/            # TypeScript type definitions
  lib/              # Utility functions
```

## Guidelines

- **One feature per PR** — keep changes focused and reviewable
- **Use conventional commits** — `feat:`, `fix:`, `docs:`, `refactor:`, etc.
- **Run checks before submitting:**
  ```bash
  npm run lint
  npm run test
  ```
- **Frontend changes** only require TypeScript/React knowledge
- **Capture/backend changes** require Rust knowledge

## Reporting Issues

- Use the issue templates for bug reports and feature requests
- Include your OS version and app version
- Screenshots are always helpful

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). Please be respectful and constructive.
