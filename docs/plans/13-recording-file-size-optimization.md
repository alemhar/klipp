# Plan 13 — Recording File-Size Optimization

> **Status**: 🚧 Pending. Current build ships with FFmpeg defaults tuned for speed-during-record, not file size. This plan introduces a Settings toggle that lets users opt into smaller files, plus a silent hardware-encoder upgrade when the machine supports it.

## Context

The shipping recording command at [`src-tauri/src/commands/recording.rs`](../../src-tauri/src/commands/recording.rs) passes these encoder args to FFmpeg:

```
-c:v libx264  -preset ultrafast  -pix_fmt yuv420p  -crf 23
```

`-preset ultrafast` means "don't drop frames even on a potato CPU." `-crf 23` is x264's default quality. No audio codec is specified, so FFmpeg picks its default. This produces **larger files than necessary** — a typical 1080p/30 screen recording lands around 30-50 MB per minute, vs ~15-20 MB per minute with a mildly slower preset + slightly higher CRF.

Two levers are available without compromising the record-time UX:

1. **Encoder preset + CRF** — software-level tuning. Tradeoff: size vs. CPU during record. A `veryfast` preset + CRF 26 combo typically halves file size at ~15% more CPU cost, with no visible quality loss for screen content (static regions compress extremely well at higher CRF).
2. **Hardware encoder** — if the machine has NVIDIA NVENC, Intel QuickSync, or AMD AMF, use `h264_nvenc` / `h264_qsv` / `h264_amf` instead of `libx264`. This frees the CPU entirely for the same output size. No quality tradeoff — it's strictly better when available.

## Proposed Behavior

### Settings toggle — "Smaller recording files"

In the Settings panel, add a new **Recording** section (or extend an existing one) with:

> **Smaller recording files** *(off by default)*
> Saves ~50% disk space. Recordings still look great for most content.

Two states:

| Toggle | Preset | CRF | Audio |
|---|---|---|---|
| **Off** (default) | `ultrafast` | 23 | FFmpeg default |
| **On** | `veryfast` | 26 | `aac -b:a 96k` |

Setting is persisted to `settings.json` as `reduceRecordingSize: bool`. Read at record-time in Rust via the existing settings plumbing.

### Hardware-encoder auto-detect (silent)

On app startup, probe FFmpeg's `-encoders` output and cache whichever of these is available, in priority order:

1. `h264_nvenc` (NVIDIA)
2. `h264_qsv` (Intel)
3. `h264_amf` (AMD)
4. `libx264` (software fallback — always available)

The detected encoder is used regardless of the size toggle — hardware encoders deliver the same file size as software at near-zero CPU, so it's a pure win. The size toggle still controls the size-vs-quality dial (it maps to different CRF/preset values per encoder family, since HW encoder quality flags differ from software).

**HW encoder quality mapping:**

| Toggle | NVENC | QSV | AMF | libx264 |
|---|---|---|---|---|
| **Off** | `-preset p4 -rc vbr -cq 23` | `-preset veryfast -global_quality 23` | `-quality balanced -rc cqp -qp_i 23 -qp_p 25` | `-preset ultrafast -crf 23` |
| **On** | `-preset p5 -rc vbr -cq 26` | `-preset fast -global_quality 26` | `-quality quality -rc cqp -qp_i 26 -qp_p 28` | `-preset veryfast -crf 26` |

(Exact flags TBD during implementation — each HW encoder has quirks. The shape is: OFF ≈ current quality at modest size, ON ≈ ~50% smaller.)

### Out of scope

- **A tri-preset (Low/Balanced/High)** — a binary toggle covers 90% of value. If users ask for more granularity later, it maps cleanly to a 3-way select without breaking compatibility.
- **HEVC / H.265** — 30-50% smaller than H.264 but loses compatibility with older players and mobile browsers. Worth its own plan if users want it.
- **Post-recording compression** — a "re-encode with slow preset" pass would shrink files further, but introduces a new async UX surface (progress, cancel, where the intermediate file lives). Parking for now.
- **Custom CRF / bitrate fields in Settings** — only for power users; adds surface area. The toggle is enough for v1.
- **Multi-pass encoding** — only works for known-duration recordings; not a fit for live capture.

## Implementation Sketch

### 1. Rust — encoder detection + arg selection

New file `src-tauri/src/commands/recording_encoder.rs` (or inline in `recording.rs`):

