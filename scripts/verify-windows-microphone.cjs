const { app, BrowserWindow, ipcMain, session } = require('electron')

const timeoutMs = 20000
let timeout

function finish(code, message) {
  clearTimeout(timeout)
  console.log(message)
  app.exit(code)
}

app.whenReady().then(async () => {
  if (process.platform !== 'win32') {
    finish(1, 'FAIL microphone QA must run on Windows.')
    return
  }

  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === 'media')
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === 'media'))

  ipcMain.once('mic-result', (_event, result) => {
    if (result?.ok && result.bytes > 0) finish(0, `PASS Windows microphone captured ${result.bytes} bytes using MediaRecorder (${result.mimeType || 'default mime'}).`)
    else finish(1, `FAIL Windows microphone capture: ${result?.error || 'empty recording'}`)
  })

  const win = new BrowserWindow({
    width: 520,
    height: 300,
    show: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  const html = `<!doctype html><html><body style="font-family:Segoe UI;background:#181818;color:#eee;padding:24px">
  <h2>Video Editor — Microphone QA</h2><p>Testing the default Windows microphone for about 2 seconds…</p>
  <script>
  const { ipcRenderer } = require('electron');
  (async () => {
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('getUserMedia is unavailable');
      if (!window.MediaRecorder) throw new Error('MediaRecorder is unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks = [];
      const recorder = new MediaRecorder(stream);
      recorder.ondataavailable = (event) => { if (event.data?.size) chunks.push(event.data) };
      recorder.onerror = (event) => ipcRenderer.send('mic-result', { ok:false, error:event.error?.message || 'MediaRecorder error' });
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());
        ipcRenderer.send('mic-result', { ok: blob.size > 0, bytes: blob.size, mimeType: blob.type, error: blob.size ? null : 'recording blob was empty' });
      };
      recorder.start(250);
      setTimeout(() => recorder.stop(), 2000);
    } catch (error) {
      ipcRenderer.send('mic-result', { ok:false, error:error?.message || String(error) });
    }
  })();
  </script></body></html>`

  await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
  timeout = setTimeout(() => finish(1, 'FAIL Windows microphone QA timed out waiting for audio capture.'), timeoutMs)
}).catch((error) => finish(1, `FAIL Windows microphone QA startup: ${error.message}`))
