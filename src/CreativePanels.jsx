import { useMemo, useRef, useState } from 'react'
import { splitScriptText } from './stockApi'
import { getLibrarySfx, suggestSfxForLine } from './sfxSuggestions'
import './CreativePanels.css'

const COMMON_FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New', 'Impact']

const TEXT_IN_ANIMATIONS = [
  ['None', 'None'], ['Fade In', 'Fade In'], ['Slide Up', 'Slide Up'], ['Slide Down', 'Slide Down'], ['Slide Left', 'Slide Left'], ['Slide Right', 'Slide Right'], ['Zoom In', 'Zoom In'], ['Popup', 'Pop'], ['Bounce', 'Bounce'], ['Word by Word', 'Word Reveal'], ['Letter by Letter', 'Typewriter'], ['Reveal', 'Typewriter'], ['Blur In', 'Blur In'], ['Zoom + Fade', 'Zoom In Fade'], ['Rise + Fade', 'Slide Up Fade'], ['Drop + Fade', 'Slide Down Fade'], ['Reveal Left', 'Slide Left Fade'], ['Reveal Right', 'Slide Right Fade'], ['Blur + Zoom', 'Blur Zoom In'],
]
const TEXT_OUT_ANIMATIONS = [
  ['None', 'None'], ['Fade Out', 'Fade Out'], ['Slide Up', 'Slide Up'], ['Slide Down', 'Slide Down'], ['Slide Left', 'Slide Left'], ['Slide Right', 'Slide Right'], ['Zoom Out', 'Zoom Out'], ['Bounce Out', 'Bounce Out'], ['Reveal Out', 'Fade Out'], ['Blur Out', 'Blur Out'], ['Zoom + Fade Out', 'Zoom Out Fade'], ['Rise + Fade Out', 'Slide Up Fade'], ['Drop + Fade Out', 'Slide Down Fade'], ['Exit Left + Fade', 'Slide Left Fade'], ['Exit Right + Fade', 'Slide Right Fade'], ['Blur + Zoom Out', 'Blur Zoom Out'],
]

// Recommended starting styles — applying one just fills in the same controls
// below, so every value stays fully editable afterwards (nothing is locked).
const TEXT_PRESETS = [
  { name: 'Title', fontSize: 96, color: '#ffffff', background: '#00000000', align: 'center', bold: true, italic: false, underline: false, x: 50, y: 32, animationIn: 'Zoom In Fade', animationOut: 'Fade Out', animationDuration: .5, duration: 4 },
  { name: 'Caption', fontSize: 40, color: '#ffffff', background: '#000000b3', align: 'center', bold: false, italic: false, underline: false, x: 50, y: 88, animationIn: 'Fade In', animationOut: 'Fade Out', animationDuration: .3, duration: 3 },
  { name: 'Lower Third', fontSize: 44, color: '#ffffff', background: '#0f172acc', align: 'left', bold: true, italic: false, underline: false, x: 22, y: 84, animationIn: 'Slide Right Fade', animationOut: 'Fade Out', animationDuration: .45, duration: 5 },
  { name: 'Callout', fontSize: 52, color: '#111111', background: '#ffd400', align: 'center', bold: true, italic: false, underline: false, x: 50, y: 50, animationIn: 'Bounce', animationOut: 'Bounce Out', animationDuration: .4, duration: 3 },
]

// One-click In+Out+Duration bundles — every animation type here now really
// renders in the exported video (previously only the Fade family did), so
// these are worth surfacing as ready-made combos rather than three separate
// dropdowns/fields to set by hand.
const ANIMATION_PRESETS = [
  { name: 'Fade', animationIn: 'Fade In', animationOut: 'Fade Out', animationDuration: .4 },
  { name: 'Bounce', animationIn: 'Bounce', animationOut: 'Bounce Out', animationDuration: .4 },
  { name: 'Pop + Fade', animationIn: 'Pop', animationOut: 'Fade Out', animationDuration: .3 },
  { name: 'Word by Word', animationIn: 'Word Reveal', animationOut: 'Fade Out', animationDuration: 1.4 },
  { name: 'Letter by Letter', animationIn: 'Typewriter', animationOut: 'Fade Out', animationDuration: 1.2 },
  { name: 'Slide Up + Fade', animationIn: 'Slide Up Fade', animationOut: 'Fade Out', animationDuration: .4 },
  { name: 'Zoom + Fade', animationIn: 'Zoom In Fade', animationOut: 'Zoom Out Fade', animationDuration: .45 },
  { name: 'Slide Left/Right', animationIn: 'Slide Left Fade', animationOut: 'Slide Right Fade', animationDuration: .4 },
]

