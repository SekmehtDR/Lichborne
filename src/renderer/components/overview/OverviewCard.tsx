// One character's Overview card (v0.19.0, DESIGN §47).
//
// Rendered BY its own GameWindow through a portal into OverviewShell's grid, so
// it escapes the `display:none` session shell (becoming visible) while KEEPING
// its React context — which is what gives it `vitals`, `roomState`, `lines` and
// the per-session Highlights/Contacts providers with no new plumbing at all
// (the pitfall #57 problem, solved by the tree/DOM split rather than worked
// around).
//
// Read-only by design: the card answers "does this character need me?", and the
// answer to "yes" is to click it and land in Session view. Quick Send already
// covers sending a command to another character.

import { useMemo } from 'react'
import type { TextLine, RoomState, InjuryState, TextSegment } from '../../../shared/types'
import type { CompiledRule } from '../../HighlightsContext'
import type { Contact, ContactTemplate } from '../../contacts'
import type { AppSettings } from '../../settings'
import type { OverviewOptions } from '../../overviewStore'
import type { SessionStats } from '../../hooks/useSessionStats'
import { ATTENTION_DEFS, attentionOrder, needsAttention, type AttentionThresholds } from '../../attention'
import { summarizeInjuries, WOUND_LABEL, type InjurySummary } from '../../injuryParse'
// From the STORE, not a context: this card is PORTALED, so its React context
// comes from its GameWindow — a provider on OverviewShell would never reach it.
import { useOverviewNow, useFeedCapacity } from '../../overviewStore'
import { TextLineRow } from '../TextLineRow'
import VitalsBar from '../VitalsBar'

/**
 * Highlight / contact rules, threaded down from GameWindow so a card renders text
 * EXACTLY as the game window does — the same rule the prompt lines answer to.
 *
 * An earlier version passed empty arrays deliberately, to hit `TextLineRow`'s
 * `hasExtras` short-circuit and skip the ruleset pass entirely. That was a real
 * saving and the wrong trade: a dashboard whose text is missing the colours you
 * built to make things jump out is a dashboard you cannot scan (Sekmeht).
 *
 * It stays affordable because `TextLineRow` is memoized and these props are
 * REFERENTIALLY STABLE — `matchRules`/`lineRules` come from `useCompiledHighlights`,
 * and `renderContacts` is the identity-stable array (pitfall #105: the volatile
 * one churns on every room change as presence tracking writes to it). So the
 * ruleset runs ONCE per new line per card, not per frame. Passing the volatile
 * contacts array here would silently turn that into a full re-highlight of every
 * visible line on every room change, for every character.
 */
export interface CardRules {
  matchRules: CompiledRule[]
  lineRules: CompiledRule[]
  contacts: Contact[]
  templates: ContactTemplate[]
  nameRegex: RegExp | null
}


interface Props {
  characterId: string
  character: string
  game: string
  useLich: boolean
  connected: boolean
  isActive: boolean
  /** Tab position — breaks sort ties so equally-calm cards never reshuffle. */
  index: number
  settings: AppSettings
  options: OverviewOptions
  vitals: Record<string, { current: number; max: number }>
  vitalLabels: Record<string, string>
  indicators: Record<string, boolean>
  stance: string
  spell: string
  rightHand: string
  leftHand: string
  roomState: RoomState
  injuryState: InjuryState
  lines: TextLine[]
  /** The selected stream's OWN buffer (what its panel renders) — history included. */
  streamLines: TextLine[]
  /** Parallel capture, for a stream whose lines were redirected into main. */
  monitorLines: TextLine[]
  /** Highlight/contact rules — the SAME references the main window renders with. */
  rules: CardRules
  /** Whether the SELECTED stream has timestamps on, per that character's setting. */
  showTimestamp: boolean
  /** Which stream this card's feed is showing. `main` = the game window. */
  streamId: string
  /** Streams offered in the dropdown, in display order. */
  streamChoices: { id: string; label: string }[]
  onStreamChange: (id: string) => void
  stats: SessionStats
  onOpen: () => void
  /** Opens the per-character action menu at a point. Absent → no menu. */
  onMenu?: (x: number, y: number) => void
}

