import type { TextSegment } from '../../shared/types'
import type { Contact, ContactTemplate } from '../contacts'
import type { CompiledRule } from '../HighlightsContext'
import type { HighlightStyle } from '../highlights'
import { renderSegment } from './renderSegment'

export type MatchRange =
  | { start: number; end: number; kind: 'contact'; contact: Contact; template: ContactTemplate | null }
  | { start: number; end: number; kind: 'highlight'; compiled: CompiledRule }

// B172: the contact + match-rule scan over a full line, extracted so callers
// that render a MULTI-SEGMENT line (TextLineRow, RoomPanel sections) can run
// it ONCE per line and hand the ranges to each segment's renderSegmentFull
// call. Before this, renderSegmentFull re-ran every rule against the full
// lineText once PER SEGMENT (a B115 side effect — matching is line-wide but
// was invoked per segment), so a 4-segment line paid the whole ruleset 4×.
// Returns ranges in LINE coordinates.
export function computeLineMatchRanges(
  lineText: string,
  contacts: Contact[],
  templates: ContactTemplate[],
  nameRegex: RegExp | null,
  matchRules: CompiledRule[],
): MatchRange[] {
  const ranges: MatchRange[] = []
  if (!lineText) return ranges

  if (nameRegex) {
    nameRegex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = nameRegex.exec(lineText)) !== null) {
      if (m[0].length === 0) { nameRegex.lastIndex++; continue }
      const contact = contacts.find(c => c.name.toLowerCase() === m![0].toLowerCase()) ?? null
      if (contact) {
        const template = templates.find(t => t.id === contact.templateId) ?? null
        ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'contact', contact, template })
      }
    }
  }

  const lineTextLower = lineText.toLowerCase()
  for (const compiled of matchRules) {
    if (compiled.fastLower !== null && !lineTextLower.includes(compiled.fastLower)) continue
    compiled.regex.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = compiled.regex.exec(lineText)) !== null) {
      if (m[0].length === 0) { compiled.regex.lastIndex++; continue }
      ranges.push({ start: m.index, end: m.index + m[0].length, kind: 'highlight', compiled })
    }
  }

  return ranges
}

