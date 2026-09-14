// Free, rule-based "scene/action -> sound effect" matching.
//
// Shared by the Script Breakdown tool (per-scene SFX suggestion) and can be
// reused by a dedicated SFX Finder later. No paid API — matches action words
// in a line to the app's own BUILT_IN_SFX library (see CreativePanels.jsx)
// where a decent match exists, and otherwise returns an honest free-text
// suggestion so the user knows what to search/import instead of a fake match.

// Keep these ids/durations in sync with BUILT_IN_SFX in src/CreativePanels.jsx.
const LIBRARY_SFX = {
  whoosh: { name: 'Whoosh', duration: .7 }, 'whoosh-fast': { name: 'Whoosh Fast', duration: .4 },
  impact: { name: 'Impact Hit', duration: .5 }, 'cinematic-hit': { name: 'Cinematic Hit', duration: .8 },
  pop: { name: 'Pop', duration: .25 }, rise: { name: 'Rise', duration: 1.2 }, glitch: { name: 'Glitch', duration: .55 },
  bass: { name: 'Bass Drop', duration: .9 }, swipe: { name: 'Swipe', duration: .45 }, boom: { name: 'Boom', duration: 1 },
  typing: { name: 'Typing', duration: .8 }, notification: { name: 'Notification', duration: .35 },
  click: { name: 'Camera Click', duration: .2 }, transition: { name: 'Transition Sweep', duration: .65 },
  reverse: { name: 'Reverse Whoosh', duration: .8 }, 'riser-short': { name: 'Short Riser', duration: .7 },
}

// Returns a ready-to-use SFX object (same shape the SFX library timeline drop
// expects) for a matched libraryId, or null when there's no built-in sound.
export function getLibrarySfx(libraryId) {
  const entry = libraryId ? LIBRARY_SFX[libraryId] : null
  if (!entry) return null
  return { id: libraryId, name: entry.name, duration: entry.duration, url: `${import.meta.env.BASE_URL}sfx/${libraryId}.wav`, packaged: true }
}

const SFX_RULES = [
  { match: /\b(tension|suspense|building up|about to|moment of truth|countdown)\b/i, libraryId: 'rise', label: 'Tension riser' },
  { match: /\b(shock(ing)?|twist|reveal(ed)?|surprise|suddenly|out of nowhere)\b/i, libraryId: 'cinematic-hit', label: 'Dramatic hit' },
  { match: /\b(crash(ed)?|collapse(d)?|explosion|explod(e|ed)|boom|blast)\b/i, libraryId: 'boom', label: 'Boom / impact', note: 'Built-in "Boom" is a generic low hit — for a realistic explosion, import a dedicated SFX file' },
  { match: /\b(type(d|s)?|typing|keyboard|texting)\b/i, libraryId: 'typing', label: 'Typing' },
  { match: /\b(notification|alert|message|ping|ding)\b/i, libraryId: 'notification', label: 'Notification' },
  { match: /\b(photo|camera|snapshot|picture taken)\b/i, libraryId: 'click', label: 'Camera click' },
  { match: /\b(transition|cut to|meanwhile|years? later|fast[- ]forward|time passes?)\b/i, libraryId: 'transition', label: 'Transition sweep' },
  { match: /\b(swipe|slide|scroll)\b/i, libraryId: 'swipe', label: 'Swipe' },
  { match: /\b(glitch|error|malfunction|hacked|corrupt(ed)?)\b/i, libraryId: 'glitch', label: 'Glitch' },
  { match: /\b(pop up|appear(s|ed)?|small win|tick|checkmark)\b/i, libraryId: 'pop', label: 'Pop' },
  { match: /\b(bass|drop|heavy beat|impact moment)\b/i, libraryId: 'bass', label: 'Bass drop' },
  { match: /\b(rewind|flashback|going back)\b/i, libraryId: 'reverse', label: 'Reverse whoosh' },
  { match: /\b(quick cut|snap|fast reveal)\b/i, libraryId: 'riser-short', label: 'Short riser' },
  { match: /\b(whoosh|swish|fast movement|zoom(ed)? (past|by))\b/i, libraryId: 'whoosh', label: 'Whoosh' },

  // Common real-world actions the built-in library doesn't cover well — be
  // honest instead of forcing a bad match, and suggest what to search for.
  { match: /\b(door (opened?|closed?|slam(med)?)|knock(ed|ing)?)\b/i, libraryId: null, label: 'Door sound (import needed)', note: 'No built-in door SFX — search "door open/close" or "knock" and use Import SFX' },
  { match: /\b(money|cash|coins?|dollars?|paid|payment|purchase)\b/i, libraryId: null, label: 'Cash/coin sound (import needed)', note: 'No built-in cash SFX — search "coin drop" or "cash register" and use Import SFX' },
  { match: /\b(footsteps?|walk(ed|ing)?|running|ran)\b/i, libraryId: null, label: 'Footsteps (import needed)', note: 'No built-in footsteps SFX — import one if the scene needs it' },
  { match: /\b(crowd|cheer(ed|ing)?|applause|clap(ping)?|stadium)\b/i, libraryId: null, label: 'Crowd/cheer (import needed)', note: 'No built-in crowd SFX — search "crowd cheer" and use Import SFX' },
  { match: /\b(phone (ring|rang)|calling|call(ed)?)\b/i, libraryId: null, label: 'Phone ring (import needed)', note: 'No built-in phone SFX — import one if the scene needs it' },
  { match: /\b(rain|thunder|wind|storm)\b/i, libraryId: null, label: 'Weather ambience (import needed)', note: 'No built-in weather SFX — import one if the scene needs it' },
]

export function suggestSfxForLine(lineText) {
  const text = String(lineText || '')
  const rule = SFX_RULES.find((entry) => entry.match.test(text))
  if (!rule) return null
  return {
    label: rule.label,
    libraryId: rule.libraryId,
    libraryName: rule.libraryId ? LIBRARY_SFX[rule.libraryId]?.name : null,
    note: rule.note || '',
  }
}