function OverviewCardImpl(p: Props) {
  const now = useOverviewNow()
  const { options: o, stats } = p

  const injuries = useMemo(() => summarizeInjuries(p.injuryState), [p.injuryState])
  // Prompt lines are KEPT. An earlier version filtered them as dead space, which
  // was defensible when the feed was six lines — but the feed now fills the tile,
  // and without the `>` the combat text runs together as a wall (Sekmeht's
  // side-by-side). Those prompts are the beat between rounds, and the parser has
  // already collapsed redundant consecutive ones (pitfall #88), so what reaches
  // `lines` is the right density already.
  //
  // The governing rule: the card should read like the game window. Any deviation
  // from how the main scroll renders the same text is a surprise, not a feature.
  //
  // Slice to what FITS, not to the user's setting. `feedLines` is a floor
  // ("guarantee me at least this many"), and now that the feed absorbs leftover
  // height, slicing to it left a full-screen tile showing six lines pinned to
  // the bottom of a very tall box with a void above them.
  const capacity = useFeedCapacity()
  // The feed shows whichever stream the card's dropdown selects.
  const feed = useMemo(() => {
    if (o.feedLines <= 0) return []
    if (p.streamId === 'main') return p.lines.slice(-capacity)
    // MERGE the stream's own buffer with the parallel capture, because neither
    // is sufficient alone:
    //   • `streamLines` holds everything that ROUTED to the stream — including
    //     history from before you picked it, which is what stops a card reading
    //     "Nothing on log yet" while that character's Log panel is full.
    //   • the capture holds lines that were redirected INTO main instead
    //     (an unwatched stream with a STREAM_FALLBACK entry never reaches
    //     `streamLines`).
    // Both push the SAME line object, so a line present in both dedupes by id,
    // and ids are monotonic — so sorting by id restores chronological order
    // across the two sources without comparing timestamps.
    if (p.monitorLines.length === 0) return p.streamLines.slice(-capacity)
    if (p.streamLines.length === 0) return p.monitorLines.slice(-capacity)
    // Slice BEFORE merging. Both sources are chronological, so the last N of the
    // merge can only come from the last N of each — and `streamLines` runs to
    // MAX_STREAM_LINES, so merging them whole would build and sort ~560 entries
    // to keep 60, on every batch that touches this stream.
    const byId = new Map<number, TextLine>()
    for (const l of p.streamLines.slice(-capacity)) byId.set(l.id, l)
    for (const l of p.monitorLines.slice(-capacity)) byId.set(l.id, l)
    return [...byId.values()].sort((a, b) => a.id - b.id).slice(-capacity)
  }, [p.streamId, p.lines, p.streamLines, p.monitorLines, o.feedLines, capacity])

  const health = p.vitals.health
  const healthPct = health && health.max > 0 ? Math.round((health.current / health.max) * 100) : null

  // `idle` is re-derived here off the shared 1 Hz clock rather than inside the
  // stats hook, so it advances without a game event having to arrive.
  const idleMs = stats.lastInboundAt > 0 ? now - stats.lastInboundAt : 0
  const idle = p.connected && idleMs > o.idleSeconds * 1000

  const order = o.sort === 'tab'
    ? p.index
    : attentionOrder(stats.score, p.index)

  // `needsAttention`, not `score > 0` — the same floor the badge and the summary
  // strip use. Without it a mind-locked character (score 20, the NORMAL state of
  // anything grinding a skill) wore a permanent amber border, which trains the
  // eye to stop reading borders at all.
  const tone = !p.connected ? 'offline'
    : stats.score >= 70 ? 'urgent'
    : needsAttention(stats.score) ? 'alert'
    : 'calm'

  // Binu: a card should announce itself when a character is genuinely in
  // trouble, rather than waiting to be looked at. Deliberately narrow — dead, or
  // health under the CRITICAL threshold (not the merely-hurt one). A pulse that
  // fires often is a pulse you stop seeing. Motion is dropped entirely under
  // epilepsy-safe / reduced-motion; the colour, which is the actual signal,
  // stays (polish standard #9b).
  const pulsing = p.connected && o.alertPulse
    && (!!p.indicators.dead || (healthPct !== null && healthPct < o.healthCritPct))

  return (
    <div
      className={[
        'ov-card',
        `ov-card--${tone}`,
        pulsing ? 'ov-card--pulse' : '',
        p.isActive ? 'ov-card--active' : '',
        o.density === 'compact' ? 'ov-card--compact' : '',
      ].filter(Boolean).join(' ')}
      style={{
        order,
        // C1: `--game-font-size` is a DOCUMENT-ROOT var written only by the
        // ACTIVE character (applySettingsToDOM is gated on isActive), while the
        // font size is a PER-CHARACTER setting. Without this re-map every card
        // would render at the active character's size. Same mechanism PanelFrame
        // uses for its per-panel A−/A+ override.
        ['--game-font-size' as string]: `${p.settings.largePrint ? 18 : p.settings.fontSize}px`,
        // Drives the feed's FIXED height in CSS. Without it the feed is
        // content-sized, so every batch of game text resized the card and the
        // whole grid re-flowed — the "quiver" Sekmeht saw at certain chunk
        // sizes. A card must be a stable rectangle whatever arrives in it.
        ['--ov-feed-lines' as string]: String(o.feedLines),
      } as React.CSSProperties}
      role="button"
      tabIndex={0}
      title={`Open ${p.character} in Session view`}
      onClick={p.onOpen}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); p.onOpen() } }}
      /* Right-click anywhere on the card, exactly like the character tab. */
      onContextMenu={e => { if (p.onMenu) { e.preventDefault(); p.onMenu(e.clientX, e.clientY) } }}
    >
      <CardHead
        character={p.character} game={p.game} useLich={p.useLich}
        connected={p.connected} healthPct={healthPct} isActive={p.isActive}
        thresholds={o} onMenu={p.onMenu}
      />

      {/* The wound chip lives IN the flag row rather than owning a band of its
          own: it is an attention signal like the rest, it removes one of the
          card's eight stacked bands, and because this row is height-reserved a
          wound appearing no longer nudges everything below it. */}
      <FlagRow
        flags={stats.flags} idle={idle} connected={p.connected}
        wound={o.showInjuries && injuries.woundCount > 0 ? injuries : null}
      />

      {o.showVitals && (
        <div className="ov-card-vitals">
          {/* ALWAYS compact, regardless of the density option. Five full labels
              ("Concentration", a Barbarian's "Inner Fire") cannot fit across a
              ~300px card at any density — they overran their bars and collided
              with each other in Sekmeht's first screenshot. Density controls the
              CARD's spacing; it cannot argue with the width of the word. */}
          <VitalsBar vitals={p.vitals} labels={p.vitalLabels} compact />
        </div>
      )}

      {o.showConditions && (
        <ConditionLine
          stance={p.stance} indicators={p.indicators}
          rightHand={p.rightHand} leftHand={p.leftHand} spell={p.spell}
        />
      )}

      {o.showRoom && <RoomLine roomState={p.roomState} />}

      {o.showExp && <StatRow stats={stats} now={now} idleMs={idleMs} connected={p.connected} />}

      {/* Stream selector — labels the feed AND changes it. Every interactive
          control inside the card must stop propagation, or using it also fires
          the card's click-to-open and drops you into Session view (the card
          root is a button). `onClick` alone is not enough: a native select
          also emits mousedown/keydown that would bubble the same way. */}
      {o.feedLines > 0 && p.streamChoices.length > 1 && (
        <div
          className="ov-card-streampick"
          onClick={e => e.stopPropagation()}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >
          <select
            className="ov-card-streamsel"
            /* Drives the "not on the game window" styling — a non-default
               selection stays legible without hover, so you can tell at a glance
               which cards are showing something other than the game window. */
            data-main={p.streamId === 'main' ? 'true' : 'false'}
            value={p.streamId}
            onChange={e => p.onStreamChange(e.target.value)}
            title="Which stream this card shows"
            aria-label={`Stream shown for ${p.character}`}
          >
            {p.streamChoices.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
      )}

      {o.feedLines > 0 && (
        <div className="ov-card-feed" aria-label={`${p.streamId} for ${p.character}`}>
          {feed.length === 0
            /* Names the stream: on a non-main selection "No text yet" alone
               reads like something is broken, when it usually means nobody has
               said anything (UX standard #8b — explain the empty state). */
            ? <div className="ov-card-dim ov-card-feed-empty">
                {p.streamId === 'main' ? 'No text yet.' : `Nothing on ${p.streamId} yet.`}
              </div>
            : feed.map(line => (
              <TextLineRow
                key={line.id}
                line={line}
                // No highlight/contact pass: TextLineRow short-circuits when
                // nameRegex is null and matchRules is empty, so a card costs a
                // plain render rather than a second run of the whole ruleset.
                // The game's own colours (presets, monsterbold) still show.
                matchRules={p.rules.matchRules}
                lineRules={p.rules.lineRules}
                contacts={p.rules.contacts}
                templates={p.rules.templates}
                nameRegex={p.rules.nameRegex}
                autoLinkUrls={false}
                showTimestamp={p.showTimestamp}
              />
            ))}
        </div>
      )}

    </div>
  )
}

