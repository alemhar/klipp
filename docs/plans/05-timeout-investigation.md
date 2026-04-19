# Plan 05 — Timeout Investigation

> **Status**: ✅ Partially resolved 2026-04-17 — commit `251a00f`. See "Findings" section below. Root cause of the user-visible "Monitor timed out" message was **Claude Code's Monitor tool, not the app itself**. No app-level timeout has been reproduced. Keeping this doc open in case a genuine app timeout surfaces later.

## Findings (2026-04-17)

### What was reported
User repeatedly saw "Monitor timed out — re-arm if needed." messages during Plan 01–04 development and assumed they were from the Klipp app itself.

### Root cause
The message comes from **Claude Code's `Monitor` tool** that the assistant uses to watch long-running background processes (like `npm run tauri dev`). It's an internal Claude Code tooling message surfaced in chat, not output from Klipp's Rust/React code.

**Distinguishing features**:
- Format: `Monitor timed out — re-arm if needed.`
- Appears inside a `<task-notification>` block tagged with a task ID like `b76jyj6tx`.
- Happens on a schedule (default ~300 seconds of no matching log output) regardless of what the app is doing.
- The app continues running normally after the message — closing/reopening the app has no effect on it.

**App-side**: there is currently **no reproducible app-level timeout**. None of the suspects below (`mpsc::channel` recv in `show_overlay`, WebView2 init stall, mouse-hook thread pump, Vite HMR) have surfaced a real failure during Plan 01, 02, or Plan 03 Step A testing.

### Verdict
No code change needed in Klipp. The documented suspects remain valid design concerns — any of them could cause a real timeout if conditions change — but they are not observed today.

### When to reopen
Revisit this plan if the user sees timeouts:
- **In the app's DevTools console** (not in the Claude Code chat stream).
- **In the terminal running `tauri dev`** as an error or panic.
- **As an invoke() rejection** with a message like "ipc timeout" or "command took too long".
- **In the production build** (`npm run tauri build`) which bypasses Claude Code's Monitor entirely.

If any of those appear, proceed with the investigation checklist below.

---

## Context (Original Plan)

During development, timeout errors have been observed in the app. Need to determine:

1. What specifically is timing out (which IPC call, which operation).
2. Whether it's dev-mode only (related to Vite HMR, file watcher, etc.) or would persist in production builds.
3. Root cause and recommended fix.

**This is a research task**, not a coding task. The deliverable is documented findings appended to [docs/OVERLAY-TODO.md](../OVERLAY-TODO.md). Code fixes (if any) would be scoped as a follow-up task after findings are clear.

**Ordering note**: this is the LAST task, after Phase 6, per user request. If Phase 6 work resolves the timeouts incidentally (e.g. by changing how the overlay window is created), we can close this out with "resolved by Phase 6" in the findings doc.

## Current State / Suspects

### Suspect 1: `mpsc::channel` recv in `show_overlay`

[src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs) uses a blocking `recv()` with no timeout:

```rust
app.run_on_main_thread(move || {
    let result = WebviewWindowBuilder::new(...).build();
    let _ = tx.send(result);
})
.map_err(|e: tauri::Error| e.to_string())?;

let overlay = rx
    .recv()
    .map_err(|e| e.to_string())?         // ← blocks forever if main thread is stuck
    .map_err(|e: tauri::Error| e.to_string())?;
```

If the main thread is blocked for any reason (WebView2 initialization, another modal on the main thread, Tauri internal work), `recv()` blocks indefinitely. The frontend `invoke("show_overlay")` eventually hits its own timeout (Tauri v2 default: 30s).

**Possible fix**: use `recv_timeout(Duration::from_secs(10))` and return an informative error.

### Suspect 2: WebView2 initialization stall

Creating the overlay window requires WebView2 to initialize a new webview. On first launch, this can take 500ms–2s. During development with Vite HMR, if the dev server is slow to respond to `http://localhost:1420/overlay.html`, the webview may stall waiting for the page.

**Check**: does the timeout occur on the FIRST `show_overlay` after app start, or consistently every time?

