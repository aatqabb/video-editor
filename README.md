# Video Editor

A desktop-oriented React + Vite video editor with an Electron shell, multi-track timeline editing, media import, text/effects controls, voice-over recording, project persistence, and FFmpeg-backed Windows export.

## Core workflows

- Multi-track video/audio timeline with selection, split, trim, duplicate, delete, snapping, markers, zoom, track sizing, undo, and redo.
- Video controls for position, scale, rotation, opacity, crop, fit mode, playback speed, and freeze frame.
- Audio controls for volume and fades.
- Voice-over recording through `getUserMedia` + `MediaRecorder`, with recorded clips inserted into the timeline.
- Project save/autosave/recovery and recent-project handling.
- Text, effects, transitions, stock/SFX workspaces, and export UI.
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
npm run verify:windows-picker
```

The final gate also runs lint and a production build. Hardware and live-service behavior still requires hands-on QA where automation cannot prove the environment itself, especially real GPU vendor export paths, Windows microphone permission/recording, and live stock-media API keys.

## Windows packaging

Prepare FFmpeg resources and build the NSIS installer with:

```bash
npm run package:win
```

The installer output is written to `release/`.