// ── Sub-components, ALL at module scope ──────────────────────────────────────
// UX polish standard #4: a component declared inside a render is a brand-new
// type every render, so React remounts it and any state it owns is lost. This
// card re-renders on every game line, which is exactly the condition that turns
// that mistake into a visible bug.

function CardHead({ character, game, useLich, connected, healthPct, isActive, thresholds, onMenu }: {
  character: string; game: string; useLich: boolean
  connected: boolean; healthPct: number | null; isActive: boolean
  thresholds: AttentionThresholds
  onMenu?: (x: number, y: number) => void
}) {
  return (
    <div className="ov-card-head">
      <span className="ov-card-name">{character}</span>
      <span className={`ov-card-mode ov-card-mode--${useLich ? 'lich' : 'direct'}`}
            title={useLich ? 'Connected through Lich' : 'Connected directly to the game'}>
        {useLich ? 'L' : 'D'}
      </span>
      <span className="ov-card-game" title="Game shard">{game}</span>
      <span className="ov-card-head-spacer" />
      {isActive && <span className="ov-card-current" title="The character Session view is showing">current</span>}
      {connected && healthPct !== null && (
        <span className={`ov-card-hp ${healthClass(healthPct, thresholds)}`} title="Health">{healthPct}%</span>
      )}
      <span className={`ov-card-dot${connected ? '' : ' ov-card-dot--off'}`}
            title={connected ? 'Connected' : 'Disconnected'} />
      {/* Right-click on the card does the same thing, matching the tab — but a
          right-click-only action is one most people never find (the same lesson
          the stream selector taught). The button makes it discoverable; both
          open the identical menu. */}
      {onMenu && (
        <button
          className="ov-card-menu"
          title={`Actions for ${character}`}
          aria-label={`Actions for ${character}`}
          onClick={e => { e.stopPropagation(); onMenu(e.clientX, e.clientY) }}
          onMouseDown={e => e.stopPropagation()}
          onKeyDown={e => e.stopPropagation()}
        >⋯</button>
      )}
    </div>
  )
}

