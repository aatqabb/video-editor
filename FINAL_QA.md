# Final Windows Acceptance Checklist

Run this only after the latest `main` build passes `npm run verify:final`.

## 1. Build and install

```powershell
npm ci
npm run verify:final
npm run package:win
```

Install the generated `release/VideoEditor-Setup-*.exe` and launch **Video Editor** from the desktop shortcut.

## 2. Visual + native picker QA

- Confirm the Premiere-style layout loads without clipped or overlapping panels.
- Resize the left panel, right panel, and timeline vertically/horizontally.
- Import multiple video/audio/image files using the native Windows picker.
- Save a project with **Save As**, close the app, reopen the project, and confirm the timeline restores.
- Choose an export destination and confirm the file appears at the selected path.

## 3. Microphone QA

- Start voice-over recording and allow microphone permission when Windows asks.
- Record 5–10 seconds, stop recording, and confirm the new audio clip appears on the timeline.
- Play the clip and confirm the recorded voice is audible.

## 4. Live stock API QA

Set one or both API keys in PowerShell, then run:

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

The script detects NVENC, Intel QSV, and AMD AMF encoders exposed by the bundled FFmpeg and attempts a real 3-second hardware H.264 export on the current machine. At least one detected encoder must produce a valid MP4.

Then export a short real project from the app using **GPU** mode and confirm playback. Repeat in **Auto** mode to confirm CPU fallback remains available if the GPU path fails.

## 6. Final acceptance

- Basic editing still works with the network disconnected.
- MP4 export works.
- MP3 audio-only export works.
- 1080p and 4K project/export settings are selectable.
- Undo/redo, split, ripple trim, clip movement, text, transitions, SFX, save/recovery, and shortcuts work without a crash.

Record any failing step with the exact error text and a screenshot. Do not mark the master tracker complete until all real-environment checks pass.
