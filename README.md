# Video Editor

A desktop-oriented React + Vite video editor with an Electron shell, multi-track timeline editing, media import, text/effects controls, voice-over recording, project persistence, and FFmpeg-backed Windows export.

## Core workflows

- Multi-track video/audio timeline with selection, split, trim, duplicate, delete, snapping, markers, zoom, track sizing, undo, and redo.
- Video controls for position, scale, rotation, opacity, crop, fit mode, playback speed, and freeze frame.
- Audio controls for volume and fades.
- Voice-over recording through `getUserMedia` + `MediaRecorder`, with recorded clips inserted into the timeline.
- Project save/autosave/recovery and recent-project handling.
- Text, effects, transitions, stock/SFX workspaces, and export UI.
- AI Footage Finder: paste a script, it splits into scenes, expands each line into visual concepts (free keyword/concept matching, no AI API cost), searches YouTube (requires your own `VITE_YOUTUBE_API_KEY` / API Keys panel), and best-effort matches transcript timestamps to rank footage sources by relevance. Transcript fetching runs in the desktop app only (browser preview mode can search but not score timestamps). Results are references — "Add to Project" inserts a placeholder clip that must be relinked to licensed footage before final export.
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

Run the release-readiness contract separately when checking installer metadata, FFmpeg bundling, QA documentation, environment-key hygiene, and Windows workflow wiring:

```bash
npm run verify:release
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

For the final real Windows pass, run preflight first and then the combined acceptance runner:

```powershell
npm run verify:windows:preflight
$env:PEXELS_API_KEY='your-key'
$env:PIXABAY_API_KEY='your-key'
npm run verify:windows:acceptance
```

The acceptance runner attempts all real-environment checks instead of stopping at the first failure, then writes `windows-acceptance-report.json`. Individual real-environment helpers remain available:

```bash
npm run verify:microphone:windows
npm run verify:gpu:windows
npm run verify:stock:live
```

`verify:gpu:windows` performs a real hardware H.264 export attempt with NVENC, Intel QSV, and AMD AMF encoders exposed by the bundled FFmpeg. `verify:stock:live` uses `PEXELS_API_KEY` and/or `PIXABAY_API_KEY` environment variables to validate real live video search responses.

The final automated gate runs lint, a production build, generated WAV validation, editor contracts, hands-on QA tooling checks, and release-readiness checks. Hardware, microphone permission, live-service behavior, and visual/native-picker behavior still require the target Windows environment itself.

See `FINAL_QA.md` for the final Windows acceptance checklist.

## Windows packaging

Prepare FFmpeg resources and build the NSIS installer with:

```bash
npm run package:win
```

The installer output is written to `release/`.
