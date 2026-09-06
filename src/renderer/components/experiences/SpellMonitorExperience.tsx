// Spell Monitor (Experience #3, DESIGN §34.9) — everything currently on you as
// a grid of live countdowns. `memo`'d (pitfall #82c) so it renders on ITS
// inputs, not every game batch.
//
// A PURE VIEW over typed state. The parsing lives in experiences.ts
// (`parseSpellLine` / `deriveSpellState`) and runs in GameWindow, which owns
// the per-effect max ceiling; nothing here touches game text. The ⚙ content
// layers are gated at the top (`optionShown`), one option per visual layer.
//
// What the body does, in order:
//   • the CLOCK: a self-retiring 1s tick that exists only while a timed effect
//     is live (B292 — an interval that never clears is a session-long cost),
//     and drops expired effects between DR's repaints so the grid self-corrects;
//   • ORDERING by `spellSortRank`: lapsing → counting down → no countdown →
//     permanent (UX #3 — the thing about to drop is the thing you act on);
//   • each CELL: an optional skill badge, the name (or its abbreviation), what
//     remains, and a bar whose denominator is a STATED percentage when the game
//     gave one, else the highest roisaen seen this session (DR never states a
//     full duration, so that ceiling has to be learned).
//
// HONESTY RULES, all deliberate:
//   • DR reports WHOLE roisaen, so we display whole minutes and never a
//     seconds countdown — `29:00` would claim a precision the game never gave
//     us. The final minute reads "<1m"; the BAR may move smoothly, because a
//     proportion is not a claim about precision.
//   • An effect we could not parse is still SHOWN, carrying whatever the game
//     put in its parentheses. Never hide something the game says is on you.
//   • The five `SpellKind`s are NOT interchangeable: `fading` is the most urgent
//     state DR can report and `permanent` the calmest, so the `untimed` layer
//     hides the quiet kinds but never `fading`, and only permanent/unknown are
//     muted. Each non-timed kind shows the game's own word rather than a faked
//     duration.
//   • A name absent from the badge table gets NO badge and its full name — an
//     unknown effect must never receive a wrong badge. Thief Khri are the known
//     gap (they appear in percWindow but not in Lich's base-spells.yaml).
//
// Layout: bounded by construction (`max-height` + scroll, pitfall #109 — the
// effect count is user data and a buff stack must not grow without limit), the
// root anchors the em chain to --panel-font-size/--game-font-size so A−/A+ and
// the Settings font both reach it (pitfall #58a), and numbers are tabular so a
// ticking value can never reflow its cell (pitfall #103).
import { Fragment, memo, useEffect, useState } from 'react'
import type { ExperienceProps, SpellEffect } from '../../experiences'
import { liveSpellEffects, spellBand, spellSortRank, groupSpells, spellRemainingLabel, spellNoteText, optionShown, experienceById } from '../../experiences'
import { lookupSpell } from '../../spellData'
import '../../styles/experiences.css'

const MIN_MS = 60_000

// Bar fill 0…1, or null for an effect that should have no bar at all. A STATED
// percentage wins over the learned ceiling — it is a true proportion, where
// `max` is only "the most we happen to have seen". With neither, a timed effect
// shows a full bar rather than an empty one, since empty would read as "about
// to expire" on something we simply know nothing about yet.
function barFraction(e: SpellEffect, now: number): number | null {
  if (e.kind === 'permanent' || e.kind === 'unknown') return null
  if (e.kind === 'fading') return 0
  if (e.percent !== null && e.kind === 'percent') return Math.max(0, Math.min(1, e.percent / 100))
  if (e.expiresAt === null) return null
  if (!e.max) return 1
  const left = (e.expiresAt - now) / MIN_MS
  return Math.max(0, Math.min(1, left / e.max))
}