/**
 * The header percentage and the Critical/Hurt CHIPS must agree — they are the
 * same fact stated twice, and they were computed two different ways.
 *
 * These buckets were hardcoded 80/50/30 while the flags use the CONFIGURABLE
 * `healthCritPct` (25) / `healthLowPct` (50), so even at defaults a character at
 * 27% showed a red number beside a chip that only said "Hurt" — the number
 * screaming while the chip shrugged — and raising `healthCritPct` diverged them
 * further. Driving both from the same thresholds makes red mean exactly
 * "Critical" and orange exactly "Hurt", whatever the user has configured.
 *
 * `warn` keeps a soft band above the low threshold with no flag behind it: a
 * gradient toward trouble, deliberately quieter than anything that chips.
 */
function healthClass(pct: number, t: AttentionThresholds): string {
  if (pct < t.healthCritPct) return 'ov-hp--crit'
  if (pct < t.healthLowPct)  return 'ov-hp--bad'
  if (pct < 80)              return 'ov-hp--warn'
  return 'ov-hp--ok'
}

function FlagRow({ flags, idle, connected, wound }: {
  flags: readonly string[]; idle: boolean; connected: boolean
  wound: InjurySummary | null
}) {
  // `idle` is clock-derived, so it is merged in here rather than coming from the
  // stats hook's snapshot (which only re-runs on a game event).
  const all = idle && connected && !flags.includes('idle') ? [...flags, 'idle'] : [...flags]
  const woundChip = wound && (
    <span
      key="wound"
      className={`ov-flag ov-flag--wound-${wound.worstWound}`}
      title={
        `${WOUND_LABEL[wound.worstWound] ?? 'Wounded'}${wound.worstParts.length ? ` — ${wound.worstParts.join(', ')}` : ''}`
        + (wound.scarCount > 0 ? ` · ${wound.scarCount} scar${wound.scarCount === 1 ? '' : 's'} (healed, not counted)` : '')
      }
    >
      {WOUND_LABEL[wound.worstWound] ?? 'Wounded'} ×{wound.woundCount}
    </span>
  )

  // A clean card must read clean AT A GLANCE (UX #1) — one affirmative marker,
  // never a row of zeroes.
  if (all.length === 0 && !woundChip) {
    return <div className="ov-card-flags"><span className="ov-flag ov-flag--calm" title="Nothing needs your attention">✓ calm</span></div>
  }
  return (
    <div className="ov-card-flags">
      {all.map(f => {
        const def = ATTENTION_DEFS[f as keyof typeof ATTENTION_DEFS]
        if (!def) return null
        return <span key={f} className={`ov-flag ov-flag--${def.cls}`} title={def.desc}>{def.label}</span>
      })}
      {woundChip}
    </div>
  )
}

