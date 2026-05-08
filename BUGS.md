# Lichborne — Bug & Feature Request Tracker

> Reported by testers during early access. Updated as issues are resolved.

---

## Open Bugs

| # | Summary | Reporter | Notes |
|---|---|---|---|

---

## Open Feature Requests

| # | Summary | Reporter | Notes |
|---|---|---|---|
| F03 | Inventory XML spam filter | Binu | Toggle to suppress inventory window events that flood the XML/debug stream on item pickup/drop — on hold |
| F05 | Mac / Linux builds | Binu | Codebase already compiles cross-platform; Mac requires Apple Developer Program ($99/yr); Binu offered to split cost — on hold |

---

## Resolved

| # | Summary | Resolved In | Notes |
|---|---|---|---|
| B03 | Page Up/Down doesn't scroll main story window | Legiro | Fixed: PageUp/PageDown/Home/End keyboard handlers added to GameWindow; scrollbar arrows added via CSS `::-webkit-scrollbar-button` SVG data URIs |
| B01 | `<a href>` links render as plain text | Legiro, Binu | Fixed: `<a href>` tags parsed in StormFrontParser; `href` property on TextSegment; links render as `.url-link` spans opening in OS browser via `shell.openExternal`; `<LaunchURL src>` also handled; bare http/https URLs in plain text auto-detected with settings toggle (on by default) |
| B04 | Stat column alignment breaks when stats are buffed | Binu | Fixed: `<output class="mono"/>` tag now sets `monoMode` in the parser; lines emitted in mono mode carry `mono: true` on `TextLine`; renderer applies `white-space: pre` to preserve fixed-width column spacing; follow-up: `<preset>` captures inside mono blocks no longer trim leading spaces, preserving column positions for highlighted stats |
| B06 | ExpBrief mode breaks exp window | Binu | Fixed: ExpBrief drops mindstate names from component updates, sending only `[x/34]` bracket notation; `parseExp` now falls back to parsing that bracket index when no mindstate string is found |
| B02 | No disconnect reason shown | Legiro | Fixed: on any disconnect (drop, death, QUIT, timeout) the game screen stays open; toolbar button changes to "Login" styled in accent color; Debug panel auto-opens so the Raw XML tab is visible; clicking "Login" returns to the login screen |
| B07 | Inventory list appears in main story window at login | — | Fixed: `<inv id='stow'>item</inv>` container tags were in SILENT_TAGS (suppressing only the tag, not the text between them); now uses a capture context to absorb and discard the content; also silenced `exposecontainer`, `clearcontainer`, `playerid`, and `mode` tags that were generating debug noise |
| B05 | Mana bar should be hidden for NMUs | Binu | Fixed: vitals state initializes empty; bars are only added when the server sends a `vital-update` for them; Thieves receive no mana bar XML so none is shown; Barbarians receive `id='mana'` with `text='inner fire'` so their bar appears with the correct label; when Thief Magic is eventually added by Simutronics the bar will appear automatically |
| F02 | Script-watch status panel | Binu | Resolved: Binu located the correct Lich script (script-watch) that already provides this functionality |
| F04 | Flag toggle buttons | Binu | Resolved: `<d cmd="flag X on/off">` links render as clickable and send the command to the game — no additional work needed |
| F01 | Save login credentials | Legiro | Resolved: account name persists via `localStorage` (`lichborne.account` key); password intentionally blank on every launch |
| B08 | Horizontal scrollbar appears in main text window; text doesn't word-wrap | — | Fixed: `overflow-y: auto` on `.text-window` implicitly set `overflow-x: auto`; added `overflow-x: hidden` to force word-wrap at window boundary |