function SpellCell({ effect, now, showBars, showUrgency, pulse, showBadges, useAbbrev }: {
  effect: SpellEffect; now: number; showBars: boolean; showUrgency: boolean; pulse: boolean
  showBadges: boolean; useAbbrev: boolean
}) {
  // Badge + abbreviation both come from Lich's base-spells.yaml, snapshotted at
  // build time (spellData.ts). A name we don't know simply has no entry, so it
  // renders with no badge and its full name — never a wrong badge. Thief Khri
  // are the known gap: they appear in percWindow but not in that file.
  const ref = lookupSpell(effect.name)
  const u = showUrgency ? spellBand(effect, now) : 'none'
  const label = spellRemainingLabel(effect, now)
  const bar = barFraction(effect, now)
  const cls = [
    'sm-cell',
    u !== 'none' ? 'sm-cell--' + u : '',
    u === 'crit' && pulse ? 'sm-cell--pulse' : '',
    // Muted = background information. A 'fading' effect has NO countdown either,
    // but it is the most urgent thing on screen, so it must never be quieted
    // along with the permanents.
    effect.kind === 'permanent' || effect.kind === 'unknown' ? 'sm-cell--untimed' : '',
  ].filter(Boolean).join(' ')
  // Abbreviations only where we actually have one — 12 spells in Lich's data
  // carry no `abbrev`, and a blank cell would be worse than a long name.
  const shownName = useAbbrev && ref?.a ? ref.a : effect.name
  // '' when the note would only repeat the label — see spellNoteText.
  const noteText = spellNoteText(effect, label)
  // The tooltip adds facts the cell does NOT already show (UX #8) — never a
  // restatement of the label. Under abbreviation it carries the full name,
  // which is the one thing the cell has stopped saying.
  const title = [
    shownName === effect.name ? effect.name : effect.name + ' (' + shownName + ')',
    ref ? ref.l + (ref.g ? ' · ' + ref.g : '') : null,
    effect.kind === 'timed'
      ? effect.roisaen + ' roisaen when last reported' + (effect.max ? ' · longest seen ' + effect.max : '')
      : effect.kind === 'fading'    ? 'fading — about to lapse'
      : effect.kind === 'permanent' ? 'no expiry'
      : effect.kind === 'percent'   ? effect.percent + '%'
      : effect.note ?? 'no countdown reported',
  ].filter(Boolean).join(' — ')
  return (
    <div className={cls} title={title}>
      <div className="sm-cell-top">
        {showBadges && ref && (
          <span className={'sm-badge sm-badge--' + ref.b.toLowerCase()} aria-hidden="true">{ref.b}</span>
        )}
        <span className="sm-name">{shownName}</span>
        {label && <span className="sm-time">{label}</span>}
      </div>
      {noteText && <div className="sm-note">{noteText}</div>}
      {showBars && bar !== null && (
        <div className="sm-bar" aria-hidden="true">
          {/* scaleX, not width — the bar drains continuously, and a width
              transition would invalidate layout every frame for every bar.
              See the .sm-bar-fill rule. */}
          <span className="sm-bar-fill" style={{ transform: 'scaleX(' + bar + ')' }} />
        </div>
      )}
    </div>
  )
}