const POSITION_PRESETS = [
  { label: '↖', x: 10, y: 12 }, { label: '↑', x: 50, y: 12 }, { label: '↗', x: 90, y: 12 },
  { label: '←', x: 10, y: 50 }, { label: '•', x: 50, y: 50 }, { label: '→', x: 90, y: 50 },
  { label: '↙', x: 10, y: 88 }, { label: '↓', x: 50, y: 88 }, { label: '↘', x: 90, y: 88 },
]

export function TextWorkspace({ selectedTextClip, onAddText, onUpdateText, notify }) {
  const [text, setText] = useState('Your text here')
  const [fontFamily, setFontFamily] = useState('Segoe UI')
  const [fontSize, setFontSize] = useState(64)
  const [color, setColor] = useState('#ffffff')
  const [background, setBackground] = useState('#00000000')
  const [showBackground, setShowBackground] = useState(false)
  const [align, setAlign] = useState('center')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [wrap, setWrap] = useState(true)
  const [x, setX] = useState(50)
  const [y, setY] = useState(50)
  const [animationIn, setAnimationIn] = useState('Fade In')
  const [animationOut, setAnimationOut] = useState('Fade Out')
  const [animationDuration, setAnimationDuration] = useState(.45)
  const [duration, setDuration] = useState(5)
  const [fonts, setFonts] = useState(COMMON_FONTS)
  const [customFontPaths, setCustomFontPaths] = useState({})
  const customFontRef = useRef(null)

  const draft = {
    text, fontFamily, fontSize, color, background: showBackground ? background : '#00000000', align, bold, italic, underline, wrap,
    x, y, animationIn, animationOut, animationDuration, duration, fontFilePath: customFontPaths[fontFamily] || null,
  }

  const loadPcFonts = async () => {
    if (!window.queryLocalFonts) return notify('This browser does not expose installed fonts; common fonts are available')
    try {
      const localFonts = await window.queryLocalFonts()
      const names = [...new Set(localFonts.map((font) => font.family).filter(Boolean))].sort()
      setFonts([...new Set([...COMMON_FONTS, ...names])])
      notify(`${names.length} PC fonts loaded`)
    } catch {
      notify('Font access was not granted')
    }
  }

  const loadCustomFont = async (file) => {
    if (!file) return
    try {
      const family = file.name.replace(/\.[^.]+$/, '') || 'Custom Font'
      const data = await file.arrayBuffer()
      const fontFace = new FontFace(family, data)
      await fontFace.load()
      document.fonts.add(fontFace)
      const realPath = window.videoEditorDesktop?.getPathForFile?.(file) || null
      setFonts((items) => [...new Set([...items, family])])
      setCustomFontPaths((paths) => ({ ...paths, [family]: realPath }))
      setFontFamily(family)
      notify(realPath ? `${family} loaded — will also burn into exported video` : `${family} loaded for preview only (export will use a close system font)`)
    } catch {
      notify('Could not load that font file')
    }
  }

  const updateSelected = (patch) => {
    if (!selectedTextClip) return notify('Select a text clip on the timeline first')
    onUpdateText(selectedTextClip.id, patch)
  }

  const applyPreset = (preset) => {
    setFontSize(preset.fontSize); setColor(preset.color)
    setShowBackground(preset.background !== '#00000000'); setBackground(preset.background)
    setAlign(preset.align); setBold(preset.bold); setItalic(preset.italic); setUnderline(preset.underline)
    setX(preset.x); setY(preset.y)
    setAnimationIn(preset.animationIn); setAnimationOut(preset.animationOut); setAnimationDuration(preset.animationDuration); setDuration(preset.duration)
    notify(`${preset.name} preset applied — fully customizable, edit any field below`)
  }

  const activePresetName = ANIMATION_PRESETS.find((preset) => preset.animationIn === animationIn && preset.animationOut === animationOut)?.name

  return (
    <div className="creative-panel text-workspace">
      <div className="creative-heading"><strong>TEXT</strong><span>{selectedTextClip ? 'Editing selected text' : 'New text layer'}</span></div>

      <span className="creative-section-label">Quick style presets</span>
      <div className="text-preset-row">{TEXT_PRESETS.map((preset) => <button key={preset.name} onClick={() => applyPreset(preset)}>{preset.name}</button>)}</div>

      <textarea className="text-content-input" value={text} onChange={(event) => setText(event.target.value)} />

      <span className="creative-section-label">Style</span>
      <div className="creative-row">
        <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>{fonts.map((font) => <option key={font}>{font}</option>)}</select>
        <input className="number-input" type="number" min="8" max="400" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
      </div>

      <div className="creative-row wrap">
        <button className={bold ? 'active' : ''} onClick={() => setBold((value) => !value)} title="Bold"><b>B</b></button>
        <button className={italic ? 'active' : ''} onClick={() => setItalic((value) => !value)} title="Italic"><i>I</i></button>
        <button className={underline ? 'active' : ''} onClick={() => setUnderline((value) => !value)} title="Underline"><u>U</u></button>
        {['left', 'center', 'right'].map((value) => <button key={value} className={align === value ? 'active' : ''} onClick={() => setAlign(value)} title={`Align ${value}`}>{value[0].toUpperCase()}</button>)}
        <label className="color-control">Text <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <label className="text-bg-toggle"><input type="checkbox" checked={showBackground} onChange={(event) => setShowBackground(event.target.checked)} /> BG</label>
        {showBackground && <label className="color-control"><input type="color" value={background.length >= 7 ? background.slice(0, 7) : '#000000'} onChange={(event) => setBackground(`${event.target.value}b3`)} /></label>}
      </div>

      <div className="text-position-row">
        <span className="text-position-label">Position</span>
        <div className="text-position-grid">
          {POSITION_PRESETS.map((preset) => (
            <button key={preset.label} className={x === preset.x && y === preset.y ? 'active' : ''} onClick={() => { setX(preset.x); setY(preset.y) }}>{preset.label}</button>
          ))}
        </div>
        <div className="creative-grid two text-position-fine">
          <label>X %<input type="number" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
          <label>Y %<input type="number" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
        </div>
        <label className="text-bg-toggle"><input type="checkbox" checked={wrap} onChange={(event) => setWrap(event.target.checked)} /> Wrap long text (off = single line)</label>
      </div>

      <label className="creative-field-row">
        <span>Layer duration <small className="field-hint-inline">— total time this text stays on screen</small></span>
        <input type="number" min="0.5" step="0.5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} />
      </label>

      <div className="text-anim-card">
        <div className="text-anim-card-head">
          <span className="text-position-label">Animation</span>
          {activePresetName && <span className="text-anim-active-chip">{activePresetName}</span>}
        </div>

        <div className="anim-preset-row">
          {ANIMATION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              className={animationIn === preset.animationIn && animationOut === preset.animationOut ? 'active' : ''}
              onClick={() => { setAnimationIn(preset.animationIn); setAnimationOut(preset.animationOut); setAnimationDuration(preset.animationDuration); notify(`${preset.name} animation applied`) }}
            >
              {preset.name}
            </button>
          ))}
        </div>

        <div className="creative-grid two">
          <label>Animation In<select value={animationIn} onChange={(event) => setAnimationIn(event.target.value)}>{TEXT_IN_ANIMATIONS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select></label>
          <label>Animation Out<select value={animationOut} onChange={(event) => setAnimationOut(event.target.value)}>{TEXT_OUT_ANIMATIONS.map(([label, value]) => <option key={label} value={value}>{label}</option>)}</select></label>
        </div>

        <label className="creative-field-row anim-duration-field">
          <span>
            {animationIn === 'Word Reveal' || animationIn === 'Typewriter' ? 'Reveal duration' : 'Anim duration'}
            <small className="field-hint-inline">— entrance/exit only, separate from Layer duration above</small>
          </span>
          <input type="number" min="0.1" max="8" step="0.1" value={animationDuration} onChange={(event) => setAnimationDuration(Number(event.target.value))} />
        </label>
        <div className="anim-speed-row">
          {[['Fast', .3], ['Normal', .8], ['Slow', 1.6]].map(([label, value]) => (
            <button key={label} className={animationDuration === value ? 'active' : ''} onClick={() => setAnimationDuration(value)}>{label}</button>
          ))}
        </div>
      </div>

      <span className="creative-section-label">Fonts</span>
      <div className="creative-row wrap">
        <button onClick={loadPcFonts}>Load PC Fonts</button>
        <button onClick={() => customFontRef.current?.click()}>Custom Font</button>
        <input ref={customFontRef} type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={(event) => loadCustomFont(event.target.files?.[0])} />
      </div>

      <div className="creative-actions">
        <button className="primary" onClick={() => onAddText(draft)}>+ Add Text Layer</button>
        <button onClick={() => updateSelected(draft)}>Apply to Selected</button>
      </div>
    </div>
  )
}

