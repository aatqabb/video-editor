// Script Breakdown Tool — turns a pasted script into a scene-by-scene table:
// narration, suggested visual, b-roll search keywords, SFX suggestion, and an
// estimated on-screen duration for each line.
//
// Same rule as every other tool in this app: NO paid AI/LLM API. Everything
// here is plain-JS pattern matching + arithmetic — free, offline, instant.

import { splitScriptText } from './stockApi'
import { suggestSfxForLine } from './sfxSuggestions'

// Average speaking pace for narrated YouTube content. Used only to *estimate*
// how long a line will likely be on screen — the editor can always override
// this by hand once the clip is placed on the timeline.
const WORDS_PER_MINUTE = 150

// General-purpose "line of narration -> what to show" concept map. This is
// deliberately broader than the finance/football-tuned CONCEPT_MAP in
// youtubeApi.js (that one is aimed at the AI Footage Finder's search
// queries) — Script Breakdown has to handle ANY everyday scene a script
// might describe (waking up, an argument, a business meeting, a football
// match, a philosophical idea), not just economic-history topics.
const VISUAL_CONCEPT_MAP = [
  // Daily routine / morning-night
  { match: /\b(wake(s|d)? up|waking up|alarm( clock)?|snooze)\b/i, concepts: ['alarm clock ringing', 'person waking up in bed', 'morning sunlight through window'] },
  { match: /\b(morning routine|brush(ing)? teeth|shower(ing)?|get(ting)? ready)\b/i, concepts: ['morning routine', 'bathroom mirror', 'getting ready for the day'] },
  { match: /\b(sleep(ing)?|bed(time)?|night(time)?|insomnia|can'?t sleep)\b/i, concepts: ['person sleeping', 'dark bedroom', 'clock at night'] },
  { match: /\b(breakfast|coffee|tea|eating|lunch|dinner|meal)\b/i, concepts: ['breakfast table', 'coffee cup close-up', 'eating meal'] },
  { match: /\b(commut(e|ing)|traffic|driving|drive to work|subway|train station)\b/i, concepts: ['morning commute', 'traffic on the road', 'crowded train station'] },

  // Work / business
  { match: /\b(ceo|startup|office|meeting|boardroom|entrepreneur|founder)\b/i, concepts: ['office meeting', 'business boardroom', 'startup team working'] },
  { match: /\b(deadline|overtime|overwork(ed)?|burnout|stress(ed)? at work)\b/i, concepts: ['tired office worker', 'clock on office wall', 'stacks of paperwork'] },
  { match: /\b(job interview|resume|hired|fired|layoffs?|unemployment)\b/i, concepts: ['job interview', 'unemployment line', 'office layoff'] },
  { match: /\b(handshake|deal|contract|negotiation|signed?)\b/i, concepts: ['business handshake', 'contract signing'] },
  { match: /\b(factory|manufacturing|assembly line|production line)\b/i, concepts: ['factory assembly line', 'manufacturing plant footage'] },
  { match: /\b(money|cash|coins?|dollars?|rich|wealth|poor|poverty)\b/i, concepts: ['stack of cash', 'counting money', 'wallet close-up'] },
  { match: /\b(bank run|withdraw(al|als)? their savings|queue(d)? outside (a |the )?banks?)\b/i, concepts: ['bank run', 'people queue outside bank', 'financial panic crowd'] },
  { match: /\b(stock market|wall street|trading|investors?|shares?|recession|inflation|economic (crisis|downturn))\b/i, concepts: ['stock market chart', 'wall street trading floor', 'economic crisis news footage'] },

  // Football / sports
  { match: /\b(stadium|crowd cheering|match|goal|championship|final|football|soccer)\b/i, concepts: ['football stadium crowd', 'match highlights', 'goal celebration'] },
  { match: /\b(training|practice|coach|locker room)\b/i, concepts: ['football training session', 'locker room footage'] },
  { match: /\b(referee|penalty|foul|red card|yellow card)\b/i, concepts: ['referee decision', 'football penalty kick'] },

  // Emotion / relationship
  { match: /\b(happy|smil(e|ing)|laugh(ing)?|joy(ful)?|celebrat(e|ion|ing))\b/i, concepts: ['people smiling', 'celebration moment', 'laughing together'] },
  { match: /\b(sad|cry(ing)?|tears|heartbreak|griev(e|ing))\b/i, concepts: ['person crying', 'sad expression close-up', 'rain on window'] },
  { match: /\b(angry|anger|furious|argument|fight(ing)?|shout(ing)?|yell(ing)?)\b/i, concepts: ['heated argument', 'angry expression', 'raised voices'] },
  { match: /\b(afraid|fear|scared|anxiety|anxious|nervous|panic)\b/i, concepts: ['anxious person', 'nervous pacing', 'tense close-up'] },
  { match: /\b(love|relationship|couple|marriage|wedding|date night)\b/i, concepts: ['couple together', 'wedding footage', 'romantic moment'] },
  { match: /\b(alone|lonely|isolat(ed|ion)|solitude)\b/i, concepts: ['person alone', 'empty room', 'solitary figure in nature'] },
  { match: /\b(friends?|friendship|hang(ing)? out|reunion)\b/i, concepts: ['friends hanging out', 'group of friends laughing'] },
  { match: /\b(family|parents?|mother|father|children|kids)\b/i, concepts: ['family together', 'parent and child', 'family dinner'] },

  // Thought / philosophy / motivation
  { match: /\b(think(ing)?|thought|idea|realiz(e|ation)|reflect(ion|ing)?)\b/i, concepts: ['person thinking', 'staring into distance', 'lightbulb moment'] },
  { match: /\b(decision|choice|choose|crossroads|dilemma)\b/i, concepts: ['crossroads path', 'person at a fork in the road', 'decision moment'] },
  { match: /\b(failure|failed|mistake|lost everything|hit rock bottom)\b/i, concepts: ['person facing failure', 'broken glass', 'empty room after loss'] },
  { match: /\b(success|achieve(ment)?|win(ning)?|victory|overcame|breakthrough)\b/i, concepts: ['success celebration', 'trophy raised', 'crossing finish line'] },
  { match: /\b(discipline|habit|routine|consistency|hard work)\b/i, concepts: ['person exercising discipline', 'daily habit routine', 'focused work session'] },
  { match: /\b(meditat(e|ion)|mindful(ness)?|breathe|calm|peace(ful)?)\b/i, concepts: ['meditation footage', 'calm nature scene', 'person breathing slowly'] },
  { match: /\b(quote|philosoph(y|er|ical)|wisdom|ancient|stoic)\b/i, concepts: ['old books', 'philosopher statue', 'candlelight and text'] },

  // Learning / tech
  { match: /\b(study(ing)?|student|school|university|exam|learn(ing)?)\b/i, concepts: ['student studying', 'university lecture hall', 'books and notes'] },
  { match: /\b(read(ing)?|book|library|novel)\b/i, concepts: ['reading a book', 'library shelves', 'pages turning'] },
  { match: /\b(type(d|s)?|typing|keyboard|laptop|computer|coding|programming)\b/i, concepts: ['typing on laptop', 'coding on screen', 'computer close-up'] },
  { match: /\b(phone|smartphone|scrolling|social media|texting|notification)\b/i, concepts: ['scrolling phone', 'smartphone notification', 'social media feed'] },
  { match: /\b(ai|artificial intelligence|robot|automation|technology)\b/i, concepts: ['futuristic technology', 'AI interface visual', 'robot arm'] },

  // War / conflict / society
  { match: /\b(war|battlefield|soldiers?|military)\b/i, concepts: ['war footage', 'soldiers marching', 'battlefield archive'] },
  { match: /\b(protest|riot|demonstration|strike)\b/i, concepts: ['protest crowd', 'demonstration march', 'riot police'] },
  { match: /\b(migration|refugees?|immigrants?|border)\b/i, concepts: ['migration', 'refugees walking', 'border crossing footage'] },
  { match: /\b(homeless|slum)\b/i, concepts: ['poverty documentary', 'slum street', 'homeless footage'] },

  // Nature / place / time
  { match: /\b(sunrise|sunset|mountain|climb(ing)?)\b/i, concepts: ['sunrise timelapse', 'mountain climbing', 'sunset over horizon'] },
  { match: /\b(city|skyline|street|crowded street|urban)\b/i, concepts: ['city skyline', 'crowded street walking'] },
  { match: /\b(rain|thunder|wind|storm|snow|weather)\b/i, concepts: ['rain falling', 'storm clouds', 'snow falling'] },
  { match: /\b(clock|time passing|years? later|decades?|centuries?)\b/i, concepts: ['clock timelapse', 'calendar pages turning'] },
  { match: /\b(travel(ing|led)?|airport|flight|journey|road trip)\b/i, concepts: ['airport terminal', 'airplane window view', 'road trip driving'] },
  { match: /\b(newspaper|headline|breaking news)\b/i, concepts: ['newspaper headline', 'breaking news archive'] },
]

const SEARCH_STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'for', 'from',
  'had', 'has', 'have', 'he', 'her', 'his', 'how', 'i', 'in', 'into', 'is', 'it',
  'its', 'of', 'on', 'or', 'our', 'she', 'that', 'the', 'their', 'them', 'they',
  'this', 'to', 'was', 'we', 'were', 'what', 'when', 'why', 'will', 'with', 'you', 'your',
])