### Suspect 3: Mouse hook thread message pump

`SetWindowsHookExW(WH_MOUSE_LL, ...)` requires a message loop on the thread that installs the hook. Tauri commands run on a worker thread via the tokio runtime. If that thread doesn't have a message pump, the hook is installed but **never fires**.

This isn't exactly a timeout, but it could manifest as "overlay shows but no ripples appear for 10+ seconds." Worth ruling out.

### Suspect 4: Dev-only artifacts

- Vite HMR reloads when files change can cause the overlay React app to reload, triggering `start_mouse_hook` again.
- File watcher triggering a Rust rebuild while recording is active would kill the dev binary.
- `cargo run` warm-up on first compile is slow and can mask real timeouts.

### Suspect 5 (ruled out): Claude Code Monitor tool

Addressed in "Findings" above. This was the actual source of the user's reported "Monitor timed out" messages. Not an app bug.

## Investigation Checklist

### Phase A: Reproduction

1. Start a fresh `tauri dev` session.
2. Reproduce the timeout. Record:
   - **Exact error text** (JavaScript console + terminal output)
   - **User action that triggered it** (start recording? click a button? open overlay?)
   - **Time from action to error**
   - **Whether app recovers** or needs restart
3. Capture stack trace from both sides:
   - Browser DevTools (main window) console
   - Rust terminal output (any `println!` from the app)

### Phase B: Narrow down the suspect

For each suspect, a targeted test:

**Test 1 — Channel recv**: add `eprintln!` logs before and after `rx.recv()` in `show_overlay`. If the "before" log fires but not "after" for 10+ seconds, channel is the bottleneck.

**Test 2 — WebView2 init**: measure time from `WebviewWindowBuilder::build()` being called to the `show()` call returning. Log with `std::time::Instant`.

**Test 3 — Mouse hook**: after `show_overlay`, click the desktop. Check if the `mouse-click` event fires in the React console. If delayed, the hook thread pump is the issue.

**Test 4 — Dev vs prod**: run `npm run tauri build` and test the production binary. Reproduce same scenario. If timeout doesn't occur in prod, it's a dev-only artifact.

### Phase C: Document findings

Append to [docs/OVERLAY-TODO.md](../OVERLAY-TODO.md) under a new "### 4. Timeout Investigation — Findings" section:

```markdown
### 4. Timeout Investigation — Findings (YYYY-MM-DD)

**Reproduction steps:**
1. ...

**Observed behavior:**
- Error text: ...
- Time to error: ...
- Affected operations: ...

**Root cause:**
- [suspect confirmed or ruled out, with evidence]

**Dev-only or production:**
- [verdict with evidence from `tauri build` testing]

**Recommended fix:**
- [specific change, or "no fix needed"]

**Follow-up tasks created:**
- [link to new plan doc if fix is non-trivial]
```

## Verification

- Findings are written with enough detail that a fresh engineer can reproduce and verify.
- If a fix is recommended, a follow-up plan doc is created (e.g. `docs/plans/06-timeout-fix.md`) with specific code changes.

## Dependencies

- **None.** Independent research task.
- May be resolved incidentally by Phase 6 changes; if so, the finding is "resolved by Phase 6" with no new work needed.

## Files Involved (for reference, not modification)

- [src-tauri/src/commands/overlay.rs](../../src-tauri/src/commands/overlay.rs) — `show_overlay` channel pattern
- [src-tauri/src/commands/recording.rs](../../src-tauri/src/commands/recording.rs) — FFmpeg spawn (non-blocking)
- [src/stores/recordingStore.ts](../../src/stores/recordingStore.ts) — `startRecording` invoke chain

## Out of Scope

- Rewriting the overlay creation pattern unless investigation shows it's the root cause.
- Performance profiling beyond what's needed to identify the timeout source.

## Deliverable

Appended "Findings" section in [docs/OVERLAY-TODO.md](../OVERLAY-TODO.md). Optionally, a follow-up plan doc if a fix is warranted.