export function renderSegmentFull(
  seg: TextSegment,
  segKey: number,
  contacts: Contact[],
  templates: ContactTemplate[],
  nameRegex: RegExp | null,
  matchRules: CompiledRule[],
  onContactClick?: (id: string, x: number, y: number) => void,
  onSendCommand?: (cmd: string) => void,
  autoLinkUrls = true,
  webLinkSafety = true,
  // B115: when the line's full concatenated text and this segment's offset
  // into that text are provided, regex matching runs against the joined
  // line instead of just this segment. Matches are intersected with the
  // segment range and translated to segment-local offsets. This lets
  // match-scope highlights and contact regexes cross segment boundaries
  // (DR wraps player names in XML attributes that fragment a line into
  // 3+ segments, so `Your mind hears .*? thinking,` was failing to match
  // in the thoughts stream — every regex test ran against a tiny slice).
  // Backward compatible: callers that omit these args keep the original
  // per-segment behavior.
  lineText?: string,
  segOffset?: number,
  // B172: ranges precomputed ONCE for the whole line via
  // computeLineMatchRanges (line coordinates). When provided (with
  // lineText/segOffset), the per-segment scan is skipped entirely — each
  // segment just intersects the shared ranges with its own window.
  precomputedLineRanges?: MatchRange[],
  // A LINE-scope highlight's text color that overrides preset/fg color on the
  // non-match-highlighted parts of the line (see renderSegment). Match-scope
  // highlighted runs already carry their own overriding color (hl-match below),
  // so this only flows to the plain/preset runs.
  overrideColor?: string,
): React.ReactNode {
  const text = seg.text
  if (!text) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls, webLinkSafety, overrideColor)
  if (!nameRegex && matchRules.length === 0) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls, webLinkSafety, overrideColor)

  const lineMode = lineText !== undefined && segOffset !== undefined
  const matchSource = lineMode ? lineText! : text
  const offset = lineMode ? segOffset! : 0

  // Scan (or reuse) line-coordinate ranges, then keep only those that
  // intersect this segment's window [offset, offset + text.length],
  // translated to segment-local coords. End-exclusive on both sides.
  const lineRanges = (lineMode && precomputedLineRanges)
    ? precomputedLineRanges
    : computeLineMatchRanges(matchSource, contacts, templates, nameRegex, matchRules)

  const ranges: MatchRange[] = []
  for (const r of lineRanges) {
    const segStart = Math.max(0, r.start - offset)
    const segEnd = Math.min(text.length, r.end - offset)
    if (segEnd > segStart) ranges.push({ ...r, start: segStart, end: segEnd })
  }

  if (ranges.length === 0) return renderSegment(seg, segKey, onSendCommand, autoLinkUrls, webLinkSafety, overrideColor)

  // B116 (v0.8.5): priority-based overlay. The earlier algorithm sorted
  // ranges by start position with contacts winning ties, then dropped any
  // range overlapping a previously-selected one. That collapsed the
  // common case where a contact match starts at the SAME position as a
  // long highlight (e.g. contact "You" at the start of "Your mind hears
  // Balistrade thinking," highlight) — contact won the tie, and the
  // entire highlight was dropped, leaving the rest of the phrase plain
  // when it should still have been highlighted. The new algorithm
  // produces non-overlapping runs by collecting boundary positions and
  // picking the highest-priority range covering each gap: contacts beat
  // highlights, highlights beat plain text. Adjacent same-range pieces
  // are merged into single runs so the rendered DOM stays compact.
  const boundarySet = new Set<number>([0, text.length])
  for (const r of ranges) { boundarySet.add(r.start); boundarySet.add(r.end) }
  const boundaries = [...boundarySet].sort((a, b) => a - b)

  // Per gap, resolve the style. Contacts outrank highlights (B116). Among
  // highlights we follow ProfanityFE's model (v0.11.3): SPECIFICITY +
  // PER-PROPERTY COMPOSITING. Each visual property (text color / background /
  // bold / glow) is taken INDEPENDENTLY from the SMALLEST (most-specific)
  // covering highlight that SETS it — so a small word-highlight's color punches
  // through a broad phrase/line highlight while the phrase's background still
  // shows behind it, and a bold-only or bg-only highlight layers onto another's
  // fg. Chosen over Wrayth/Frostbite's bottom-of-list-wins because
  // specific-beats-general is a better default and doesn't force users to manage
  // list order at scale (see CLAUDE.md Automations — the cross-client research).
  // Within a property, equal-length ties go to the FIRST-encountered (top-of-
  // list) highlight — deterministic, vs Profanity's arbitrary unstable sort.
  type HlComposite = { kind: 'highlight'; textColor: string | null; bgColor: string | null; bold: boolean; glow: boolean; glowColor: string | null }
  type ContactRun  = { kind: 'contact'; contact: Contact; template: ContactTemplate | null }
  type RunStyle = ContactRun | HlComposite | null
  type Run = { start: number; end: number; style: RunStyle; key: string }

  const runs: Run[] = []
  const covering: Extract<MatchRange, { kind: 'highlight' }>[] = []
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i]
    const end = boundaries[i + 1]
    if (start === end) continue

    let contactHit: Extract<MatchRange, { kind: 'contact' }> | null = null
    covering.length = 0
    for (const r of ranges) {
      if (r.start <= start && r.end >= end) {
        if (r.kind === 'contact') { if (!contactHit) contactHit = r }
        else covering.push(r)
      }
    }

    let style: RunStyle
    let key: string
    if (contactHit) {
      style = { kind: 'contact', contact: contactHit.contact, template: contactHit.template }
      key = `c:${contactHit.contact.id}:${contactHit.template?.id ?? ''}`
    } else if (covering.length > 0) {
      // smallest match range first; pick() returns the most-specific covering
      // highlight whose style satisfies the test (first-encountered on ties).
      covering.sort((a, b) => (a.end - a.start) - (b.end - b.start))
      const pick = (test: (s: HighlightStyle) => boolean): HighlightStyle | null => {
        for (const c of covering) if (test(c.compiled.rule.style)) return c.compiled.rule.style
        return null
      }
      const gl = pick(s => s.glow)
      style = {
        kind: 'highlight',
        textColor: pick(s => !!s.textColor && s.textColor !== 'transparent')?.textColor ?? null,
        bgColor:   pick(s => !!s.bgColor && s.bgColor !== 'transparent')?.bgColor ?? null,
        bold:      !!pick(s => s.bold),
        glow:      !!gl,
        glowColor: gl?.glowColor ?? null,
      }
      key = `h:${style.textColor ?? ''}|${style.bgColor ?? ''}|${style.bold}|${style.glow}|${style.glowColor ?? ''}`
    } else {
      style = null
      key = 'n'
    }

    // Merge with the previous run when the resolved style is identical.
    const last = runs[runs.length - 1]
    if (last && last.key === key) last.end = end
    else runs.push({ start, end, style, key })
  }

  const parts: React.ReactNode[] = []
  let n = 0
  const k = () => segKey * 10000 + n++

  for (const run of runs) {
    const matchText = text.slice(run.start, run.end)
    const s = run.style

    if (s === null) {
      // No highlight/contact covers this run — render via renderSegment so it
      // picks up the segment's preset / fg / bg as plain text (with a line-scope
      // override color winning over them, if one is active).
      parts.push(renderSegment({ ...seg, text: matchText }, k(), onSendCommand, autoLinkUrls, webLinkSafety, overrideColor))
      continue
    }

    if (s.kind === 'contact') {
      const { contact, template } = s
      if (template?.tagText) {
        const tagStyle: React.CSSProperties = {
          color: template.tagColor,
          ...(template.tagBgColor && template.tagBgColor !== 'transparent'
            ? { backgroundColor: template.tagBgColor } : {}),
        }
        parts.push(<span key={k()} className="contact-tag" style={tagStyle}>{template.tagText}{' '}</span>)
      }
      const nameStyle: React.CSSProperties = {
        color: template?.textColor ?? 'var(--text-secondary)',
        ...(template?.bgColor && template.bgColor !== 'transparent'
          ? { backgroundColor: template.bgColor } : {}),
      }
      const nameContent = template?.bold
        ? <strong style={nameStyle}>{matchText}</strong>
        : <span style={nameStyle}>{matchText}</span>
      parts.push(
        <span
          key={k()}
          className={`contact-name${onContactClick ? ' contact-name--clickable' : ''}`}
          onClick={onContactClick
            ? (e) => { e.stopPropagation(); onContactClick(contact.id, e.clientX, e.clientY) }
            : undefined}
        >{nameContent}</span>
      )
    } else {
      const hlStyle: React.CSSProperties = {
        ...(s.textColor ? { color: s.textColor } : {}),
        ...(s.bgColor ? { backgroundColor: s.bgColor } : {}),
        ...(s.glow && s.glowColor ? { textShadow: `0 0 6px ${s.glowColor}, 0 0 14px ${s.glowColor}` } : {}),
      }
      parts.push(
        s.bold
          ? <strong key={k()} className="hl-match" style={hlStyle}>{matchText}</strong>
          : <span key={k()} className="hl-match" style={hlStyle}>{matchText}</span>
      )
    }
  }

  return <span key={segKey}>{parts}</span>
}

export function getLineHighlightStyle(
  segments: TextSegment[],
  lineRules: CompiledRule[],
): React.CSSProperties | null {
  if (lineRules.length === 0) return null
  const fullText = segments.map(s => s.text).join('')
  const fullTextLower = fullText.toLowerCase()
  for (const compiled of lineRules) {
    if (compiled.fastLower !== null && !fullTextLower.includes(compiled.fastLower)) continue
    compiled.regex.lastIndex = 0
    if (compiled.regex.test(fullText)) {
      const { style } = compiled.rule
      return {
        ...(style.bgColor && style.bgColor !== 'transparent' ? { backgroundColor: style.bgColor } : {}),
        ...(style.textColor && style.textColor !== 'transparent' ? { color: style.textColor } : {}),
        ...(style.glow ? { textShadow: `0 0 6px ${style.glowColor}, 0 0 14px ${style.glowColor}` } : {}),
      }
    }
  }
  return null
}
