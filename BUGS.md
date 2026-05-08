# Lichborne — Bug & Feature Request Tracker

> Reported by testers during early access. Updated as issues are resolved.

---

## Open Bugs

| # | Summary | Reporter | Notes |
|---|---|---|---|
| B01 | `<a href>` links render as plain text | Legiro, Binu | Website links at login (Simucoin Store, Elanthipedia, etc.) not parsed; need `<a href='...'>text</a>` support in StormFrontParser |
| B02 | No disconnect reason shown | Legiro | On death, timeout, or server drop, client just returns to login screen with no explanation of why |
| B03 | Page Up/Down doesn't scroll main story window | Legiro | Keyboard scroll keys have no effect in the main text panel |
| B04 | Stat column alignment breaks when stats are buffed | Binu | Buffed stats add "+20" to the left column value, shifting right column text out of alignment (e.g. "Strength : 100 +20Reflex : 100 +20" runs together); likely a fixed-width formatting assumption in the parser |
| B05 | Mana bar should be hidden for NMUs | Binu | Non-Mana Users (e.g. Barbarians, Thieves) don't have mana; mana bar should not appear in the vitals bar for these characters |
| B06 | ExpBrief mode breaks exp window | Binu | When `EXPBRIEF` is enabled in-game the exp panel stops working; ExpBrief changes the XML format of experience components and the parser doesn't handle it |

---

## Open Feature Requests

| # | Summary | Reporter | Notes |
|---|---|---|---|
| F01 | Save login credentials | Legiro | Account name and character name fields don't persist between sessions; password intentionally excluded |
| F02 | Script-watch status panel | Binu | Show running Lich scripts with arguments; LichScripts stream exists but a dedicated panel with script names/status would be cleaner; Binu notes scripts using quiet mode won't appear in text stream |
| F03 | Inventory XML spam filter | Binu | Toggle to suppress inventory window events that flood the XML/debug stream on item pickup/drop |
| F04 | Flag toggle buttons | Binu | In-game flags (LogOn, LogOff, RoomBrief, etc.) sent as `<d cmd="flag X on/off">` — may already work since `<d cmd>` is implemented; needs verification |
| F05 | Mac / Linux builds | Binu | Codebase already compiles cross-platform; Mac requires Apple Developer Program ($99/yr); Binu offered to split cost |

---

## Resolved

| # | Summary | Resolved In | Notes |
|---|---|---|---|
| — | — | — | — |
