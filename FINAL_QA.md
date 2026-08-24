# Final Windows Acceptance Checklist

Run this on the real Windows editing PC after pulling the latest `main`.

## Fast path

First check what is ready and what still needs setup:

```powershell
npm ci
npm run verify:windows:preflight
```

This writes `windows-preflight-report.json` and reports Windows/Node/npm readiness, prepared or bundled FFmpeg, and whether the Pexels/Pixabay API keys are present.

Then set the live stock API keys and run the combined acceptance command:

```powershell
$env:PEXELS_API_KEY='your-key'
$env:PIXABAY_API_KEY='your-key'
npm run verify:windows:acceptance
```

The acceptance runner attempts every check even if one fails, so `windows-acceptance-report.json` contains the complete blocker list from one run. It covers preflight, automated final regression, real microphone capture, live Pexels/Pixabay searches, and real NVENC/QSV/AMF hardware export.

## 1. Build and install

```powershell
npm run package:win
```

Install the generated `release/VideoEditor-Setup-*.exe` and launch **Video Editor** from the desktop shortcut.

## 2. Visual + native picker QA

- Confirm the Premiere-style layout loads without clipped or overlapping panels.
- Resize the left panel, right panel, preview/program area, and timeline vertically/horizontally.
- Open the keyboard-shortcuts popup, confirm it can be closed, and test the core shortcut keys.
- Import multiple video/audio/image files using the native Windows picker.
- Save a project with **Save As**, close the app, reopen the project, and confirm the timeline restores.
- Choose an export destination and confirm the file appears at the selected path.

## 3. Microphone QA

The command below performs an actual two-second Windows microphone capture and requires a non-empty MediaRecorder blob:

```powershell
npm run verify:microphone:windows
```

Then do the app-level voice-over check: record 5–10 seconds, stop recording, confirm the new clip appears on the timeline, and play it back to confirm the voice is audible.

## 4. Live stock API QA

```powershell
$env:PEXELS_API_KEY='your-key'
$env:PIXABAY_API_KEY='your-key'
npm run verify:stock:live
```

Then in the app, paste a short script, split it into lines, search one line with Pexels and another with Pixabay, preview a result, drag/import it to the timeline, and confirm download works.

## 5. Real GPU export QA

After `npm run package:win`, run:

```powershell
npm run verify:gpu:windows
```

The script detects NVENC, Intel QSV, and AMD AMF encoders exposed by the bundled FFmpeg and attempts a real three-second hardware H.264 export on the current machine. At least one detected encoder must produce a valid MP4.

Then export a short real project from the app using **GPU** mode and confirm playback. Repeat in **Auto** mode to confirm CPU fallback remains available if the GPU path fails.

## 6. Final acceptance

- Basic editing still works with the network disconnected.
- MP4 export works.
- MP3 audio-only export works.
- 1080p and 4K project/export settings are selectable.
- Undo/redo, split, ripple trim, clip movement, text, transitions, SFX, save/recovery, and shortcuts work without a crash.
- `windows-acceptance-report.json` has `"ok": true` when the combined acceptance command is used.

Record any failing step with the exact error text and a screenshot. Do not mark the master tracker complete until all real-environment checks pass.