export function TransitionWorkspace({ onApply, notify }) { const [duration,setDuration]=useState(.45); const transitions=['Cross Dissolve','Fade','Dip to Black','Dip to White','Slide Left','Slide Right','Push','Zoom In','Zoom Out','Smooth Zoom In','Smooth Zoom Out','Zoom In + Distort','Zoom Out + Distort','Zoom In Rotate','Zoom Out Rotate','Rotate + Zoom','Camera Push In','Camera Pull Out','Camera Pan Left','Camera Pan Right','Camera Tilt Up','Camera Tilt Down','Camera Shake','Handheld Camera','Whip Pan Left','Whip Pan Right','Light Leak Warm','Light Leak Cool','Light Leak Film','Flash','Blur Transition','Spin Zoom']; return <div className="creative-panel"><div className="creative-heading"><strong>TRANSITIONS</strong><span>Apply to selected video clip</span></div><label className="creative-slider">Duration <input type="range" min="0.1" max="2" step="0.05" value={duration} onChange={(event)=>setDuration(Number(event.target.value))}/><span>{duration.toFixed(2)}s</span></label><div className="preset-grid">{transitions.map((transition)=><button key={transition} onClick={()=>{onApply(transition,duration);notify(`${transition} applied`)}}>{transition}</button>)}</div></div> }
export function EffectsWorkspace({ onApply,onReset,notify }) { const [intensity,setIntensity]=useState(50); const effects=['Blur','Sharpen','Vignette','Grayscale','Brightness','Contrast','Saturate','Sepia','Hue Rotate','Film Grain']; return <div className="creative-panel"><div className="creative-heading"><strong>VIDEO EFFECTS</strong><button onClick={()=>{onReset();notify('Effects reset')}}>Reset</button></div><label className="creative-slider">Intensity <input type="range" min="0" max="100" value={intensity} onChange={(event)=>setIntensity(Number(event.target.value))}/><span>{intensity}%</span></label><div className="preset-grid">{effects.map((effect)=><button key={effect} onClick={()=>{onApply(effect,intensity);notify(`${effect} applied`)}}>{effect}</button>)}</div></div> }