```rust
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum HwEncoder {
    Nvenc,
    Qsv,
    Amf,
    Software,  // libx264
}

impl HwEncoder {
    pub fn detect(ffmpeg_path: &str) -> Self {
        let output = ffmpeg::hidden_command(ffmpeg_path)
            .args(["-hide_banner", "-encoders"])
            .output()
            .ok();
        let Some(output) = output else { return Self::Software; };
        let stdout = String::from_utf8_lossy(&output.stdout);
        if stdout.contains("h264_nvenc") { return Self::Nvenc; }
        if stdout.contains("h264_qsv")   { return Self::Qsv; }
        if stdout.contains("h264_amf")   { return Self::Amf; }
        Self::Software
    }
}

pub fn encoder_args(encoder: HwEncoder, reduce_size: bool) -> Vec<&'static str> {
    match (encoder, reduce_size) {
        (HwEncoder::Nvenc,    false) => vec!["-c:v", "h264_nvenc", "-preset", "p4", "-rc", "vbr", "-cq", "23"],
        (HwEncoder::Nvenc,    true)  => vec!["-c:v", "h264_nvenc", "-preset", "p5", "-rc", "vbr", "-cq", "26"],
        (HwEncoder::Qsv,      false) => vec!["-c:v", "h264_qsv", "-preset", "veryfast", "-global_quality", "23"],
        (HwEncoder::Qsv,      true)  => vec!["-c:v", "h264_qsv", "-preset", "fast", "-global_quality", "26"],
        (HwEncoder::Amf,      false) => vec!["-c:v", "h264_amf", "-quality", "balanced", "-rc", "cqp", "-qp_i", "23", "-qp_p", "25"],
        (HwEncoder::Amf,      true)  => vec!["-c:v", "h264_amf", "-quality", "quality",  "-rc", "cqp", "-qp_i", "26", "-qp_p", "28"],
        (HwEncoder::Software, false) => vec!["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23"],
        (HwEncoder::Software, true)  => vec!["-c:v", "libx264", "-preset", "veryfast",  "-crf", "26"],
    }
}
```

Detection runs once per app session and is cached on an `HwEncoderState` via `tauri::manage()`.

In `start_recording`, replace the hardcoded encoder args with `encoder_args(hw_encoder_state.get(), settings.reduce_recording_size)` + always append `-pix_fmt yuv420p`. When `reduce_recording_size` is on, also append audio args `-c:a aac -b:a 96k`.

### 2. Settings schema — new field

`src-tauri/src/commands/settings.rs`:

```rust
#[serde(default)]
pub reduce_recording_size: bool,
```

Default `false` (current behavior preserved for existing users).

### 3. Settings panel — React

Extend the existing Settings UI with a **Recording** section:

```tsx
<SettingToggle
  label="Smaller recording files"
  helperText="Saves ~50% disk space. Recordings still look great for most content."
  value={settings.reduceRecordingSize}
  onChange={(v) => updateSettings({ reduceRecordingSize: v })}
/>
```

(Component name TBD — match existing Settings panel patterns.)

### 4. Wire settings → record-flow

`useRecordFlow` / `recordingStore` already reads settings. Pass the `reduceRecordingSize` flag into the `start_recording` command's `RecordingConfig`.

**Alternative**: read it directly from settings on the Rust side in `start_recording`, avoiding an extra field on `RecordingConfig`. Simpler. Probably the right move — the setting is user-global, not per-record.

## Verification

- [ ] Fresh install: record a 60-second 1080p clip. Toggle off → file size ~30-50 MB. Toggle on → file size ~15-25 MB. Visually inspect: no quality difference on text-heavy UI.
- [ ] Machine with NVIDIA GPU: app boot logs show NVENC detected; CPU usage during record is <5% vs ~20% with software.
- [ ] Machine without a supported HW encoder: falls back to `libx264` with no error; behavior identical to current.
- [ ] Toggle transitions correctly between off and on across app restarts.
- [ ] Recording still starts cleanly when audio inputs are enabled (no breakage from the added `-c:a aac -b:a 96k` args).
- [ ] Output is playable in VLC, Windows Media Player, and Chrome's built-in video player. (H.264 broad compat.)

## Files to Modify

- `src-tauri/src/commands/recording.rs` — replace hardcoded encoder args with `encoder_args()` call; read `reduce_recording_size` from settings.
- New `src-tauri/src/commands/recording_encoder.rs` — HW detection + encoder-args table.
- `src-tauri/src/commands/settings.rs` — add `reduce_recording_size` field.
- `src-tauri/src/lib.rs` — manage `HwEncoderState` (detect once at setup).
- `src/components/settings/SettingsPanel.tsx` (or whichever file owns the settings UI) — add the Recording section with the new toggle.
- `src/stores/settingsStore.ts` / `src/types/settings.ts` — extend the settings shape.

## Dependencies

- Independent from other plans. Can ship standalone in v0.1.4 or later.
- Won't conflict with Plan 10 (FFmpeg-install UX) — orthogonal concerns.

## Sequencing

Two shippable slices:

1. **Software-side only**: change defaults to `ultrafast`/23 when off, `veryfast`/26 + `aac 96k` when on. Ship the toggle. Zero HW detection. **1-2 hour task.**
2. **Add HW encoder auto-detect**: probe + route. Adds ~1 day if we want it tested across NVIDIA, Intel, AMD hardware.

Recommend shipping (1) first as a quick v0.1.4 win, then (2) in v0.1.5 once we can confirm the quality-flag mappings per vendor.