/**
 * Only what is NOT normal (Binu). `IconBar` renders every slot unconditionally —
 * hands read "Empty", spell reads "None", stance always shows "Standing" — which
 * is exactly right for a game-area strip, where a fixed position you can glance
 * at without reading is the whole point. In a tile it spends a full band saying
 * nothing happened (UX polish standard #1).
 *
 * It also DUPLICATED the flag row: bleeding / stunned / dead / poisoned /
 * diseased / webbed are attention flags already, so they are deliberately absent
 * here. What's left is the quiet context the flags don't carry — a posture that
 * isn't upright, a state you chose (hidden, invisible, joined), what you're
 * holding, and what you have prepared.
 *
 * Height-reserved, so a card doesn't resize the moment you draw a weapon.
 */
function ConditionLine({ stance, indicators, rightHand, leftHand, spell }: {
  stance: string; indicators: Record<string, boolean>
  rightHand: string; leftHand: string; spell: string
}) {
  const bits: React.ReactNode[] = []

  // Standing is the default posture and says nothing; anything else is a
  // liability worth seeing (Binu listed kneeling and prone by name).
  const st = (stance || '').trim()
  if (st && st.toLowerCase() !== 'standing') {
    bits.push(<span key="stance" className="ov-cond ov-cond--warn" title="Posture">{st}</span>)
  }
  // Only the indicators that are NOT already attention chips.
  //
  // The tooltip has to SAY something the chip does not (UX standard #8): these
  // used to pass `title={label}`, so hovering "Joined" explained "Joined". The
  // Joined wording is the one that carries real information, and it is taken
  // from IconBar's tester-corrected note (Cherisse/Agan): DR's IconJOINED marks
  // the FOLLOWER, so a group LEADER correctly shows nothing.
  const INDICATORS = [
    ['hidden',    'Hidden',    'Hiding — not visible to others in the room'],
    ['invisible', 'Invisible', 'Invisible to others in the room'],
    ['joined',    'Joined',    'Joined to another character and following them. A group LEADER does not show this.'],
  ] as const
  for (const [key, label, desc] of INDICATORS) {
    if (indicators[key]) bits.push(<span key={key} className="ov-cond" title={desc}>{label}</span>)
  }

  const held = [leftHand, rightHand].filter(h => h && h !== 'Empty')
  if (held.length > 0) {
    bits.push(<span key="hands" className="ov-cond ov-cond--held" title={`Holding: ${held.join(' · ')}`}>{held.join(' · ')}</span>)
  }
  if (spell && spell !== 'None') {
    bits.push(<span key="spell" className="ov-cond ov-cond--spell" title="Prepared spell">{spell}</span>)
  }

  return <div className="ov-card-cond">{bits}</div>
}