const BUILT_IN_SFX = [
  {id:'whoosh',name:'Whoosh',duration:.7},{id:'whoosh-fast',name:'Whoosh Fast',duration:.4},{id:'impact',name:'Impact Hit',duration:.5},{id:'cinematic-hit',name:'Cinematic Hit',duration:.8},{id:'pop',name:'Pop',duration:.25},{id:'rise',name:'Rise',duration:1.2},{id:'glitch',name:'Glitch',duration:.55},{id:'bass',name:'Bass Drop',duration:.9},{id:'swipe',name:'Swipe',duration:.45},{id:'boom',name:'Boom',duration:1},{id:'typing',name:'Typing',duration:.8},{id:'notification',name:'Notification',duration:.35},{id:'click',name:'Camera Click',duration:.2},{id:'transition',name:'Transition Sweep',duration:.65},{id:'reverse',name:'Reverse Whoosh',duration:.8},{id:'riser-short',name:'Short Riser',duration:.7}
].map((sfx)=>({...sfx,url:`${import.meta.env.BASE_URL}sfx/${sfx.id}.wav`,packaged:true}))

export function SfxWorkspace({ onAddSfx, notify }) {
  const [mode,setMode]=useState('library')
  const [search,setSearch]=useState(''); const fileRef=useRef(null); const previewRef=useRef(null); const filtered=useMemo(()=>BUILT_IN_SFX.filter((sfx)=>sfx.name.toLowerCase().includes(search.toLowerCase())),[search])
  const [smartText,setSmartText]=useState(''); const [smartResults,setSmartResults]=useState([])
  const previewSfx=(sfx)=>{if(!sfx)return notify('No built-in SFX for this — import one manually');try{previewRef.current?.pause();const audio=new Audio(sfx.url);previewRef.current=audio;audio.play().catch(()=>notify('Could not preview that SFX'))}catch{notify('Could not preview that SFX')}}
  const importOwnSfx=(file)=>{if(!file)return;const url=URL.createObjectURL(file);const sourcePath=window.videoEditorDesktop?.getPathForFile?.(file)||'';const audio=new Audio(url);audio.addEventListener('loadedmetadata',()=>{onAddSfx({id:`custom-${Date.now()}`,name:file.name,duration:Number.isFinite(audio.duration)?audio.duration:3,url,sourcePath,custom:true});notify(sourcePath?`${file.name} added to timeline`:`${file.name} added for preview only — will be skipped in export`)},{once:true});audio.addEventListener('error',()=>notify('Could not read that audio file'),{once:true})}
  const runSmartFinder=()=>{
    const lines=splitScriptText(smartText)
    if(!lines.length)return notify('Scene ya action describe karo pehle')
    setSmartResults(lines.map((text,index)=>({id:`smart-${index}-${Date.now()}`,text,suggestion:suggestSfxForLine(text)})))
    notify(`${lines.length} line(s) analyzed`)
  }
  const addSmartSfx=(suggestion)=>{const sfx=getLibrarySfx(suggestion?.libraryId);if(!sfx)return notify('No built-in SFX for this — import one manually');onAddSfx(sfx)}
  return <div className="creative-panel sfx-workspace">
    <div className="creative-heading">
      <strong>{mode==='library'?'SFX LIBRARY':'SFX SMART FINDER'}</strong>
      <div className="sfx-mode-row">
        <button className={mode==='library'?'active':''} onClick={()=>setMode('library')}>Browse Library</button>
        <button className={mode==='smart'?'active':''} onClick={()=>setMode('smart')}>Smart Finder</button>
      </div>
      {mode==='library' && <button onClick={()=>fileRef.current?.click()}>+ Import SFX</button>}
    </div>
    {mode==='library' ? <>
      <input className="creative-search" placeholder="Search SFX" value={search} onChange={(event)=>setSearch(event.target.value)}/>
      <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(event)=>importOwnSfx(event.target.files?.[0])}/>
      <div className="sfx-list">{filtered.map((sfx)=><div className="sfx-row" key={sfx.id} draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-video-editor-sfx',JSON.stringify(sfx))}}><button className="sfx-play" onClick={()=>previewSfx(sfx)}>▶</button><span>{sfx.name}</span><small>{sfx.duration.toFixed(2)}s</small><button onClick={()=>onAddSfx(sfx)}>Add</button></div>)}</div>
    </> : <div className="sfx-smart-finder">
      <p className="sfx-smart-hint">Scene ya action likho (ek line ya poora script paste karo) — matching sound suggest karega. Free, rule-based hai, koi API nahi.</p>
      <textarea className="sfx-smart-input" value={smartText} onChange={(event)=>setSmartText(event.target.value)} placeholder="e.g. He knocked on the door nervously, then the phone rang..."/>
      <div className="sfx-smart-actions"><button className="primary" onClick={runSmartFinder}>Find Matching SFX</button></div>
      <div className="sfx-smart-results">
        {smartResults.map((item)=>(
          <div className="sfx-smart-row" key={item.id}>
            <span className="sfx-smart-text">{item.text}</span>
            {item.suggestion ? <div className="sfx-smart-match">
              <span className={`sfx-smart-chip${item.suggestion.libraryId?'':' missing'}`}>{item.suggestion.libraryId?item.suggestion.libraryName:item.suggestion.label}</span>
              {item.suggestion.libraryId && <>
                <button onClick={()=>previewSfx(getLibrarySfx(item.suggestion.libraryId))}>▶</button>
                <button onClick={()=>addSmartSfx(item.suggestion)}>+ Add</button>
              </>}
              {item.suggestion.note && <small className="sfx-smart-note">{item.suggestion.note}</small>}
            </div> : <span className="sfx-smart-none">No specific SFX cue detected — browse library manually</span>}
          </div>
        ))}
      </div>
    </div>}
  </div>
}