export default memo(function SpellMonitorExperience({ spells, settings, hidden }: ExperienceProps) {
  const def = experienceById('spellmonitor')
  const opts = def?.options ?? []
  const shown = (id: string) => {
    const o = opts.find(x => x.id === id)
    return o ? optionShown(hidden, o) : true
  }
  const showBars    = shown('bars')
  const showUrgency = shown('urgency')
  const showUntimed = shown('untimed')
  const showBadges  = shown('badges')
  const useAbbrev   = shown('abbrev')
  // Motion is decoration, colour is signal (UX #9b): epilepsy-safe drops the
  // pulse but KEEPS the urgency colour, so the accessible path loses nothing.
  const pulse = shown('pulse') && !settings.epilepsySafe

  // A 1s clock that exists ONLY while something is counting down, and clears
  // itself once everything has expired (B292 — the expiry values never zero
  // themselves, so a bare "is anything set" guard would arm a permanent tick).
  const [now, setNow] = useState(() => Date.now())
  // The next expiry STILL IN THE FUTURE. Taking the minimum over ALL effects
  // instead was a real bug: the interval self-clears at the soonest expiry, and
  // if that effect stayed in `soonest` the dep never changed, so no new interval
  // was armed and EVERY OTHER countdown froze until DR next repainted (which,
  // on a repaint-on-change cadence, could be minutes). Filtering on
  // `expiresAt > now` makes each expiry advance the dep to the following one,
  // and the chain ends naturally at null when nothing timed is left.
  const soonest = spells?.effects.reduce<number | null>(
    (acc, e) => (e.expiresAt !== null && e.expiresAt > now && (acc === null || e.expiresAt < acc) ? e.expiresAt : acc), null) ?? null
  useEffect(() => {
    if (soonest === null) return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      if (t >= soonest) clearInterval(id)   // last tick still renders the 0 state
    }, 1000)
    return () => clearInterval(id)
  }, [soonest])

  const live = liveSpellEffects(spells, now)
  // The `untimed` layer hides readings that carry no countdown — but NEVER a
  // 'fading' one. DR saying an effect is lapsing right now is the most urgent
  // thing the window can show, and a toggle meant for background information
  // must not be able to swallow it.
  const visible = live.filter(e => showUntimed || e.kind === 'timed' || e.kind === 'fading')
  // Soonest-expiring first (UX #3 — the thing about to drop is the thing you act
  // on), with untimed effects last: they have no urgency to sort by and are the
  // least likely thing you're watching for. Turning the option off keeps DR's
  // own order, which some players read positionally and which — unlike ours —
  // never rearranges itself as timers cross.
  const ordered = shown('sortByTime')
    ? [...visible].sort((a, b) => {
        // Kind first (lapsing → counting down → no countdown → permanent), then
        // soonest expiry within the timed band, then name for a stable tie.
        const r = spellSortRank(a) - spellSortRank(b)
        if (r !== 0) return r
        if (a.expiresAt !== null && b.expiresAt !== null) return a.expiresAt - b.expiresAt
        return a.name.localeCompare(b.name)
      })
    : visible

  return (
    <div className="sm-scene">
      {shown('header') && (
        <div className="sm-head">
          <span className="sm-head-title">Active Spells</span>
          {ordered.length > 0 && <span className="sm-head-count">{ordered.length}</span>}
        </div>
      )}
      {ordered.length === 0 ? (
        // The empty state TEACHES (UX #8): a first-time user with nothing up
        // should still learn what this window is for and where the same
        // information lives in text.
        <div className="sm-empty">
          {/* "Nothing is up" and "everything up is filtered out" are different
              facts, and claiming the first while the second is true is simply
              false — turn off "Untimed effects" while only untimed ones are on
              you and the window would have insisted you had nothing. */}
          {live.length > 0 ? (
            <>
              <div className="sm-empty-line">Nothing to show with the current view.</div>
              <div className="sm-empty-hint">
                {live.length === 1 ? 'One effect is' : `${live.length} effects are`} active but
                hidden — turn on “Untimed effects” in ⚙ to see {live.length === 1 ? 'it' : 'them'}.
              </div>
            </>
          ) : (
            <>
              <div className="sm-empty-line">No active spells, abilities or effects.</div>
              <div className="sm-empty-hint">
                {spells
                  ? 'Any spell or ability used on you appears here with its countdown.'
                  : 'Waiting for the game — spells and abilities appear here as soon as one is on you.'}
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="sm-grid">
          {shown('groupBySkill')
            // Grouped: `ordered` is already in its final within-group order, and
            // groupSpells preserves it — so this composes with "Soonest first"
            // rather than overriding it. The heading spans every column
            // (grid-column: 1/-1) so the grid keeps flowing underneath it.
            ? groupSpells(ordered, lookupSpell).map(g => (
                <Fragment key={g.label}>
                  <div className="sm-group">
                    <span className="sm-group-name">{g.label}</span>
                    <span className="sm-group-count">{g.effects.length}</span>
                  </div>
                  {g.effects.map(e => (
                    <SpellCell key={e.name} effect={e} now={now}
                      showBars={showBars} showUrgency={showUrgency} pulse={pulse}
                      showBadges={showBadges} useAbbrev={useAbbrev} />
                  ))}
                </Fragment>
              ))
            : ordered.map(e => (
                <SpellCell key={e.name} effect={e} now={now}
                  showBars={showBars} showUrgency={showUrgency} pulse={pulse}
                  showBadges={showBadges} useAbbrev={useAbbrev} />
              ))}
        </div>
      )}
    </div>
  )
})
