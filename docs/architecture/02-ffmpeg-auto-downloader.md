# The FFmpeg auto-downloader

Klipp uses FFmpeg for screen recording — `gdigrab` for capture on Windows, `libx264` for encoding, `amix` for mixing mic + system audio. FFmpeg is **not bundled** with the app. Instead it's downloaded on demand the first time the user clicks **Record**. This doc explains why, and how the download/extract/verify pipeline works.

## Why not bundle

1. **Licensing.** FFmpeg is LGPL/GPL. Bundling a copy of the binary inside a proprietary or permissively-licensed app creates compliance obligations (you must convey the source, license text, allow relinking, etc.) that a single-developer project can easily get wrong. By downloading at runtime, users install it themselves from an upstream-maintained build and our obligations are limited to clearly explaining that fact.
2. **Installer size.** FFmpeg (stripped, Windows) is ~200 MB unextracted and ~80 MB as an executable. A Klipp installer that was 100 MB+ of FFmpeg-we-didn't-ship would be a worse first impression than a smaller installer plus a one-time in-app download.
3. **Version drift.** If FFmpeg moves, we can update the download URL without shipping a new installer. Users on older Klipp versions benefit automatically the next time we update.

See [Third-Party Dependencies](../../README.md#third-party-dependencies) in the README for the user-facing disclosure.

## The pipeline

Source: [`src-tauri/src/commands/ffmpeg.rs`](../../src-tauri/src/commands/ffmpeg.rs).

```
user clicks Record
   ↓
check_ffmpeg()
   ↓ missing
download_ffmpeg()
   ├─ PowerShell Invoke-WebRequest → ffmpeg.zip
   ├─ validate size (>1 MB; catches error pages)
   ├─ PowerShell System.IO.Compression extract → ffmpeg.exe
   ├─ delete the zip
   ├─ run ffmpeg.exe -version to verify
   └─ store at app_data_dir/ffmpeg/ffmpeg.exe
   ↓
continue to the recording region selector
```

### Source of the binary

We pull from [`BtbN/FFmpeg-Builds`](https://github.com/BtbN/FFmpeg-Builds) on GitHub releases — specifically `ffmpeg-master-latest-win64-gpl.zip`. Why BtbN:

- Automated CI-built, updated frequently, stable URL
- Ships with all the encoders we need (libx264 GPL build)
- Popular and mirrored enough that we're unlikely to hit the "build disappeared" failure mode

If the URL breaks in the future, the fallback path is already in place: `check_ffmpeg()` also tries a system PATH lookup (`ffmpeg -version`), and the UI tooltip tells users they can install via `winget install Gyan.FFmpeg` themselves.

### Why PowerShell, not pure Rust

The download and zip extraction are invoked via `powershell.exe -NoProfile -Command "..."`. Rust could do this natively with `reqwest` + `zip`, but:

- Zero added dependencies in the Rust crate. The download is a one-time event, not a hot path.
- PowerShell is always present on modern Windows. No extra runtime concerns.
- `Invoke-WebRequest` respects system proxy settings out of the box, which matters for corporate networks.

The extract script uses `System.IO.Compression.ZipFile.OpenRead` and filters entries with `-like '*/bin/ffmpeg.exe'` so we only pull out the one 80 MB file we actually need, ignoring the 200+ MB of headers/libs/docs/other binaries in the archive.

### Validation

Three checks keep a broken download from leaving a zombie file on disk:

1. **PowerShell exit status** — if `Invoke-WebRequest` failed, we `remove_file` the zip and return an informative error.
2. **Size floor** — the zip must be > 1 MB. A size below that usually means we downloaded a GitHub error page (HTML) rather than the actual binary.
3. **Binary verification** — after extraction, we run the extracted `ffmpeg.exe -version`. If it doesn't exit 0, we delete the executable and return an error. No silent corruption.

### Storage location

The binary lives at:

```
<app_data_dir>/ffmpeg/ffmpeg.exe
```

Where `<app_data_dir>` on Windows resolves to `%APPDATA%\com.zyntaxzo.klipp\ffmpeg\ffmpeg.exe` via Tauri's `app.path().app_data_dir()`. Keeping it in the app's data directory (not `Program Files` or similar) means:

- No elevated permissions required.
- Cleanly uninstalls when the user removes the app directory.
- Isolated from other apps that might also ship an `ffmpeg.exe`.

### System PATH fallback

If the user already has FFmpeg installed on PATH (e.g. via winget), `check_ffmpeg()` finds it via `Command::new("ffmpeg").arg("-version").output()` and skips the download entirely. `get_ffmpeg_path_internal()` prefers the bundled download when present, else returns `"ffmpeg"` (letting the OS resolve via PATH).

## The UX around it

The download runs inside a Tauri command, so the frontend `invoke("download_ffmpeg")` call is async. While it's in flight, the Record button shows a spinner (see [`src/components/layout/TitleBar.tsx`](../../src/components/layout/TitleBar.tsx)), is disabled, and the tooltip reads *"Installing FFmpeg... (one-time ~30MB download)"*. On success, the app automatically proceeds to the region selector so the user's original intent completes in one motion. On failure, an alert explains the error and suggests `winget install Gyan.FFmpeg` as a manual workaround.

See [docs/plans/10-ffmpeg-proactive-first-run-ux.md](../plans/10-ffmpeg-proactive-first-run-ux.md) for the planned next iteration: a proactive install banner on app startup so the download happens before the user even clicks Record.

## Trade-offs

- **Requires network on first recording.** Users in air-gapped environments have to install FFmpeg manually, but that's rare and we surface the `winget` command clearly.
- **PowerShell spawn overhead.** Starting `powershell.exe` twice (download + extract) adds ~500ms to total install time. Trivial compared to the ~30s actual download.
- **No progress reporting.** Currently the UI shows an indeterminate spinner. A future iteration (Plan 10) adds a progress bar by having Rust emit `"ffmpeg-download-progress"` events while the download streams.

## When to revisit

- **If we ship macOS/Linux builds in earnest.** PowerShell is Windows-specific. We'd need a `cfg(target_os)` branch using `reqwest` + `zip-rs` (or `tar`-based archive extraction on the Unix side).
- **If we ever want to ship FFmpeg bundled.** Small static build would bring our installer up by ~20–30 MB but remove the first-run friction. Would require a proper LGPL/GPL compliance story (source mirror, license files, relinking capability).
- **If BtbN's builds go away.** Switch to another maintained release (Gyan, `yt-dlp`'s custom builds, or self-hosted). The download URL is a single string in [`ffmpeg.rs`](../../src-tauri/src/commands/ffmpeg.rs).

## References

- Source: [`src-tauri/src/commands/ffmpeg.rs`](../../src-tauri/src/commands/ffmpeg.rs)
- BtbN builds: https://github.com/BtbN/FFmpeg-Builds
- First-run UX: [`src/components/layout/TitleBar.tsx`](../../src/components/layout/TitleBar.tsx)
- Future plan: [`docs/plans/10-ffmpeg-proactive-first-run-ux.md`](../plans/10-ffmpeg-proactive-first-run-ux.md)
