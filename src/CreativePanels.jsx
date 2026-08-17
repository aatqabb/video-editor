import { useMemo, useRef, useState } from 'react'
import './CreativePanels.css'

const COMMON_FONTS = ['Segoe UI', 'Arial', 'Calibri', 'Cambria', 'Georgia', 'Verdana', 'Trebuchet MS', 'Times New Roman', 'Courier New', 'Impact']

export function TextWorkspace({ selectedTextClip, onAddText, onUpdateText, notify }) {
  const [text, setText] = useState('Your text here')
  const [fontFamily, setFontFamily] = useState('Segoe UI')
  const [fontSize, setFontSize] = useState(64)
  const [color, setColor] = useState('#ffffff')
  const [background, setBackground] = useState('#00000000')
  const [align, setAlign] = useState('center')
  const [bold, setBold] = useState(false)
  const [italic, setItalic] = useState(false)
  const [underline, setUnderline] = useState(false)
  const [x, setX] = useState(50)
  const [y, setY] = useState(50)
  const [animationIn, setAnimationIn] = useState('Fade In')
  const [animationOut, setAnimationOut] = useState('Fade Out')
  const [animationDuration, setAnimationDuration] = useState(0.45)
  const [duration, setDuration] = useState(5)
  const [fonts, setFonts] = useState(COMMON_FONTS)
  const customFontRef = useRef(null)

  const draft = { text, fontFamily, fontSize, color, background, align, bold, italic, underline, x, y, animationIn, animationOut, animationDuration, duration }

  const loadPcFonts = async () => {
    if (!window.queryLocalFonts) return notify('This browser does not expose installed fonts; common fonts are available')
    try {
      const localFonts = await window.queryLocalFonts()
      const names = [...new Set(localFonts.map((font) => font.family).filter(Boolean))].sort()
      setFonts([...new Set([...COMMON_FONTS, ...names])])
      notify(`${names.length} PC fonts loaded`)
    } catch { notify('Font access was not granted') }
  }

  const loadCustomFont = async (file) => {
    if (!file) return
    try {
      const family = file.name.replace(/\.[^.]+$/, '') || 'Custom Font'
      const data = await file.arrayBuffer()
      const fontFace = new FontFace(family, data)
      await fontFace.load(); document.fonts.add(fontFace)
      setFonts((items) => [...new Set([...items, family])]); setFontFamily(family)
      notify(`${family} loaded for this session`)
    } catch { notify('Could not load that font file') }
  }

  const updateSelected = (patch) => {
    if (!selectedTextClip) return notify('Select a text clip on the timeline first')
    onUpdateText(selectedTextClip.id, patch)
  }

  return (
    <div className="creative-panel text-workspace">
      <div className="creative-heading"><strong>TEXT</strong><span>{selectedTextClip ? 'Editing selected text' : 'New text layer'}</span></div>
      <textarea className="text-content-input" value={text} onChange={(event) => setText(event.target.value)} />
      <div className="creative-row">
        <select value={fontFamily} onChange={(event) => setFontFamily(event.target.value)}>{fonts.map((font) => <option key={font}>{font}</option>)}</select>
        <input className="number-input" type="number" min="8" max="400" value={fontSize} onChange={(event) => setFontSize(Number(event.target.value))} />
      </div>
      <div className="creative-row wrap">
        <button className={bold ? 'active' : ''} onClick={() => setBold((value) => !value)}><b>B</b></button>
        <button className={italic ? 'active' : ''} onClick={() => setItalic((value) => !value)}><i>I</i></button>
        <button className={underline ? 'active' : ''} onClick={() => setUnderline((value) => !value)}><u>U</u></button>
        {['left', 'center', 'right'].map((value) => <button key={value} className={align === value ? 'active' : ''} onClick={() => setAlign(value)}>{value[0].toUpperCase()}</button>)}
        <label className="color-control">Text <input type="color" value={color} onChange={(event) => setColor(event.target.value)} /></label>
        <label className="color-control">BG <input type="color" value={background.length === 7 ? background : '#000000'} onChange={(event) => setBackground(event.target.value)} /></label>
      </div>
      <div className="creative-grid two">
        <label>X %<input type="number" min="0" max="100" value={x} onChange={(event) => setX(Number(event.target.value))} /></label>
        <label>Y %<input type="number" min="0" max="100" value={y} onChange={(event) => setY(Number(event.target.value))} /></label>
        <label>Layer duration<input type="number" min="0.5" step="0.5" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
        <label>Anim duration<input type="number" min="0.1" max="3" step="0.1" value={animationDuration} onChange={(event) => setAnimationDuration(Number(event.target.value))} /></label>
      </div>
      <div className="creative-grid two">
        <label>Animation In<select value={animationIn} onChange={(event) => setAnimationIn(event.target.value)}>{['None','Fade In','Slide Up','Slide Down','Slide Left','Slide Right','Zoom In','Pop','Typewriter','Blur In'].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label>Animation Out<select value={animationOut} onChange={(event) => setAnimationOut(event.target.value)}>{['None','Fade Out','Slide Up','Slide Down','Slide Left','Slide Right','Zoom Out','Shrink','Blur Out'].map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <div className="creative-row wrap">
        <button onClick={loadPcFonts}>Load PC Fonts</button><button onClick={() => customFontRef.current?.click()}>Custom Font</button>
        <input ref={customFontRef} type="file" accept=".ttf,.otf,.woff,.woff2" hidden onChange={(event) => loadCustomFont(event.target.files?.[0])} />
      </div>
      <div className="creative-actions"><button className="primary" onClick={() => onAddText(draft)}>+ Add Text Layer</button><button onClick={() => updateSelected(draft)}>Apply to Selected</button></div>
    </div>
  )
}

export function TransitionWorkspace({ onApply, notify }) {
  const [duration, setDuration] = useState(0.45)
  const transitions = ['Cross Dissolve','Fade','Dip to Black','Dip to White','Slide Left','Slide Right','Push','Zoom In','Zoom Out','Smooth Zoom In','Smooth Zoom Out','Light Leak Warm','Light Leak Cool','Light Leak Film','Whip Pan','Flash','Blur Transition','Spin Zoom','Camera Shake']
  return <div className="creative-panel"><div className="creative-heading"><strong>TRANSITIONS</strong><span>Apply to selected video clip</span></div><label className="creative-slider">Duration <input type="range" min="0.1" max="2" step="0.05" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /><span>{duration.toFixed(2)}s</span></label><div className="preset-grid">{transitions.map((transition) => <button key={transition} onClick={() => { onApply(transition, duration); notify(`${transition} applied`) }}>{transition}</button>)}</div></div>
}

export function EffectsWorkspace({ onApply, onReset, notify }) {
  const [intensity, setIntensity] = useState(50)
  const effects = ['Blur','Sharpen','Vignette','Grayscale','Brightness','Contrast','Saturate','Sepia','Hue Rotate','Film Grain']
  return <div className="creative-panel"><div className="creative-heading"><strong>VIDEO EFFECTS</strong><button onClick={() => { onReset(); notify('Effects reset') }}>Reset</button></div><label className="creative-slider">Intensity <input type="range" min="0" max="100" value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} /><span>{intensity}%</span></label><div className="preset-grid">{effects.map((effect) => <button key={effect} onClick={() => { onApply(effect, intensity); notify(`${effect} applied`) }}>{effect}</button>)}</div></div>
}

const BUILT_IN_SFX = [
  { id:'whoosh',name:'Whoosh',duration:.7 },{ id:'whoosh-fast',name:'Whoosh Fast',duration:.4 },{ id:'impact',name:'Impact Hit',duration:.5 },{ id:'cinematic-hit',name:'Cinematic Hit',duration:.8 },{ id:'pop',name:'Pop',duration:.25 },{ id:'rise',name:'Rise',duration:1.2 },{ id:'glitch',name:'Glitch',duration:.55 },{ id:'bass',name:'Bass Drop',duration:.9 },{ id:'swipe',name:'Swipe',duration:.45 },{ id:'boom',name:'Boom',duration:1 },{ id:'typing',name:'Typing',duration:.8 },{ id:'notification',name:'Notification',duration:.35 },{ id:'click',name:'Camera Click',duration:.2 },{ id:'transition',name:'Transition Sweep',duration:.65 },{ id:'reverse',name:'Reverse Whoosh',duration:.8 },{ id:'riser-short',name:'Short Riser',duration:.7 }
]

function synthTone(sfx) {
  const AudioContext = window.AudioContext || window.webkitAudioContext
  if (!AudioContext) return
  const context = new AudioContext(); const oscillator = context.createOscillator(); const gain = context.createGain(); oscillator.connect(gain); gain.connect(context.destination)
  const now=context.currentTime; const end=now+Math.min(1.5,sfx.duration); const low=['impact','cinematic-hit','bass','boom'].includes(sfx.id); const high=['pop','notification','typing','click'].includes(sfx.id)
  oscillator.type=sfx.id==='glitch'?'square':low?'sine':'triangle'; oscillator.frequency.setValueAtTime(low?90:high?720:240,now); oscillator.frequency.exponentialRampToValueAtTime(low?45:high?420:80,end); gain.gain.setValueAtTime(.001,now); gain.gain.exponentialRampToValueAtTime(.22,now+.02); gain.gain.exponentialRampToValueAtTime(.001,end); oscillator.start(now); oscillator.stop(end); oscillator.addEventListener('ended',()=>context.close())
}

export function SfxWorkspace({ onAddSfx, notify }) {
  const [search,setSearch]=useState(''); const fileRef=useRef(null); const filtered=useMemo(()=>BUILT_IN_SFX.filter((sfx)=>sfx.name.toLowerCase().includes(search.toLowerCase())),[search])
  const importOwnSfx=(file)=>{ if(!file)return; const url=URL.createObjectURL(file); const audio=new Audio(url); audio.addEventListener('loadedmetadata',()=>{onAddSfx({id:`custom-${Date.now()}`,name:file.name,duration:Number.isFinite(audio.duration)?audio.duration:3,url,custom:true});notify(`${file.name} added to timeline`)},{once:true});audio.addEventListener('error',()=>notify('Could not read that audio file'),{once:true}) }
  return <div className="creative-panel sfx-workspace"><div className="creative-heading"><strong>SFX LIBRARY</strong><button onClick={()=>fileRef.current?.click()}>+ Import SFX</button></div><input className="creative-search" placeholder="Search SFX" value={search} onChange={(event)=>setSearch(event.target.value)} /><input ref={fileRef} type="file" accept="audio/*" hidden onChange={(event)=>importOwnSfx(event.target.files?.[0])} /><div className="sfx-list">{filtered.map((sfx)=><div className="sfx-row" key={sfx.id} draggable onDragStart={(event)=>{event.dataTransfer.effectAllowed='copy';event.dataTransfer.setData('application/x-video-editor-sfx',JSON.stringify(sfx))}}><button className="sfx-play" onClick={()=>synthTone(sfx)}>▶</button><span>{sfx.name}</span><small>{sfx.duration.toFixed(2)}s</small><button onClick={()=>onAddSfx(sfx)}>Add</button></div>)}</div></div>
}