function segText(segs: TextSegment[] | undefined): string {
  return (segs ?? []).map(s => s.text).join('').trim()
}

function RoomLine({ roomState }: { roomState: RoomState }) {
  // Occupancy comes from `roomState`, NOT `sceneCast`: the scene capturers are
  // gated off unless an Experience is open (§35.6), so sceneCast is empty for
  // most users, whereas the `<component id='room players'>` path is ungated.
  const players = segText(roomState.players)
  const creatures = segText(roomState.creatures)
  const title = roomState.title || '—'
  // ONE occupancy line, always rendered and height-reserved: creatures and
  // players each came with their own conditional row before, so the card
  // resized whenever something walked in or out. Creatures lead because they
  // are the half you need to notice.
  return (
    <div className="ov-card-room">
      <div className="ov-card-roomname" title={title}>{title}</div>
      <div className="ov-card-here" title={[creatures, players].filter(Boolean).join(' ')}>
        {creatures && <span className="ov-card-here--hostile">{creatures}</span>}
        {creatures && players ? ' ' : null}
        {players && <span>{players}</span>}
      </div>
    </div>
  )
}

function StatRow({ stats, now, idleMs, connected }: {
  stats: SessionStats; now: number; idleMs: number; connected: boolean
}) {
  const uptime = stats.startedAt > 0 ? now - stats.startedAt : 0
  return (
    <div className="ov-card-stats">
      <Stat label="up" value={shortDuration(uptime)} title="How long this connection has been up" />
      <Stat label="idle" value={connected ? shortDuration(idleMs) : '—'} title="Time since the last game text arrived" />
      {/* Evaluated NOW, not read off the render-time value: a quiet character
          stops re-rendering its GameWindow, so the stored rate would freeze
          instead of decaying. This card re-renders every second. */}
      {/* "lines", not "lpm" — every other label here is a word, and an
          initialism nobody can expand is not a glance-readable label (UX #8). */}
      <Stat label="lines" value={String(stats.linesPerMinNow())} title="Lines of game text in the last minute" />
      {/* Quiet by default (UX #1): a counter at zero says nothing, so it is not
          rendered at all. The chips that ARE here all mean something. */}
      {stats.ranks > 0 && <Stat label="ranks" value={String(stats.ranks)} title="Ranks gained this session" />}
      {stats.roomsVisited > 1 && <Stat label="rooms" value={String(stats.roomsVisited)} title="Distinct rooms visited this session" />}
      {stats.deaths > 0 && <Stat label="deaths" value={String(stats.deaths)} title="Deaths this session" />}
      {stats.lockedSkills > 0 && (
        <Stat label="locked" value={String(stats.lockedSkills)}
              title="Skills at mind lock — they can absorb no more field experience" />
      )}
    </div>
  )
}

function Stat({ label, value, title }: { label: string; value: string; title: string }) {
  return (
    <span className="ov-stat" title={title}>
      <span className="ov-stat-label">{label}</span>
      <span className="ov-stat-value">{value}</span>
    </span>
  )
}

/** Sub-minute resolution matters for idle, which `formatDuration` collapses to '—'. */
function shortDuration(ms: number): string {
  if (!ms || ms < 1000) return '0s'
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const rm = m % 60
  return rm > 0 ? `${h}h ${rm}m` : `${h}h`
}

// Deliberately NOT memo'd. `stats` comes back as a fresh object from
// `useSessionStats` on every GameWindow render, so a shallow compare could never
// bail — the wrapper would be a props comparison that always fails, dressed up
// as protection. Memoizing `stats` is not the answer either: its fields
// (linesPerMin, lastInboundAt, flags) genuinely change during play, so a stable
// identity would mean a card rendering stale numbers.
//
// This is fine because the card is rendered from inside GameWindow's own render
// pass: it re-renders exactly when that character re-renders, never on another
// character's traffic. The expensive work is memoized where it actually is
// expensive — `summarizeExp`, `summarizeInjuries` and the feed slice.
export default OverviewCardImpl
