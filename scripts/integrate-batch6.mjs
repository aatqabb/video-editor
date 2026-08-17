import fs from 'node:fs'

const path = process.argv[2] || 'src/App.jsx'
let code = fs.readFileSync(path, 'utf8')

if (!code.includes("from './projectPersistence'")) {
  code = code.replace(
    "import { AudioControls, VideoControls, VoiceoverWorkspace } from './ClipControls'\n",
    "import { AudioControls, VideoControls, VoiceoverWorkspace } from './ClipControls'\nimport ProjectWorkspace from './ProjectWorkspace'\nimport { buildProjectDocument, clearAutosave, getRecentProjects, readAutosave, readProjectFile, rememberProject, saveProjectFile, writeAutosave } from './projectPersistence'\n",
  )
}

code = code.replace(
  "const leftTabs = ['Project', 'Effect Controls', 'Effects', 'Tools', 'Text', 'Properties']",
  "const leftTabs = ['Media', 'Project', 'Effect Controls', 'Effects', 'Tools', 'Text', 'Properties']",
)

if (!code.includes('const [projectName, setProjectName]')) {
  const marker = "  const [leftTab, setLeftTab] = useState('Project')"
  const replacement = `  const [leftTab, setLeftTab] = useState('Media')\n  const [projectName, setProjectName] = useState('Untitled Project')\n  const [projectSettings, setProjectSettings] = useState({ aspect: '16:9', resolution: '1080p', width: 1920, height: 1080, fps: 30 })\n  const [saveHandle, setSaveHandle] = useState(null)\n  const [recentProjects, setRecentProjects] = useState(() => getRecentProjects())\n  const [recoveryAvailable, setRecoveryAvailable] = useState(() => Boolean(readAutosave()))\n  const [autosaveTime, setAutosaveTime] = useState(null)`
  if (!code.includes(marker)) throw new Error('leftTab state marker missing')
  code = code.replace(marker, replacement)
}

if (!code.includes('const getProjectDocument =')) {
  const marker = '  const startVerticalResize = (side, event) => {'
  const block = `  const getProjectDocument = () => buildProjectDocument({\n    name: projectName, settings: projectSettings, clips, tracks, markers, playhead,\n  })\n\n  const applyProjectDocument = (document) => {\n    setProjectName(document.name || 'Untitled Project')\n    setProjectSettings(document.settings || { aspect: '16:9', resolution: '1080p', width: 1920, height: 1080, fps: 30 })\n    setClips(cloneClips(document.timeline.clips || []))\n    setTracks((document.timeline.tracks || initialTracks).map((track) => ({ ...track })))\n    setMarkers([...(document.timeline.markers || [])])\n    setPlayhead(Number(document.timeline.playhead) || 0)\n    setSelectedClipIds([])\n    setHistory([])\n    setFuture([])\n  }\n\n  const saveProject = async (forceNewLocation = false) => {\n    try {\n      const project = getProjectDocument()\n      const result = await saveProjectFile(project, saveHandle, forceNewLocation)\n      setSaveHandle(result.handle || null)\n      setRecentProjects(rememberProject(project, 'saved'))\n      clearAutosave()\n      setRecoveryAvailable(false)\n      notify(result.method === 'picker' ? 'Project saved' : 'Project file downloaded')\n    } catch (error) {\n      if (error?.name === 'AbortError') return\n      notify(error?.message || 'Could not save project')\n    }\n  }\n\n  const openProject = async (file) => {\n    if (!file) return\n    try {\n      const project = await readProjectFile(file)\n      applyProjectDocument(project)\n      setSaveHandle(null)\n      setRecentProjects(rememberProject(project, 'opened'))\n      notify(\`Opened \${project.name}\`)\n    } catch (error) {\n      notify(error?.message || 'Could not open project')\n    }\n  }\n\n  const recoverProject = () => {\n    const project = readAutosave()\n    if (!project) return notify('No recovery autosave found')\n    applyProjectDocument(project)\n    setRecoveryAvailable(false)\n    notify('Latest autosave recovered')\n  }\n\n`
  if (!code.includes(marker)) throw new Error('resize marker missing')
  code = code.replace(marker, block + marker)
}

if (!code.includes('writeAutosave(project)')) {
  const marker = '  const renderLeftBody = () => {'
  const effect = `  useEffect(() => {\n    const timer = window.setTimeout(() => {\n      const project = buildProjectDocument({ name: projectName, settings: projectSettings, clips, tracks, markers, playhead })\n      if (writeAutosave(project)) {\n        setAutosaveTime(Date.now())\n        setRecoveryAvailable(true)\n      }\n    }, 1200)\n    return () => window.clearTimeout(timer)\n  }, [projectName, projectSettings, clips, tracks, markers, playhead])\n\n`
  if (!code.includes(marker)) throw new Error('renderLeftBody marker missing')
  code = code.replace(marker, effect + marker)
}

if (code.includes("    if (leftTab === 'Project') {")) {
  code = code.replace("    if (leftTab === 'Project') {", "    if (leftTab === 'Media') {")
}

if (!code.includes('<ProjectWorkspace')) {
  const marker = "    if (leftTab === 'Effects') {"
  const block = `    if (leftTab === 'Project') {\n      return (\n        <ProjectWorkspace\n          name={projectName}\n          setName={setProjectName}\n          settings={projectSettings}\n          setSettings={setProjectSettings}\n          onSave={() => saveProject(false)}\n          onSaveAs={() => saveProject(true)}\n          onOpenProject={openProject}\n          onRecover={recoverProject}\n          recoveryAvailable={recoveryAvailable}\n          autosaveTime={autosaveTime}\n          recentProjects={recentProjects}\n          notify={notify}\n        />\n      )\n    }\n\n`
  if (!code.includes(marker)) throw new Error('Effects branch marker missing')
  code = code.replace(marker, block + marker)
}

code = code.replace('<div className="project-title">Untitled Project</div>', '<button className="project-title" onClick={() => setLeftTab(\'Project\')} title="Project settings">{projectName}</button>')

if (!code.includes('projectSettings={projectSettings}')) {
  code = code.replace(
    '<div className="panel-body center-body"><Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} /></div>',
    '<div className="panel-body center-body"><Monitor playing={playing} setPlaying={setPlaying} notify={notify} timelineClips={clips} playhead={playhead} projectSettings={projectSettings} /></div>',
  )
}

code = code.replace(
  'function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0 }) {',
  "function Monitor({ playing, setPlaying, notify, empty = false, timelineClips = [], playhead = 0, projectSettings = { width: 1920, height: 1080 } }) {",
)

if (!code.includes('canvasAspect')) {
  const marker = "  const activeClips = empty ? [] : timelineClips.filter((clip) => playhead >= clip.start && playhead < clip.start + clip.duration)"
  code = code.replace(marker, `  const canvasAspect = \`\${projectSettings.width || 1920} / \${projectSettings.height || 1080}\`\n${marker}`)
}

code = code.replace(
  '<div className={`monitor-screen ${empty ? \'empty\' : \'program\'}`} style={empty ? undefined : effectStyle}>',
  '<div className={`monitor-screen ${empty ? \'empty\' : \'program\'}`} style={empty ? undefined : { ...effectStyle, aspectRatio: canvasAspect }}>',
)

fs.writeFileSync(path, code)
console.log(`Patched ${path}`)