function extractKeywords(line, limit = 5) {
  const words = String(line || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean)
  const meaningful = words.filter((word) => word.length > 2 && !SEARCH_STOP_WORDS.has(word))
  return (meaningful.length ? meaningful : words).slice(0, limit)
}

export function suggestVisualForLine(line) {
  const text = String(line || '')
  const matched = VISUAL_CONCEPT_MAP.filter((entry) => entry.match.test(text)).flatMap((entry) => entry.concepts)
  return matched.length ? [...new Set(matched)].slice(0, 4) : extractKeywords(text, 5)
}

export function estimateLineDuration(line) {
  const wordCount = String(line || '').trim().split(/\s+/).filter(Boolean).length
  if (!wordCount) return 1.5
  const seconds = (wordCount / WORDS_PER_MINUTE) * 60
  // Clamp to a sane on-screen range: even a one-word line needs ~1s, and we
  // round to one decimal so the UI doesn't show ugly floating point noise.
  return Math.max(1, Math.round(seconds * 10) / 10)
}

export function formatSecondsLabel(totalSeconds) {
  const seconds = Math.max(0, Number(totalSeconds) || 0)
  if (seconds < 60) return `${seconds.toFixed(1)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function buildSceneBreakdown(scriptText) {
  const lines = splitScriptText(scriptText)
  let runningStart = 0
  return lines.map((text, index) => {
    const duration = estimateLineDuration(text)
    const scene = {
      id: `scene-${index + 1}`,
      index: index + 1,
      narration: text,
      visual: suggestVisualForLine(text),
      broll: extractKeywords(text, 4),
      sfx: suggestSfxForLine(text),
      durationSeconds: duration,
      startSeconds: Math.round(runningStart * 10) / 10,
    }
    runningStart += duration
    return scene
  })
}

export function totalScriptDuration(scenes) {
  return scenes.reduce((sum, scene) => sum + (scene.durationSeconds || 0), 0)
}
