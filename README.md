# Video Editor

A desktop-oriented React + Vite video editor with an Electron shell, multi-track timeline editing, media import, text/effects controls, voice-over recording, project persistence, and FFmpeg-backed Windows export.

## Core workflows

- Multi-track video/audio timeline with selection, split, trim, duplicate, delete, snapping, markers, zoom, track sizing, undo, and redo.
- Video controls for position, scale, rotation, opacity, crop, fit mode, playback speed, and freeze frame.
- Audio controls for volume and fades.
- Voice-over recording through `getUserMedia` + `MediaRecorder`, with recorded clips inserted into the timeline.
- Project save/autosave/recovery and recent-project handling.
- Text, effects, transitions, stock/SFX workspaces, and export UI.
- Built-in SFX are generated as packaged WAV assets during the production build and use Electron-safe relative URLs for preview/timeline insertion.
- Electron packaging for Windows with bundled FFmpeg resources.

## Development

```bash
npm install
npm run dev
```

Create a production web build with:

```bash
npm run build
```

Launch the Electron desktop shell after building:

```bash
npm run desktop
```

## Verification

Run the full automated regression gate before shipping:

```bash
npm run verify:final
```

Individual contract checks are also available:

```bash
npm run verify:timeline
npm run verify:timeline-transform
npm run verify:gpu
npm run verify:responsiveness
npm run verify:export
npm run verify:voiceover
npm run verify:sfx
npm run verify:sfx-assets
npm run verify:stock
npm run verify:windows-picker
```

Real-environment QA helpers are available for the final Windows acceptance pass:

```bash
npm run verify:gpu:windows
npm run verify:stock:live
```

`verify:gpu:windows` performs a real hardware H.264 export attempt with NVENC, Intel QSV, and AMD AMF encoders exposed by the bundled FFmpeg. `verify:stock:live` uses `PEXELS_API_KEY` and/or `PIXABAY_API_KEY` environment variables to validate real live video search responses.

The final gate runs lint, a production build, generated WAV validation, editor contract checks, and verifies that the hands-on QA tooling is wired. Hardware and live-service behavior still requires the target Windows environment itself, especially microphone permission/recording and visual/native-picker behavior.

See `FINAL_QA.md` for the final Windows acceptance checklist.

## Windows packaging

Prepare FFmpeg resources and build the NSIS installer with:

```bash
npm run package:win
```

The installer output is written to `release/`.
