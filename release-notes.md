## What's new in v0.8.10

A focused release fixing two related speech-panel issues — a duplicate "Conversation" entry in Available Streams that several testers noticed, and a speech double-echo that surfaced during the fix's testing. Plus a new feature for macro authors / importers: support for the "type and wait" macro convention from Genie / Wrayth / Stormfront.

> **Upgrading notes**:
> - Existing users will see their "Conversations" tab automatically renamed to "Conversation" on first launch. Same position in your layout, same content routing. No manual action required.
> - If you have manually-created macros that contain a literal `@` character (e.g. for DR's `SAY @person message` syntax), the `@` is now treated as a cursor-position marker. To keep a literal `@` in a macro command, change it to `\@`. Wrayth and Genie imports already use `@` as a cursor marker so they don't need any change.

### Fixed: duplicate "Conversation" / "Conversations" in Available Streams

Lichborne used the plural `conversations` as its panel id, but every other Stormfront-family client (Genie, Frostbite, Wrayth) uses singular `conversation`. Lich's startup declares a `conversation` stream for protocol compatibility, which Lichborne was treating as a SEPARATE stream — so anyone running Lich saw both "Conversations" (Lichborne's panel) AND a ghost "Conversation" entry in Available Streams. The empty ghost panel never received any content (Lich declares the window but doesn't push to it directly; actual speech comes via `talk`).

Fix: renamed Lichborne's panel id from `conversations` to `conversation` to match the convention. The ghost row goes away because Lichborne and Lich now agree on what to call the panel. A one-time localStorage migration runs on first launch of v0.8.10 to rename your existing "Conversations" tab — keeps it in place in your layout, just updates the label. Triggers watching the conversations stream get their watch target renamed too so they keep firing.

Also: `whispers` now route to the same Conversation panel (matches Genie + Frostbite — both treat conversation as the combined speech-and-whispers feed).

### Fixed: speech double-echoed in the main scroll when no Conversation panel was open

DR's protocol sends speech twice per `say` — once inside the talk stream (which routes to the Conversation panel), and once "outside" the stream block to the main scroll (so you always see what you just said in main). Lichborne also had a stream-fallback that routed talk content to main when no Conversation panel was watching — on top of DR's already-duplicate-to-main, that produced two copies in the main scroll whenever the Conversation panel was closed.

Fixed by removing the redundant fallback. Speech now appears once in main (DR's native copy) and, if you have the Conversation panel open, once there too. No double-echo regardless of which panels you have open.

### New: macros can "type and wait" instead of always auto-sending

Reported by Jaded, who had a Wrayth speech macro (`<k key="Alt-Z" action="&apos;}"/>`) that wasn't working. The macro is supposed to type `'}` into the command bar and wait for her to add ` sekmeht hey!` and press Enter herself, then send the whole `'} sekmeht hey!` to DR (which parses it as "say to sekmeht: hey!"). Lichborne was auto-sending the macro immediately, so DR only saw `'}` with no target and rejected it.

Fixed by adding support for the universal `@` cursor-position marker that Genie, Wrayth, and Stormfront all use:

- **Include `@` in a macro command** → Lichborne types the text into the command bar, places the cursor where the `@` was, and waits for you to finish typing
- **Use `\@` for a literal `@`** (escape) — useful if you ever genuinely want to send the `@` character as part of a command
- **Wrayth imports** auto-detect the convention via the `\r` (Enter) marker — a Wrayth macro without trailing `\r` gets imported as type-and-wait
- **Genie imports** already work natively since Genie macros use `@` directly

Examples that now work after import:
- `arrange @` — types "arrange " into the bar, you finish with the corpse name, press Enter
- `close my @` — types "close my ", you finish with the item name
- `transfer @ all` — types "transfer ", you finish with the target, then " all" continues after the cursor
- `'}` — Jaded's Wrayth macro, types "'}" into the bar, you finish with the target+message
- `\\x;'\}sekmeht @` — Genie-style compound macro with escape sequences, imports as `'}sekmeht @`, types `'}sekmeht ` into the bar with cursor at end

Compound Genie macros that use Genie's escape syntax (`\\` for backslash, `\}` for literal close-brace) now parse correctly too — pre-v0.8.10 our Genie parser would terminate the argument at the first `}` it found even when escaped, dropping the rest of the macro. Note: Genie macros that reference Genie variables (`$speak`, `$whisper`, `$emote`, etc.) will still partially work — the cursor positioning is correct, but the literal `$varname` text stays in the command bar until you delete it manually (Genie variable support is a separate, future feature).

The macro editor in Automations → Macros now has a hover tooltip on each command field explaining the convention.

### Stream id aliases now shared across the parser, the import wizard, and runtime

Internal cleanup that makes the codebase easier to reason about and prevents drift between the parts that route streams. All the stream id aliases (`talk` → `conversation`, `whispers` → `conversation`, `death` → `deaths`, `logons` → `arrivals`, etc.) now live in one shared module. Imports that reference legacy stream names (`#echo >talk` from Genie, or a legacy Lichborne F29 export carrying `'conversations'` references) get normalized at import time so the saved rule references the right panel.

---

## What's new in v0.8.9

A focused release driven by JadedSoul's import-stress-testing across Wrayth / Genie / Frostbite combinations and Sekmeht's observation that Lich Map tracking on inactive character tabs got stale. Seven fixes, all under the import-safety and map-tracking themes.

> **⚠️ Upgrading note — broken imports from earlier versions**
>
> Two of the fixes below (the Wrayth speech-macro entity decode and the Genie `#send #flash`-style trigger handling) only apply to **fresh** imports from v0.8.9 onward. If you imported a Wrayth `settings.xml` or a Genie config in v0.8.4–v0.8.8 and noticed:
>
> - Speech / whisper macros that print errors like `>&apos;}` or "Please rephrase that command" — re-import that Wrayth `settings.xml` (or manually replace the `&apos;` text in the macro action with `'`)
> - Triggers that fire silently with no visible action but cause DR errors — check the Automations panel for triggers with `command: '#flash'` (or any other `#word`) and either re-import the original Genie `triggers.cfg` or change them manually
>
> Existing rules saved before v0.8.9 are left alone — Lichborne doesn't auto-modify previously-imported data. Re-importing is the recovery path; the v0.8.9 import path correctly handles both cases now.

### Fixed (the big one): imports no longer wipe categories they don't carry

If you imported all your Genie configs and then imported Wrayth macros — even in Replace mode — Wrayth would wipe your Genie triggers and aliases because Wrayth doesn't carry those categories and the empty arrays overwrote your data. Same shape was possible on Append when you deselected a category in the second import. Fixed: every import now only touches the rule categories it actually has data for. Wrayth never touches your triggers or aliases (because Wrayth doesn't have them); Frostbite never touches your triggers, aliases, or contacts; Genie can touch everything; Lichborne self-imports touch whatever's in the export. Every combination of legacy clients now plays nicely.

The merge descriptions are also clearer:
- **Append** for Lichborne self-imports now says explicitly: "duplicates (same pattern + scope + case for highlights/triggers, same key for macros, same input for aliases) are skipped automatically."
- **Replace** for legacy clients now says: "For each category the import has data for, delete your existing rules of that type and replace with the import. Categories the import doesn't touch are left alone."

### Fixed: triggers no longer double-fire on speech

Imported AND newly-created triggers now default to watching `main` instead of `any` stream. DR routes "Bob says X" into both the main stream and the conversations stream, so a watch-all trigger was firing twice on every speech line. Speech and other text-pattern triggers will now fire once.

### Fixed: Wrayth speech macros (`'}`, `'} ask`, etc.) no longer broken on import

If you imported Wrayth macros for speaking, every speech attempt was getting "Please rephrase that command" because Wrayth stores apostrophes in macro actions as `&apos;` (an XML entity) and the import wasn't decoding it back to `'`. Decoding the five standard XML entities now — `&apos;` `&quot;` `&amp;` `&lt;` `&gt;` — so the macro actions come through as the actual characters.

### Fixed: Genie `#send #flash` style triggers no longer spam DR with unknown commands

If your Genie config had triggers like `#trigger {pattern} {#send #flash}` (where someone wrapped a Genie command in `#send` thinking they needed to "execute" it), the import was treating `#flash` as a literal DR command and DR was responding "Please rephrase that command" on every trigger fire. Now Lichborne recognizes this shape and converts it correctly — `#send #flash` becomes a flash action; `#send #beep` becomes a beep action; etc.

### Improved: Lichborne→Lichborne imports are append-only

When you import a Lichborne export from another character, the Replace mode no longer appears as an option. Self-imports are conceptually "merge another character's setup with mine," and Replace mode (which wipes per category) is never what you want for that workflow. Duplicates are skipped automatically. If you genuinely want to start fresh from a backup, delete your rules manually in the UI first, then import via Append.

### Fixed: Lich Map indicator stuck on inactive character tabs

If you tabbed between characters, the Lich Map on an inactive tab could get stuck showing a stale location — the room tracking was working in the background, but the camera transform was being calculated against the tab's 0×0 hidden dimensions and stranding off-screen. Same bug class as the Genie Map fix that shipped in v0.7.0, just never ported to the Lich Map side. Now ported — when you switch back to an inactive character, the Lich Map snaps to their actual current room.

### Genie command coverage expanded + import preview now warns about unsupported commands

Sekmeht enumerated Genie's full `#command` list from the Genie source. New aliases now recognized correctly:
- Game commands: `#q`, `#que`, `#queue` (aliases of `#put`/`#send`)
- Variables: `#variable`, `#setvar`, `#setvariable`, `#tvar`, `#tempvar`, `#tempvariable`, `#svar` (all aliases of `#var` — Lichborne doesn't distinguish var scope)
- Sounds: `#playsound`, `#playwave` (aliases of `#play`)
- Beep: `#bell` (alias of `#beep`)

Also: `##5` (Genie's escape syntax for a literal `#5` to send to the game) is now handled correctly.

The bigger improvement: any unrecognized `#command` (rule manipulation like `#trigger`/`#alias`/`#highlight`, UI control like `#statusbar`/`#window`, connection control like `#disconnect`, Genie scripting like `#if`/`#parse`/`#event`, math like `#math`/`#random`, mapping like `#mapper`/`#walk`/`#go`) now shows up in the import preview as "Unsupported actions skipped: #X, #Y" so you know to manually replace those after import. Pre-v0.8.9 they were silently dropped and the trigger imported with empty actions thinking it'd work.

---

## What's new in v0.8.8

A small bug-fix release continuing the v0.8.7 follow-throughs and adding two UX improvements.

### Fixed (actually this time): bottom prompt cut off at font 13+

The v0.8.7 attempt at this didn't work — Rakkor confirmed the prompt was still half-clipped. Diagnostic: he could manually scroll down about half a row past where the snap landed to reveal the full prompt, proving the bug was in the layout (the scrollable content extended past where every scroll API thought the bottom was), not in scroll math. Real fix this time: a small invisible buffer below the last row, sized to absorb the worst-case clip, only present at font 13+ where the issue actually occurs. Font 12 and below stays flush against the vitals strip with no extra gap.

Pair fix shipped in the same release: changing your font size while you were already pinned to the bottom now re-snaps you to the bottom (previously the row-height change left you a little above it, with the last line clipping). If you were scrolled up reading older text, your position is preserved — only bottom-anchored readers get re-snapped.

### Highlights now apply in the Room panel's structured sections

Requested by Rakkor — his treasure highlights painted blue in the main scroll's "You also see ..." line but the Room panel's Objects section showed the same items plain. The Room panel now applies line-mode highlights to each section (Objects, Players, Creatures, Extra) the same way the main scroll does, so the same content gets the same styling in both places. Each section is independent — a rule matching a player name paints only the Players section, not Objects or Creatures. Room descriptions (the multi-sentence prose block) deliberately stay out of line-mode scope so a single match doesn't paint a whole paragraph.

### Fixed: Lich Map "hangs" on prior room sometimes

Reported by Rakkor — sometimes after moving to a new room, the Lich Map's "you are here" indicator stays stuck on the room you just left, until you manually `LOOK` to force a refresh. Same shape as the Genie Map stale-tracking bug that v0.8.4 addressed via a different mechanism. Root cause: DR sends two separate XML tags for every room transition — one carries the new room title, the other carries the new room id. The front-end was reading the first one but silently dropping the second. For most transitions both arrive together so this didn't matter, but for some transition shapes (teleports, certain NPC- or script-induced moves) only the room id arrives — for those, the Lich Map never knew you'd moved.

Fixed by reading the room id from the second tag too. Lich's own scripting already does this (which is why `;e $room` was right the whole time even when the map was wrong). The Lich Map will now track correctly in those silent-transition cases. The Room panel title still stays stale until DR re-emits it (or you LOOK), since that's the only place the title string comes from — but the map indicator following you correctly is the more important fix.

Note: this is specific to the Lich Map. The Genie Map's stale-tracking is handled by a separate mechanism that already shipped in v0.8.4. If you see Genie Map stuck on the wrong room and LOOK fixes it, that's a different (related) issue and may need its own report.

### Mode button now scales with your font size

Spotted reviewing the toolbar — the Mode dropdown was using a fixed pixel size that ignored your Settings → Font Size choice. Every other toolbar button (Debug, Logs, Panels, etc.) scaled with your font; Mode stayed small. Fixed; the Mode button now matches every other toolbar button at every font size, and the dropdown menu items it opens also scale with your font.

---

## What's new in v0.8.7

A small bug-fix release — five fixes across the command bar, the Room panel, the scroll behavior at large fonts, Lich script stream discovery, and the Lichborne import/export round-trip.

### Fixed: Lichborne→Lichborne import silently dropped most rule fields

Found by a proactive code review, not by a tester report — shipping since v0.8.4 when the Lichborne import/export feature first landed. If you exported your highlights/triggers/macros/aliases from one character and re-imported on another, a lot was silently lost: highlight bold and glow, trigger gates / oneShot / cooldown / WAV sound paths / action ordering, custom rule names, enabled/disabled state, and most importantly **the group memberships every rule type carries**. So "share my hunting setup" exported your rules cleanly but the recipient ended up with rules that weren't actually in any group — the "hunting" group came across, but no rules belonged to it.

Fixed by routing Lichborne→Lichborne imports through a dedicated path that preserves the full native rule shape instead of translating through the legacy-client format. Legacy imports (Wrayth / Genie / Frostbite) still go through translation since those source formats genuinely need it. If you've imported a Lichborne setup in the past and the result looked sparse, re-importing on v0.8.7 will now bring in the full setup as intended.

### Fixed: command history Down arrow stuck after over-pressing

Reported by Binu with a clean reproduction. From a clear command box, pressing Down 3 times used to require 4 Up presses to get back to your last command — Down was decrementing past the empty state into negative territory and Up had to crawl back through it. Down now clamps at the empty state, so a single Up gets you back to your most recent command no matter how many times you over-pressed Down.

### Fixed: Room panel sections showed stale data from the previous room

Reported by Rakkor. The Players section (and Objects / Creatures / Extra / Exits) sometimes listed people or things from a room you'd already left, only clearing after a manual `LOOK`. Fixed at the parser level — whenever the room title changes, the Room panel's structured sections now clear immediately and re-populate with whatever the new room sends. Sections that don't get fresh data stay correctly empty.

This may also help a long-standing intermittent bug where Genie Maps "forgets" your location and tracks the wrong room until you refresh the maps. The root fix for that symptom is still v0.8.4's escape valve, but cleaner room-description handling on every transition removes one path that could trick the map's disambiguation logic.

### Fixed: bottom of the text window cut off at font size 13 or higher

Reported by Rakkor — the bottom prompt was halfway clipped at fonts 13+, with a faint scrollbar twitch right before each new command snapped it back. A scroll-pin threshold from the v0.6.x performance pass was tuned for the row heights at font 12 (~17px) and didn't catch the slightly larger fractional shifts at font 13+ (~20px rows). Threshold tightened; the prompt now sticks to the bottom at every font size.

### Fixed: a single Lich script created two identical rows in Panel Manager

Reported by Sekmeht with `newkill-counter.lic` as the repro — running it produced two "Kill Counter" rows in Available Streams, and adding one of them to a panel hid both. Scripts that declare a stream and immediately push to it (using both `<streamWindow>` and `<pushStream>` for the same id) were being seen as two separate discoveries inside one event batch. Discovery now dedupes within a batch — one stream id, one row, regardless of how many tag flavors the script uses to surface it.

---

## What's new in v0.8.6

A command-bar UX pass, contact stats, and a new built-in light theme — half polish, half new features.

### New "Classic" light theme

Requested by Rakkor. There's a new **Classic** entry in the theme picker with a paper-white background — sits right next to the dark Classic, distinguished by the swatch dot (black vs white). Same indigo accent as the Ivory family, but with hand-tuned room / experience / map colors for stronger contrast on a true white canvas.

### Contact stats — Encounters and Time Encountered

Sekmeht's idea, extending the existing last-seen tracking. Open any contact in the **Contacts** panel and you'll now see two new rows below "Last seen":

- **Encounters** — how many times this contact has been in your room. A 10-minute cooldown prevents an alt cycling in and out from inflating the count, and a 90-second "they actually left" gate prevents a long visit from re-counting when other players come and go from the room.
- **Time Encountered** — how long total you've stood in the same room. Polled every minute, so the granularity is minute-level. Renders as `42m`, `2h 13m`, `3d 5h`, etc.

Same two counters appear in the click-popover when you click a contact's name in game text — always visible, even at zero, so you can tell at a glance whether you've encountered someone before without having to open the full Contacts panel. The popover itself is also a bit wider and a bit taller now so the stats fit on one line each and mid-length notes don't force a scroll.

Both stats are per-character and travel through profile YAML + Lichborne import/export automatically. A **Reset** button next to the stats lets you zero out a specific contact's counters if an import or partial session produced something unexpected.

### Fixed: adding contact #12 silently dropped

Reported by Rakkor with a clean reproduction — adding a 12th contact ("Ruik") didn't actually save. The bug was a race between the contacts panel's save and the in-game "last seen" tracking buffer, which was holding a stale snapshot of the previous 11 contacts and overwriting localStorage with that stale data two seconds later. Fixed.

### Command-bar UX polish

### Click the `>` to open Quick Send

Requested by Rakkor. The `>` prompt marker next to the command bar is now a clickable button — click it and the **Quick Send** overlay opens with whatever you'd typed in the command bar already prefilled, exactly as it does with **Ctrl+Shift+Enter**. Tooltip on hover advertises the keyboard shortcut for testers who want to keep their hands on the keys.

### Click a character tab → focus jumps to the command bar

Requested by Rakkor. Switching between characters via the tabs at the top of the window no longer leaves focus floating somewhere harmless — the active character's command bar gets focus automatically so you can keep typing. The same behavior **Ctrl+Tab** / **Ctrl+1..9** have always had, now extended to mouse clicks.

### Floating font-size controls clear the scrollbar

Self-found while exercising the v0.8.5 per-panel font feature on a long stream panel. The **A−** / **A+** buttons in the panel's bottom-right corner used to sit right on top of the vertical scrollbar when content had scrolled past the panel height, making them awkward to grab. Moved them left so they sit just to the left of the scrollbar rail.

---

## What's new in v0.8.5

A follow-through release tightening up v0.8.4 work plus three new conveniences testers requested.

### Per-panel font size

Requested by Rakkor — Frostbite lets you tune each panel's text size independently. Every panel now has small **A−** / **A+** buttons in its **bottom-right** corner, stacked vertically; they're nearly transparent at rest, peek into view when you hover the panel, and go fully opaque when you reach for them. Click to bump the size up or down by 1 px (range 8–24). The size is per-tab and saves with your character — so your tiny Conversations and oversized Thoughts travel with you between sessions.

Scope for this release: the text-heavy panels — stream panels (Thoughts, Conversations, Arrivals, Deaths, Active Spells, Familiar, Inv, custom), Room, Experience, and Injuries — respect the override. Map / Debug / Lich Scripts panels don't yet (they have their own internal size rules); say the word and we'll wire them up.

### Lichborne export now includes your panel layout

Extension to the v0.8.4 Lichborne export. The exported YAML now also captures which panel zones you have enabled, what tabs live in each, the zone sizes, and the per-panel font overrides from above. On import, the wizard's confirm step shows an extra **"Apply imported panel layout"** checkbox when the file carries layout. Tick it and the importer overwrites your current layout; untick to keep your current arrangement. The new layout takes effect after you reconnect that character.

Old (v1) export files still load fine in the new importer. New (v2) files won't load in an older Lichborne — it'll tell you to update.

### Room panel: creatures now bold (monsterbold)

Reported by Rakkor with a screenshot — `look` showed `an ice archon` in bold cyan in the main scroll but plain in the Room panel's Objects section. The parser was flattening DR's `<pushBold/>` markers to plain text when capturing the room components, so the bold info never reached the Room panel.

Fixed at the parser layer; the Room panel now renders Objects / Players / Creatures / Extra with the same bold styling as the main scroll. Same fix automatically gives the Room panel cross-segment regex highlights (B115) and the priority-overlay rendering (B116) for contacts inside highlights.

---

### Regex highlights now actually render in the Thoughts stream

Reported by Rakkor. The v0.8.4 fix for cross-segment regex matching was correct — the regex was finding the match against the joined line text, confirmed by **Debug → Fires** showing the rule firing. But the rendered Thoughts panel still showed no color.

The bug was in the renderer's overlap-handling: when a contact name match started at the **same position** as the highlight (e.g. a contact for "You" matching the first three letters of `Your mind hears ...`), the old "first wins, drop overlapping" algorithm dropped the entire highlight — even though most of it wasn't actually inside the contact. Rewrote the algorithm so contacts win INSIDE their own span and the highlight covers everything outside any contact. So you now get the expected layered look: contact-blue inside the contact name, highlight-orange everywhere else the highlight matched.

### RT / CT chips shorter

Reported by Rakkor. The v0.8.4 chip-doubling looked great horizontally but the vertical height was a bit much. Trimmed the height by a third (12 → 8px), kept the width and gap. The strip still reads as countable seconds, just less intrusive on the command bar.

---

## What's new in v0.8.4

A small theme + Lich Map polish + Genie Map tracking + Room panel highlights + accessibility audit release.

### New "Text weight" setting in Settings → Display

Reported by Rakkor on a light theme — game text reads visibly less black in Lichborne than in Frostbite even at the same `#000000`. The cause is Chromium's text antialiasing on Windows (DirectWrite) painting more grey fringe around each stroke compared to Frostbite's GDI ClearType. Same color, different renderer.

Added a per-character **Text weight** dropdown in Settings → Display with seven options on a symmetric scale: Thinnest, Thinner, Slightly thinner, **Default**, Slightly bolder, Bolder, Boldest. Positive options widen the stroke for a darker / heavier look (handy for light themes). Negative options drop the font weight below regular — these only render thinner on fonts that ship light weights (Cascadia Code, the default, has 200/300/350; Consolas and Lucida Console fall back to regular silently). The Settings preview reflects your choice live, so you can see the effect before saving.

### Color-blind and high-contrast settings now survive theme edits

Self-found while auditing the accessibility settings — switching themes, previewing a custom theme in the Theme picker, or live-editing one in the Theme editor was silently wiping out the color-blind / high-contrast overlay until the next setting change re-applied it. Fixed so the overlays re-apply automatically after every theme write. The effect is invisible if you didn't notice the bug; only color-blind users editing custom themes were hitting it.

### RT / CT timer chips are easier to read at a glance

Requested by Rakkor. The little orange dashes that show your remaining roundtime (top of the command bar) and cast time (bottom) were too small to glance-count without focusing — defeating the whole point of having a visual readout you can see while looking at the game text.

Doubled the chip size, tightened the spacing between them. Five chips now reads as "five" without your brain having to stop and tally — the same way Frostbite's seconds-bar works.

### Regex highlights now apply across the Thoughts stream (and other panels)

Reported by Rakkor. A regex highlight like `Your mind hears .*? thinking,` was matching correctly in the highlight editor's preview but never painted on actual thoughts in the Thoughts stream. The reason was a parsing detail — the game wraps player names like "Yarwend" in XML attributes that split a single thought line into multiple pieces internally, and the highlight engine was matching each piece in isolation. So a pattern that spanned the player name could never find a match.

The highlight engine now matches against the joined line text before splitting back to apply colors per piece — so cross-name regex highlights work in every stream panel (Thoughts, Conversations, Arrivals, Deaths) as well as the main scroll. Contact-name lookups got the same treatment for free.

### Share your automations between characters with Import / Export

Requested by Rakkor. Until now, the only way to share rules or contacts between characters was to copy the per-character YAML profile by hand — which also dragged along your theme, layout, and connection settings.

Two new buttons in the **Automations** panel header:

- **Export** — saves your active character's highlights, triggers, macros, aliases, groups, modes, contacts, and contact templates into a single YAML file named after your character and today's date. Just a regular file you can drop into Discord, email to a friend, or back up.
- **Import** — the existing Import wizard now has a 4th tile, **Lichborne**, alongside Wrayth / Genie / Frostbite. Pick your `.yaml` file and it surfaces the contents in the normal preview screen so you can pick what to bring in.

**See what's new vs. what's already in your profile.** The preview marks rows that already exist in your profile with an **EXISTS** badge in the Status column, dimmed so they recede visually. A new **Hide items already in this profile** toggle in the select bar declutters the list so you can focus on just the new stuff.

**On append**, the importer skips items that already exist — so re-importing into a profile that already has the seeded `Ctrl+Enter` / `Alt+Enter` / `NumpadEnter` repeat-command macros won't pile on duplicates. The post-import summary tells you both what was added and what was skipped (e.g. *"3 highlights, 5 macros (skipped 2 macros already present)"*). **On replace**, the importer wipes existing rules and writes the import wholesale, exactly as you'd expect — duplicates included.

The Export and Import buttons themselves also picked up a small style fix: their hover state now matches the toolbar buttons elsewhere in the UI instead of jumping to a saturated accent color, which on some custom themes read as the buttons "losing their theming" on hover.

### Theme Editor — panel body text follows the general text colors

Reported by Rakkor. If you built a light theme, setting **Game Text** in the Theme Editor didn't catch all the body text — panels like Room, Hands & Spell, and Experience had their own greyish text colors that the editor's main "Text" group never touched. So getting a clean light theme meant hunting down ~10 different specialty rows.

That's now mostly automatic. The panel-specific body-text colors (Room section labels, Room content, Hand label / empty, Spell empty, Exp skill / mindstate / rate) default to the general **Game Text / Labels / Muted Text / Dim Text** scale unless a built-in theme deliberately overrides. Set the four general text colors and every panel follows along.

Every row in the Theme Editor also picked up a hover tooltip explaining where in the UI that color paints — hover the row label (or the small **ⓘ** marker) to see the description. No more "tweak the field, restart, see what didn't change."

### Highlights and contact colors now apply in the Room panel

Reported by Rakkor. If you'd tagged a player as a contact (e.g. Dawan = blue), their name showed correctly in the main text scroll on `look`, but the Room panel's **Players** section rendered the name in the default color. Same gap was there for the Objects / Creatures / Extra / Description sections.

The Room panel now routes its text through the same render pipeline as the main scroll, so contact colors and match-scope highlight rules apply consistently. Tagged friends light up in the Players list, creature-name highlights you've set up for hunting light up in the Creatures list, and so on.

### Genie Map no longer gets stuck on your last location after teleports / disconnected moves

If you walked between two zones that the Genie maps don't have a stub connecting (a teleport, `;go2`, recall, or just an unmapped boundary), the marker would refuse to leave your previous room. Typing `look` wouldn't help — only **↺ Refresh Genie maps** would snap you to the right place.

The "conservative cross-zone" guard that protected against one-off file-order accidents now has an escape valve: after three consecutive room titles all wanting the same different zone, the map gives up on the old location and commits to the new one. One-off accidents are still blocked exactly as before — only a sustained run of "I really am somewhere else" triggers the escape.

### Lich Map no longer flashes "NEEDS MAPPING" between walk steps

During fast travel the Lich Map briefly painted a "NEEDS MAPPING" warning banner for a single frame between every room — the new room title arrived a frame before the description and id caught up, and the room-match step ran on the incomplete data. Now the map waits a beat (400ms) before clearing its current-room match. Normal walking resolves long before that, so the banner never appears. Genuinely-unmapped rooms still surface the diagnostic — just without the strobe effect on every step. As a bonus, the "you are here" locator no longer briefly disappears between rooms either.

### Genie Map background follows your App Background

Reported by Binu. The map panel's background was a separate, hardcoded brown-black — so when you picked a different **App Background** in the Theme Editor, the rest of the game windows updated but the map stayed dark and looked visually disconnected from the rest of the UI.

The map now follows App Background by default. Built-in themes that intentionally style the map differently (Parchment, Mist) still use their own map color — only the default dark theme and any custom themes you've built in the Theme Editor are affected.

---

## What's new in v0.8.3

A small release: Stormfront/Wrayth-style repeat-command macros, a graphical Rested-Experience widget in the Exp panel, plus three quality-of-life bug fixes (external links, combat falling back to main, and Lich script streams not appearing under Available Streams).

### Repeat-command macros (Ctrl+Enter, Alt+Enter, NumpadEnter)

Requested by Binu — the Stormfront/Wrayth convention for replaying recent commands without retyping them.

Fresh characters get three macros pre-seeded:

- **Ctrl+Enter** — sends the **last command** you typed.
- **Alt+Enter** — sends the **second-to-last command** you typed.
- **NumpadEnter** — if the command bar has text typed in it, sends that (acts as Enter); if the bar is empty, sends the last command (like Ctrl+Enter). This is what Wrayth's NumpadEnter does.

Useful for the classic DR loop of `get pile` / `stow flower` — type both once, then `Ctrl+Enter` / `Alt+Enter` over and over.

These are implemented as **special macro tokens** rather than hardcoded keybindings, so you can rebind them in the Macros panel. The tokens are `{RepeatLast}`, `{RepeatSecondToLast}`, and `{ReturnOrRepeatLast}` — they appear under a new "Special tokens" section in the variable picker (`$` button next to each command field in the Macros editor), click to insert. If you've already bound Ctrl+Enter or Alt+Enter to something else, the seeding step skips that key — never silently overrides your customization. If you delete one of the seeded defaults, it doesn't come back on next launch.

Repeated commands run through the same alias machinery as a freshly-typed command — so repeating `hunt` re-fires your `hunt → stalk creature` alias instead of sending the literal word raw.

### Rested-Experience widget in the Exp panel footer

The single-line RXP chip (`RXP 2:35h / 1:48h`) has been replaced with a small dual-bar widget that's much easier to read at a glance:

- **Stored** bar — how much rested-XP you currently have banked.
- **Usable** bar — how much you can spend before the cycle resets (can be larger or smaller than Stored — the game tracks them independently).
- **Resets in X:XXh** caption — the cycle-refresh countdown (previously not displayed anywhere).

Both bars are scaled to your subscription cap (4h Standard / 6h Premium / 8h Platinum). The cap **auto-calibrates** — it starts at 4h and grows the first time your Stored or Usable observation exceeds the current cap, so Premium and Platinum testers will see correct scaling after one normal play session. No subscription-tier setting required. The widget hides when you don't have any RXP data (F2P without Brain Boost), and the existing red Death's Sting badge takes its place while DS is active.

### External links through the play.net bounce now actually open

In v0.8.1 we added Genie-style web-link safety — clicking an external `http`/`https` URL in the game window routes through Simu's bounce page (`https://www.play.net/bounce/redirect.asp?URL=...`) so you get the standard "you are leaving Play.net" confirmation before the actual destination opens. Unfortunately the URL we handed to the bounce was URL-encoded, and `redirect.asp` takes that value literally — it treated the encoded `://` as part of the destination, so the browser landed on a "site doesn't exist" page instead of the link you clicked.

Fixed by passing the URL raw, the same way Genie does. Web-Link Safety can stay on (default) and external clicks now actually open the page you clicked.

### Combat (and conversations / thoughts / atmospherics / …) fall back to the main window correctly

When you remove a panel zone from your layout — or never add the new Main-Top zone in the first place — the streams that *would* have lived there are supposed to fall back to the main text window. Combat, Conversations, Thoughts, Arrivals, Deaths, Familiar, Group, Assess, and Atmospherics all have this fallback. A bug was preventing it from kicking in: phantom tabs left behind in a never-rendered zone still "counted" as watching their stream, so the fallback was silently skipped and the lines disappeared into a buffer you couldn't see.

Fixed. With no Main-Top panel added (or any other zone removed), combat is back in the main scroll where you can read it. Related side fix: the first time you add the Main-Top panel via Panel Manager, you'll now get an empty placeholder you fill yourself — instead of the surprise `[Room, Combat]` auto-population. (If you already have tabs saved in Main-Top from an earlier session, they stay.)

### Lich-script streams (moonwatch, etc.) now reliably show up under Available Streams

A scrap of the same bug above also affected the Panel Manager's Available Streams list. If a Lich script had once declared a stream and the tab landed in a zone that you later un-added, the Panel Manager treated that invisible tab as "already placed" and hid the stream from Available Streams — leaving you with no path to re-add it to a visible slot. Reported by Legiro with the moonwatch script. Fixed the same way: tabs in un-added zones don't count as "open" anymore, so the stream shows up under Available Streams and you can drop it into the panel you actually want.

---

## What's new in v0.8.2

A polish release driven by Debug panel rough edges and Panel Manager quality-of-life.

### Panel Manager — reorder streams in a slot

Each stream row inside an added panel slot now has **◀ / ▶** buttons that shift the tab one position left or right within the slot. The order in the Panel Manager and the order of tabs in the in-game PanelFrame tab bar are the same — reordering here immediately reorders the tabs you see in the game window. Disabled at the ends so there's no silent no-op.

The Panel Manager modal also got another ~50% wider (now 870px) — the per-row controls had grown to five buttons in the 3-zone "Streams" sections and the prior width was visibly cramped.

### Debug panel — GOTO from Fires to the rule

The **Debug → Fires** tab now has a small **→** button on every row. Click it to jump straight to the source highlight or trigger in the Automations panel, opened for edit. Works for both highlights and triggers; falls back gracefully if the rule was deleted since the fire was logged.

Both Fires and Events tabs gained **column headers** (sticky to the top while you scroll), so the layout reads:

- **Fires**: Time / Kind / Stream / Rule / Matched text / Detail / Goto
- **Events**: Type / Payload

### Debug panel — Copy All actually works

The **Copy All** button silently did nothing in earlier versions (the renderer's permission handler quietly refused the clipboard call — same root cause as the v0.1.9 auto-copy bug). It now routes through Electron's native clipboard. Click any tab (Fires / Events / Raw XML) to focus it, then **Copy All** copies that tab's content to your system clipboard.

### Debug panel — keeps 4× more history

Buffer limits bumped from 500 → 2000 entries per tab. Collection is only active while the Debug panel is actually open, so this costs nothing during normal play.

### Lich Map walks via Lich's `;go2` script

Requested by Binu. The Lich Map's right-click "walk to room" and the "Walk here" button now delegate to Lich's stock `;go2` script instead of running a local step-by-step walker. `;go2` handles locked doors, hidden exits, blocked paths, retries, and roundtime — everything the old local walker fought with. Click a destination room → right-click → done; Lich figures out the path. To stop a walk in progress, type `;k go2` in the command bar.

(Genie Maps movement is unchanged — Genie uses direction commands like "north" / "climb tree", which `;go2` doesn't speak.)

### Lich Map "you are here" — easier to spot

Requested by Binu — the previous green-rect indicator was hard to see on Lich's white/cream PNG tiles and disappeared into green map regions. Replaced with the same sonar-locator pattern used on Genie Maps: two expanding ping rings + a dual-contrast solid ring (dark backdrop + bright lime accent) so it reads against any background. Both maps also gained a small **bullseye centre dot** so the exact room stays unambiguous even in dense clusters.

Themable via three new CSS variables (`--lich-here-color`, `--lich-here-backdrop`, `--lich-here-fill`) — independent from Genie's `--map-current-color` since the two maps have different visual aesthetics.

### Floating compass — centre dot removed

The little `·` in the middle of the compass drew off-cell at common font sizes (the dot glyph's baseline metrics put it up-and-left of where it visually belonged). The 8 directional arrows imply the centre by negative space anyway, so the dot is gone.

### Bug fixes

- **Phantom "Necromancy" fires (and similar) in the Fires log.** If a highlight regex had a trailing `|` before its closing `)` — e.g. `\b(word1|word2|)\b` — the empty alternative would match the zero-length string at every word boundary, causing the Fires log to record dozens of phantom fires per line on text the rule wasn't actually highlighting. The visual rendering was always correct; only the Fires diagnostic log was lying. Fixed at the engine level so even malformed patterns can no longer flood the log.

---

## What's new in v0.8.1

A polish release: the Panel Manager gets a real overhaul, the Lich profile YAML editor gets a search field, an optional Main-Top panel zone appears for things like the Combat stream, external link clicks get a safety warning, and a couple of behind-the-scenes annoyances are gone.

### Panel Manager — explicit add / remove of each panel slot

The Panel Manager has been rebuilt around the idea that the four panel locations (**Main-Top**, **Top-Right**, **Middle-Right**, **Bottom-Right**) are individually *added to* or *removed from* your layout. A new **Panel Locations** section at the top of the manager shows each slot with an **Add Panel** or **Remove Panel** button:

- **Add Panel** snaps the slot into the game window as an empty placeholder, ready to receive streams.
- **Remove Panel** hides the slot and returns its streams to the Available Streams list at the bottom. (Streams like Combat / Conversations / Thoughts that have a fallback drop back to the main window automatically; Active Spells just stops displaying — see below.)

The right column now auto-sizes by how many slots you have added:

- **1 slot** → fills the column.
- **2 slots** → split 50/50 with a draggable divider between them.
- **3 slots** → the original layout (top + middle use your saved heights, bottom takes the remainder, both dividers draggable).
- **0 slots** → the whole right column disappears and the main text gets the full width.

The **Main-Top** zone (introduced this version) defaults to *not added* for existing users — add it via the Panel Manager when you want it. New users also start with Main-Top removed; everything else is added by default to match the v0.8.0 layout.

### Main-Top panel zone — for Combat, Room, or anything you like

A new resizable panel zone sits above the main scrolling text on the left side of the game window. Originally introduced for the Combat stream (now its own panel type — close it and combat lines fall back to the main window) but it can hold any stream. Resize it via the divider between it and the main text. Add it from the Panel Manager → Add Panel next to Main-Top.

### YAML editor — search inside profiles

The Lich profile YAML editor (Lich → Profiles tab) now has a **Search YAML…** input. Press Enter or click Find to jump to the first matching line (case-insensitive); click again to cycle through matches. The search works in both view mode and edit mode — if you find a key in view mode and then click Edit, the editor scrolls to the same line and selects the match in the textarea.

### Web Link Safety — bounce external URL clicks through play.net

A new **Web Link Safety** toggle in Settings (default **on**) mirrors Genie's same-named setting. When on, clicking any external `http://` or `https://` URL in game text routes through `https://www.play.net/bounce/redirect.asp?URL=…` — Simu's "You are leaving Play.net" interstitial. Turn it off if you'd rather have URLs open directly.

### Active Spells no longer spams the main window when closed

Previously, closing the Active Spells panel sent every spell-tick update to the main scroll (because Active Spells fell back to main like the chat-style streams do). Active Spells is a *state* stream — the game re-emits the full list whenever it changes — so that fallback turned out to be noise. Closing the panel now just stops displaying spell updates until you re-add it.

### Closing the app feels instant

The "Closing — backing up profiles…" overlay used to flash for a fraction of a second even when shutdown actually completed in tens of milliseconds. The overlay now waits 250ms before painting, so backup-only shutdowns and single-Lich-session quick-closes never show it at all. Only genuinely slow closes still surface it. The socket-close safety cap was also tightened from 1.5s to 0.5s.

### Smaller fixes

- **Combat stream no longer duplicates** in Available Streams (it was showing up twice once you'd opened a Combat panel; clicking the second row added a duplicate tab). Fixed at the discovery layer and defensively in the Panel Manager — builtin panel ids can no longer enter the "discovered" list.
- **Panel Manager visuals**: zone labels renamed for clarity (Main / Top / Mid / Bottom → Main-Top / Top-Right / Middle-Right / Bottom-Right), modal widened to fit the new button labels comfortably, sections and rows get clearer visual separation.

---

## What's new in v0.8.0

A major rework of the login and character-selection experience. The Add Character flow becomes Add Account, the launcher gains Favorites + grouping + collapse + bulk connect, the wizard discovers your characters in one shot, and four real bug fixes shipped along the way (DRT/DRX/DRF routing, tab reconnect, profile field stripping, scrollable modal).

### DRT, DRX, and DRF characters now actually go to the right server *(B95)*

*Reported by Binu.* Characters configured for Prime Test (DRT), Platinum (DRX), or The Fallen (DRF) were silently routed to DR regardless of the saved game. Four separate layers of the connect path were each throwing the game info away — fixed end-to-end. Your character's saved game now drives the Lich port, the Lich launch flags, and the Simutronics SGE authentication. If you have a DRT/DRX/DRF character that's been misbehaving, this release fixes it; no profile changes needed on your end.

### Add Account — one-shot character discovery

The "Add Character" flow has been rebuilt as **"Add Account."** Type your account, password, and game once; Lichborne pulls your character list straight from the Simutronics auth service and shows it as a checkbox list. Pick which characters you want as launcher tiles, click Add, done — every selected character lands as a tile in one pass. No more running the wizard once per alt.

The discovery doesn't need Lich running — it's just the standard SimuCo authentication. So you can add an account before you've ever launched Lich on this machine, and tiles for every character are ready to click. Discovered characters that already have a profile in your launcher are skipped (existing automations, themes, and layouts stay untouched).

A small **↺ Refresh** button now sits next to each account name on the launcher — click it to re-run discovery and pull in any characters you've made in-game since you last added the account.

### Bulk Connect — log in everyone in one click

New **⚡ Bulk Connect** button in the launcher top bar (appears once you have two or more accounts with characters). Click it: Lichborne shows a picker listing each of your accounts with a dropdown to pick one character per account. Confirm and Lichborne logs them in one after another, with a progress overlay along the way. A final summary tells you what landed and what didn't. Accounts that are already in use are skipped automatically.

The picker defaults each account's dropdown to a favorited character if you have one, so daily-login is usually just two clicks: Bulk Connect → Confirm.

### Launcher reorganized

Several things at once:

- **Grouped by account → game.** Characters now live under their account, sub-sectioned by game (DragonRealms / Platinum / Fallen). Empty sections don't render.
- **Account sections are collapsible** to keep the launcher tidy if you have many characters across many accounts. State persists across launches.
- **Single-account users always see their account expanded** — no collapse toggle, no friction.
- **Accounts you just added auto-expand once** so you actually see what you added (and on your first 1→2 transition, your existing account stays expanded too).
- **A persistent + Add account button in the top bar** — no scrolling past collapsed sections to find it.
- **Tiles are more compact** — three rows instead of five (header / meta / pills + Connect).
- **First-time hint** suggests clicking the ♡ to pin daily characters. Dismissable.
- **Welcome card copy** rewritten for the account-based flow.

### Favorites + heart toggle

The launcher has a new **Favorites** section at the top. Each tile has a small heart icon — click ♡ to add a character, click ♥ to remove. Favorited characters get pinned to the top for quick access; they also still appear in their normal account section below, so you don't lose the overall organization. The Favorites section is always open (it IS the at-a-glance view for daily logins).

### Lich/Direct pills are now a pair

The single LICH/DIRECT badge has been split into a pair — both pills render next to each other on the tile, with the active one in colour (Lich green / Direct blue) and the inactive one greyed out. Click the grey pill to switch modes. The "other option exists" is now obvious without needing to hover for a tooltip.

### Test Server is a pill too

Each DR character tile shows a **TEST** pill alongside LICH / DIRECT — greyed when off (the default; character connects to DR), colored when on (character connects to DRT). Click to toggle. DRX and DRF tiles don't show it (no test variant exists for them).

### Character profiles — guild, circle, and notes

Each tile has an **Edit Profile…** option in its ⋯ menu. It opens a modal where you can record:

- **Guild** — pick from the 12 playable DR guilds (or leave blank).
- **Circle** — your character's circle / level.
- **Notes** — free-form text. Whatever you'd like to remember about this character — gear, training plans, script settings, whatever.

When set, guild + circle appear inline on the tile (`DR · Empath 50`). When you've written any notes, the tile shows a small **✎** indicator at the end of the meta line.

### Hide tiles you're not using

Each tile has a visible **⋯** menu button in its top-right corner (right-click on the tile still works for the same menu). Options:

- **Edit Profile…** — opens the notes editor above.
- **Hide Profile** — removes the tile from the launcher but keeps the YAML on disk. A "Show N hidden profiles" button appears at the bottom of the launcher when you have any hidden, so you can un-hide them later.
- **Delete Profile…** — the destructive delete (previously only reachable by right-click).

### Same-account conflict is a question now, not a refusal

*Requested by the developer.* If you try to connect Sekmeht when Sekmeht is already connected on the same account (DragonRealms only allows one character per account at a time), you used to see a flat error refusing to continue. You now get a confirmation — *"Sekmeht is currently connected on account FORTISSABROK. Continue and Sekmeht will be disconnected automatically before {newchar} connects."* — with Cancel and "Disconnect Sekmeht and continue" buttons. The disconnected character's tab stays open (dim) in case you want to log back into it later.

### Each shard gets its own tab

Logging Sekmeht into DRT then logging Sekmeht into DR used to share a single tab — the second connect just renamed the first. Now each (character, shard) combo is its own tab — Sekmeht-DR and Sekmeht-DRT are distinct entries. You still can't have both connected at the same time (the account-slot rule), but you can have one connected and one disconnected for easy switching.

### Character tabs reordered with a tight cluster

Inside the game window, character tabs now read **Name → L/D pill → Game code → Indicators** (was Name → Game → L/D). The L/D pill mirrors the launcher's LICH/DIRECT colors. The name + pill + game code render flush against each other (no whitespace) with the colored pill providing the visual separation; health %, status glyph, and × stay properly spaced after.

### Faster shutdown *(B99)*

Closing Lichborne while connected used to take up to 5 seconds per session while we waited for the game server to acknowledge the disconnect. Shutdown is now ~300ms regardless of session count — we send QUIT and force-close as soon as the bytes have left the wire, instead of waiting for the round-trip ack. The character is still logged out either way. A brief "Closing — disconnecting N characters…" overlay covers the wait so the window doesn't look frozen.

### Profile fields stop disappearing *(B97)*

If you favorited a character or set notes / guild / circle on them, the GameWindow's background save could quietly strip those fields back to nothing. The save now reads the existing YAML and preserves launcher-managed fields before writing. Favoriting on a connected character now sticks.

### Add Character modal scrolls *(B98)*

Clicking + while logged in opened the Add Character modal, but the content was cut off if it didn't fit the window — no scrollbar. Fixed; the modal now caps its height to the viewport and scrolls inside.

### Reconnecting no longer leaves the tab grey *(B96)*

Disconnecting a character then reconnecting (same character) used to leave the tab rendered as if still disconnected. Fixed.

### Lich Setup — two removed fields

Two settings in **Lich Setup** are gone:

- **Delay (s)** — the old wait-before-connect timer. Since v0.7.0 the client retries the Lich connection until it succeeds, so a manual delay didn't do anything useful.
- **Hide Lich window** — the toggle for showing the Lich console. Lich now always launches hidden.

If your saved profile has these old settings, nothing breaks — they're silently ignored on load.

## What's new in v0.7.1

A small UX pass — three papercuts found by testers using multi-character play.

### Compass redesigned

The floating compass overlay was hard to read — the card it lived in was nearly invisible against a dark game window, blurred whatever text was behind it, and would have dropped a black blob on light themes. The whole card has been removed:

- **No more card.** The compass directions float directly over the game text. Available exits glow in your theme's accent color; unavailable directions stay dim but visible so the compass shape is always there to read.
- **Arrows are chunkier.** The Unicode arrow glyphs were too thin; they're now stroked thicker so they read clearly even at small sizes.
- **`DN` is now `DOWN`** in the special-exit row, alongside `UP` and `OUT`.
- **Text behind the compass reads sharp.** A previous backdrop-blur effect was softening game text behind the compass; that's gone, so you can read whatever's underneath without distortion.

### Ctrl+# now focuses the command bar

*Reported by Binu.* Switching characters with **Ctrl+1**, **Ctrl+2**, … or **Ctrl+Tab** used to flip the tab but leave focus wherever it was — usually nowhere — so you had to click into the new tab's command bar before you could type. Now the new tab's command bar is focused immediately. Type, send, switch, type — no clicking.

### Ctrl+Shift+Enter remembers what you were typing

*Reported by Sekmeht.* If you'd typed half a command and then hit **Ctrl+Shift+Enter** to retarget it to another character, the Quick-Send box opened empty and you had to retype the command. It now opens **pre-filled with whatever was in your command bar** (and the text is selected, so you can immediately replace it or just press Enter to send as-is). Your original command bar is left untouched in case you cancel.

### Font picker shows each font in its own face

*Requested by Binu.* The Settings → Font family list used to render every entry in the same monospace face — Cascadia Code, Comic Sans, and Wingdings all looked identical. Each font name is now rendered in its actual font, so you can visually compare what they'll look like before picking one.

### Text feels lighter

*Reported by Sekmeht and Binu.* Lichborne felt heavier than Genie or Frostbite — regular game text read as already-bold, and the hands display would snap from a normal "Empty" to an extra-bold item name when you picked something up. Three coordinated changes:

- **Default font is now Cascadia Code** (bundled with Windows Terminal and stock on Windows 11). Consolas — the previous default — only has two weights, so the UI's intermediate "soft emphasis" everywhere collapsed into full bold. Cascadia ships with seven weights and finally lets the in-between weights show up the way the design intended. If you'd already picked a specific font in Settings, you keep it; only fresh characters get the new default.
- **The hands display no longer snaps to bold.** When you pick something up, the item name changes color but stays the same weight as "Empty" was — much less jarring. Same for prepared spells (the colored glow stays as the emphasis).
- **Game `<bold>` text is now semibold instead of full bold.** Bolded creature names, room titles, and any other game-emitted bold reads softer — a real "hey look" tier between regular and shouting, instead of always being shouting. (On Consolas the browser still falls back to full bold, so opt-in Consolas users see no change.)

### Quick-Send can broadcast to every character

When you have two or more characters connected, the Quick-Send target dropdown now has a **"Send to all connected"** option at the bottom — pick it and your command fires off to every connected character at once (including the one you're currently on). Useful for things like `;buff` everyone, telling every alt to head somewhere, or just yelling `ooc Snack break!` from one place. Disconnected tabs are skipped quietly. The "Send to all" option only appears when you have at least two characters connected — it stays out of the way for solo play.

## What's new in v0.7.0

Lichborne now keeps a session log.

### Session logging

Every character now writes a clean, dated log of its game session to disk — game text, channel content (thoughts, combat, deaths, script output), the commands you type, and connect/disconnect notices. One plain-text file per character per day, so a week of playing one character is just seven files.

Where they live: a **Logs** folder inside Lichborne's data folder, with a subfolder per character. The files are ordinary text — double-click to open them in Notepad, or point VSCode / Notepad++ / `rg` at the folder for serious review.

### The Logs button

A new **Logs** button in the toolbar opens a small in-client viewer with three modes:

- **Recent** — the tail end of the current day's log. Pick which day to view, check or uncheck individual streams, or hit a preset (**Everything / Combat / Social / Quiet**) to flip a whole layer at once. "Load older" pages further back. A **Dedup** toggle collapses lines that scripts emitted to several streams at once.
- **Search** — find a phrase (or a regex) across today, the last 7 or 30 days, or a custom date range. Click any result to jump straight into Recent centered on that line.
- **Export** — see below.

It's built for quick "what just happened?" and "when did X occur?" lookups — not for scrolling a 30 MB file. For that, use **Open Logs Folder** and your own editor.

### Right-click → Show in Log

Right-click any line in the game window and choose **Show in Log** to find that line in your logs instantly.

### Create a log file from your streams

The **Export** tab builds a clean log file exactly the way you want it:

- Pick a **date range** — a single day, the last week, the last month, or any custom span.
- Pick which **stream layers** to include — just thoughts, just combat, everything, or a preset.
- Choose the **format** — include timestamps or not, include stream tags or not, collapse duplicate lines, add a summary header, or split the result into one file per stream.
- Then **Copy to Clipboard** or **Save File**.

By default the output is a clean transcript with the metadata stripped — just the game text — but every part of that is a checkbox, so you can keep the timestamps and tags if you want them.

### Logs stay small

Session logs are designed to be light on disk. Older days are automatically **gzip-compressed** (about 85% smaller) — today's log stays plain text, and the in-client viewer reads the compressed days without you noticing. Together with a leaner line format, a month of daily play lands around 150–200 MB per character instead of well over a gigabyte.

Two cleanup limits keep it bounded: delete logs older than **N days** (default 30), and an optional **size cap** on uncompressed logs (default 500 MB). Settings shows a live disk-usage readout so you can always see what your logs are costing.

### Settings

A new **Session Log** section in Settings lets you turn logging off entirely, choose which categories to capture (game text / stream content / commands / system messages), toggle compression of old logs, set the retention period and the size cap, see current disk usage, and open the Logs folder. Logging and compression are on by default. These are **application-wide settings** — configure logging once and it applies to every character.

### Smoother Genie Maps while travelling

Running across the map — especially through a dense town like the Crossing — used to cost a lot of frame rate. The per-room animations (shop glints, water ripples, sparkles, and so on) are now far lighter:

- They **switch off while you travel** and come back about half a second after you stop — you can't appreciate them mid-run anyway, and turning them off entirely while moving is what reclaims the frame budget.
- Only the rooms **on screen** animate, instead of every room in the zone — so idling in a big town no longer churns.
- **Healers always pulse** — the heartbeat ring on auto-healer rooms keeps going even while you run, so a healer is always easy to spot.
- Player-housing rooms no longer flicker — they're everywhere, so the effect was just noise.

If you'd already turned **Genie Map Animations** off, nothing changes for you.

### The map keeps up better

- **The marker tracks you while running.** Rooms that share a name (the Crossing has seven "Moonstone Street" rooms) used to confuse the map mid-run, leaving the marker on the wrong room until you typed `look`. The map now follows the connections between rooms to keep itself straight.
- **A background character's map no longer drifts off.** If you run one character while playing another, switching back used to show the map stuck in a corner with your character off the edge. The map now re-centres on you the moment you switch to that character.

### More reliable Lich connection

Connecting through Lich used to wait a fixed five seconds and then try once — which sometimes wasn't long enough (and failed) and sometimes was too long. Lichborne now **watches for Lich to be ready and connects the instant it is**, with clear progress in the connection log. If Lich fails to start, you get a real error instead of a vague timeout. Logging in several characters at once is handled cleanly — their Lich instances start one at a time instead of racing each other.

### Smaller fixes

- Character tabs for connected characters now read at a consistent brightness — an inactive tab no longer looks dimmed. The tab you're viewing still stands out (background, border, bold); only a *disconnected* character's tab fades.

## What's new in v0.6.12

A fix and a cleanup.

### Scroll pinning fixed

Scrolling up to re-read something while the game kept sending text would drag what you were looking at off the top of the screen. That's fixed — scroll up and your position holds steady while new text appends below, the way it should.

### Smooth scrolling removed (story window)

The optional **Smooth Scrolling** setting for the game text window has been removed. It was off by default, didn't add much, and its lagging-catch-up behavior was easy to mistake for a bug. The story window now always scrolls instantly — simple and predictable. (If you'd turned it on, there's nothing to do — the setting is just gone.)

The Genie **map** still glides smoothly as it follows you around — that motion is now controlled by the existing **Genie Map Animations** setting, a single toggle for all map motion.

## What's new in v0.6.11

A small follow-up to v0.6.10. That release made smooth scrolling automatically snap to instant during huge bursts of text (like the login flood). v0.6.11 lets you tune *how big* a burst has to be before that kicks in.

### Smooth scrolling — tunable burst limit

If you have Smooth Scrolling enabled, there's now a **Burst limit** setting right below the toggle. It controls how many lines need to arrive at once before scrolling snaps to instant:

- **Lower it** (e.g. 5–10) and even moderate commands — `exp`, `inventory`, a detailed room — snap instantly; smooth scrolling is reserved for a line or two trickling in.
- **Raise it** and smooth scrolling rides through bigger bursts before giving up.

The default is 25, and it saves per character. This is for players who found that v0.6.10 still smooth-scrolled (and lagged) on mid-sized commands — turn the limit down and they'll snap like the big floods already do. The startup login flood always snaps regardless of the setting.

## What's new in v0.6.10

A focused fix for smooth scrolling. In v0.6.9 it became opt-in because it could cost performance; v0.6.10 makes it genuinely usable when you *do* turn it on.

### Smooth scrolling no longer lags at startup

If you enabled Smooth Scrolling, logging in could feel sluggish for a minute or two — game text and panels updating slowly — before settling down. That's because connecting to DragonRealms dumps a huge burst of text all at once, and animating the scroll through a burst that large makes the client do far more rendering work than it can keep up with (especially on a high-resolution display).

Smooth scrolling is now **adaptive**: it animates when text is arriving at a normal pace, and automatically switches to instant scrolling during a burst — the login flood, or heavy combat — then goes back to smooth once things calm down. You get the smooth feel during normal play with none of the startup lag. It's automatic; there's nothing to configure.

## What's new in v0.6.9

A small follow-up to v0.6.8. The smooth-motion work shipped on for everyone last release; a tester found it cost performance on their machine, so v0.6.9 makes it optional. Also fixes a long-standing annoyance with the `;list` command.

### Smooth motion is now optional

Two new toggles in **Settings**, both saved per-character to your profile:

- **Smooth Scrolling** *(off by default)* — when on, the story window and the Genie map camera glide smoothly as new text and movement arrive. When off, they snap instantly. If v0.6.8's scrolling felt off to you, it's now off unless you opt in.
- **Genie Map Animations** *(on by default)* — the per-room animations on the Genie Maps view (shop glints, water ripples, sparkles, etc.). Turn it off if the map feels sluggish — it freezes every animation, the same way the map already pauses them while you walk or drag.

Both settings remember your choice and travel with your character profile, so you set them once.

### `;list` is visible again

The Lich Scripts panel quietly polls `;listall` every few seconds to stay current, and that automatic poll is hidden from your game window so it doesn't spam you. But the filter was hiding **every** script list — including when *you* typed `;list` or `;listall` yourself. Now only the automatic poll is hidden; a list command you type shows its output normally.

### Lich Map zoom — better default, and it sticks

The Lich Map view used to snap back to a very close zoom every time a new map image loaded, and it never remembered if you zoomed out. Now it opens at a more sensible zoom and **remembers whatever zoom you set** — per character, across room changes and across relaunches — the same way the Genie Maps camera holds its zoom.

## What's new in v0.6.8

A polish release focused on how things *feel* — smoother map motion, a more eye-catching "you are here" marker, a new click model for the map, and smoother text scrolling — plus a batch of bug fixes from tester feedback.

### Genie Maps — new click model

Clicking a room now does different things depending on the mouse button:

- **Left-click a room** — pins the walk path on the map (a gold line from you to that room) so you can study the route before committing. Click it again to clear.
- **Right-click a room** — walks you there.
- **Left-click a cross-zone exit (↗)** — peek at the neighbouring zone without moving.
- **Right-click a cross-zone exit** — walk to the boundary.

The hover tooltip spells out which button does what.

### Genie Maps — smoother camera

- **The camera now glides** as you walk instead of snapping room to room. Big jumps (clicking ◆ from across the zone, switching zones, fit-to-view) still cut instantly — only the small step-to-step moves animate, so the camera never "races" across the screen.
- **The "you are here" marker no longer bounces.** It now stays locked dead-centre while the map slides beneath it.

### Genie Maps — new "you are here" indicator

The locator ring got a **sonar pulse** — expanding rings ripple outward from your position on a loop, so you can spot yourself at a glance. The solid ring stays crisp underneath so your exact room is never ambiguous. The ring itself is also a touch smaller than before.

### Genie Maps — bug fixes

- **The marker no longer gets stuck on the wrong zone.** Crossing certain boundaries (e.g. the Crossing ↔ Segoltha River) could leave your marker stranded in the zone you just left until you typed `look`. The room-matching logic now searches more thoroughly so the right room wins.
- **Clicking a cross-zone exit no longer zooms the map all the way out.** It now switches to the neighbouring zone centered on the matching entry room, keeping your zoom level.
- **The map toolbar no longer disappears** at smaller window sizes.
- **The follow camera is more reliable** — it can no longer get into a state where your marker is visible but the camera has stopped tracking it.
- Player-housing rooms now flicker with a warm hearth-glow aura, matching the "interesting room" treatment.

### Text window — smoother scrolling

- **Scrolling is smoother during heavy combat.** New text now slides the view into place instead of snapping, and several rendering optimizations cut the jerks and tearing that showed up during heavy bursts.
- **The map marker keeps up when you run fast.** Running quickly used to make the map indicator jump 2-3 rooms at a time; it now ticks through each room in turn for a smooth, streamed feel.

### Home / End keys

Reported by Binu — `Home` and `End` were scrolling the story window instead of editing your command box. Fixed:

- **`Home` / `End`** now move the cursor to the start / end of your typed command, like any normal text field.
- **`Ctrl+Home` / `Ctrl+End`** scroll the story window to the top / bottom.
- **`PageUp` / `PageDown`** scroll the story window by a page, unchanged.

## What's new in v0.6.7

Follow-up release to v0.6.6's Genie Maps rewrite. The big addition: every room category on the Genie Maps view now has its own visual signature. Shops glint with gold, healers pulse with a heartbeat, water rooms ripple, transports swirl, lumber rooms drop leaves, and so on. Plus two new status indicators we were missing (poisoned, diseased), command echo for everything you click on a panel, and several debug-panel quality-of-life fixes.

### Genie Maps — every room category now has its own animation

Every recognized room color on the Genie Maps view now has a unique visual signature, so you can recognize what kind of room you're looking at without checking the legend:

- **Shops (red)** — a gold dash slides around the room border, like light catching coins
- **Healers (mint)** — the room pulses in a lub-dub heartbeat rhythm
- **Water (blue)** — concentric ripples expand outward
- **Underwater (navy)** — white bubbles rise from the room and pop
- **Transport / Portal (fuchsia)** — three sparkles orbit the room in a vortex
- **Shrine (periwinkle)** — sparkles drift outward in all directions
- **Favor altar (purple)** — sparkles rise upward, like offerings
- **Stat training (yellow)** — sparkles rise faster, like effort
- **Guildleader (orange)** — gold particles rise from the room ("level up here")
- **Lumberjacking (green)** — green leaves drift down from the room with a slight wobble
- **Mining (sienna)** — rusty-brown dirt particles fall straight down
- **Ranger trailhead (sand)** — sandy tan dust falls — same animation as mining, different color
- **Obstacle (amber)** — slow on/off caution blink
- **Depart room (eggplant)** — rings shrink inward, somber finality
- **Interesting room (lime)** — the room's aura flickers like firelight
- **Player housing (aqua)** — stronger static aura ("this is special")

The mining rooms also get a small **pickaxe ⛏** glyph centered on the rect; lumber rooms get an **axe 🪓**. Both serve as the primary identifier; the falling particles are the embellishment.

### Map fixes

- **Hover tooltips no longer get clipped** when the map is in a narrow panel. The tooltip now shrinks its width to fit available space and flips to the other side of the cursor when it would overflow.
- **Room colors that use CSS color names now work correctly.** Some Genie XMLs use `color="Blue"` instead of `color="#0000FF"` — previously those rooms rendered as plain blue with no aura or ripple animation because the lookup keys were hex-only. Now normalized at parse time so any color name (`Blue`, `Red`, `Aqua`, `Lime`, `White`) gets the same treatment as its hex equivalent.
- **Map labels scaled down to 80% of your game font size** — they were dominating the visual hierarchy against the small 8×8 room rects. Still scale with your font setting if you change it.
- **Legend cleaned up** — "click to switch to the target zone" copy on cross-zone exits was stale; updated to reflect that clicking walks you to the boundary. New "Room glyphs" section shows the pickaxe and axe with their categories.

### Affliction indicator — poisoned and diseased

DragonRealms has sent `IconPOISONED` and `IconDISEASED` indicators for years, but Lichborne wasn't tracking them. Now it does:

- **New "Affliction" slot in the icon bar** — appears after the existing Bleeding/Stunned/Dead slot. Multiplexes **Poisoned** (priority) and **Diseased**.
- The slots are separate so a poisoned-AND-bleeding character sees both states simultaneously. Bleeding and poisoned need different cures and have different timers; one shouldn't hide the other.
- Theme-aware — poisoned reads as toxic green, diseased reads as sickly mustard yellow-green. Distinct hues so when one supersedes the other you can tell which is showing.

### All panel clicks now echo as `>cmd` in the game window

Clicking a room on the map, clicking an exit in the room panel, sending a quick-send command, clicking a command link in the text stream — all of these now echo as `>command` lines in your main game window, the same way commands you type do. Previously they were silent.

### Debug panel polish

- **No more auto-opening on disconnect.** The debug panel used to open itself whenever a connection drop wasn't perfectly clean — which happened on any Lich script that issued `exit` for you. The status banner ("Connection lost") already tells you what happened; you can click Debug yourself if you want to investigate.
- **Events tab now starts fresh.** Previously the Events count would show (500) the moment you opened the panel because events had been silently collecting in memory all along. Now the buffer only collects while the panel is open, and clears on close.

### Performance — smoother map interaction

- **Map animations pause while you drag the map** — dragging a dense zone (Crossing, Shard) used to feel sluggish because all the category animations kept running while the camera was being repositioned. They now pause the moment you start dragging and resume the instant you let go.
- **Map animations also pause during fast cross-zone walks** — running across half the map used to drop frames because every walk step triggered React reconciliation AND all category animations kept running on every visible room. Animations now pause whenever you've taken a walk step in the last 800ms, and resume the moment you stop. Cross-map runs are significantly smoother.
- **Genie map folder loads near-instantly after the first time** — initial Genie maps folder parse is multi-second (122 XML files, thousands of rooms). Lichborne now caches the parsed result to disk. On every subsequent launch — assuming you haven't edited or added/removed XML files in the folder — the map is ready in ~50ms instead of re-parsing from scratch. Cache invalidates automatically if any file in the folder changes.

### Smaller fixes

- The "Connecting to…" overlay was rendering behind the Add Character modal when you connected from inside that modal — fixed.

## What's new in v0.6.6

The map's graph view has been rebuilt again — this time around Genie XML as the spatial source of truth. The previous Lich-native auto-layout (v0.6.3) tried to derive room positions from each room's walk commands; it worked in open areas but produced visual hairballs in dense districts and routinely disagreed with the Genie maps team's hand-curated layouts ("type west, marker goes north"). The new view renders Genie XML directly at the coordinates the community has been refining for 20 years.

### Genie Maps — new graph view

- **Renamed from "Lich Graph" to "Genie Maps."** Point it at your Genie maps folder (button in the toolbar) and every zone loads. The dropdown lists every zone you have — Map 1: The Crossing, Map 67: Shard, Map 150: Fang Cove, and so on.
- **One zone at a time, no auto-layout.** Rooms render exactly where the Genie XML places them. No more "this cluster looks like a knot" — if it looks clean in Genie or Frostbite, it looks the same in Lichborne.
- **Room colors mean something.** Red = shop, lime = economic interest, fuchsia = transport, orange = guildleader, mint = auto-healer, yellow = stat training, blue = water, navy = underwater, sand = ranger trailhead, periwinkle = shrine, aqua = housing, eggplant = depart, purple = favor altar, and so on. The legend (▤ button) shows every color that appears in the current zone with its meaning.
- **Arc colors mean something too.** Gray = cardinal direction, amber = climb, orange = `go`-target rooms (doors, portals, up/down/out). Same legend.
- **Floating landmark labels.** Temple of Light, Stormwill Tower, Dira Buyer, Barber, Tables, Gift Shop — every label the Genie maps team has placed renders alongside the rooms.
- **Cross-zone exits marked with ↗.** Hover one and the tooltip tells you which zone it leads to (`↗ Cross-zone exit → Shard`). Click it and Lichborne walks you to the boundary room. The map switches to the new zone once you actually arrive — never before. If a door is locked or you run out of roundtime, the map stays put. No more "I clicked a path, the map jumped, and now I have no idea where I really am."
- **Click any room to walk there.** Path is computed from the Genie arc graph; commands fire one at a time at a 600ms cadence. Each move echoes in your game window so you can see exactly what was sent.
- **Hover preview.** Hover any room and a bright green line traces the path you'd walk if you clicked. Instantly answers "how far is that and how would I get there." Hover also shows a tooltip with the room's map ID, exits, color category, aliases, and the action you'd be taking.
- **Camera follows you while you walk.** As you move, the viewport re-centers smoothly so you're always in the middle of the canvas. Pan or zoom manually and the camera lets you stay where you put it — click ◆ to snap back to your position and re-enable follow.

### Performance & polish

- **Arc rendering rewritten for dense clusters.** Lines are drawn twice — once at full opacity beneath rooms (current behavior), once at faint opacity on top of rooms. The faint over-pass makes line paths visible through dense room clusters so you can trace exactly which room any arc connects to. In the old rendering, lines disappeared into rect fills inside a cluster and you'd have to guess.
- **Rapid walking no longer stutters.** The current-location indicator and selection outlines are now rendered as separate overlay elements; walking only updates those few elements instead of rebuilding the entire scene. On dense zones (Crossing, Shard) this drops Chromium's compositor cost dramatically — fast-paced movement is buttery.
- **Map labels follow your font size.** Set your font size in Settings and the map's room labels and floating landmark text scale with it.
- **Themed dropdown and floor selector.** The zone-picker dropdown and Z-level chips now match the rest of the panel's theme instead of falling back to OS defaults (which looked broken on dark themes).
- **Smarter "you are here" tracking.** When multiple rooms in a zone share the same title (Shard has 7 rooms titled "Shard, Moonstone Street"), Lichborne now uses your room description to disambiguate which one you're actually in. The marker tracks each step correctly instead of getting stuck on whichever was first in the file.
- **Better cross-zone matching.** Rooms whose Lich title differs from the Genie name only in case or brackets (Lich `[Bank]` vs Genie `Bank`) now match correctly via a normalized fallback lookup.
- **Map opens with your zone already loaded** if you open it while you're already connected. Previously it would sit empty until you clicked ◆ or picked a zone manually.

### Other improvements

- **All panel-sourced commands echo in the game window.** Walks from the map, exits clicked in the Room panel, Quick-Send entries, command links in game text — all of these now show up as `>command` lines in your text window the same way commands you type do.
- **Malformed XML files are now skipped silently.** If a Genie map file fails to parse, Lichborne logs it and moves on instead of treating it as an empty zone.

## What's new in v0.6.5

Polish pass on the Lich Graph view from v0.6.3 — adds a togglable legend that doubles as a control surface, lets the current-room indicator stop hiding the room's actual identity, fixes the zoomed-out glow domination, and adds search-by-room-ID.

### Lich Graph

- **Legend overlay (`▤` toggle).** A floating panel anchored top-left of the canvas with five sections: room-size tiers, state colors, edges, glyphs/backdrops, and Genie landmark types. Sample swatches use the same colors the canvas uses so theme switches keep them honest. Per-character — the legend remembers if you had it open.
- **Layer toggles inside the legend.** Six layers each get a checkbox: district tints, last-walked trail, landmark glyphs, vertical-exit ↑↓ glyphs, adjacent-room labels, and Genie-only dashed edges. Click any toggle row to flip that layer on or off. State persists per character. A `reset` button in the legend header returns everything to defaults.
- **Current-room indicator shows the room through itself.** Previously the green pulsing circle replaced the room's color and landmark glyph entirely — so standing in a shop just showed a green circle, no "$" or red. Now the current room renders as a colored rect (Genie color preserved, glyph overlaid) with the pulsing halo OUTSIDE and an optional accent dot inside. You can tell at a glance: "I'm in a shop, this is me, this room has an up exit" — all at once.
- **Zoomed-out glows stop dominating.** District tints and the last-walked trail were rendering at constant screen size, which meant zooming out had them swallowing the whole viewport while the actual nodes shrank to dots. They now scale with the map so they recede gracefully.
- **Search by room ID.** Typing a number into the search box (e.g. `766`) does an exact Lich room ID lookup. Title substring still works for text queries.
- **Outside-scope search feedback.** Picking a search result that's not in the current hop neighborhood used to silently do nothing. Now you get a brief notice above the bottom bar telling you the room was selected but is outside scope; raise hops or walk closer to see it on the map.
- **Auto-refit when Genie data arrives mid-session.** If you opened the Lich Graph view before Genie XML finished loading, rooms could fly off-screen once the seeded layout took over. The view now refits once when that transition happens.
- **`hops` selector remembers your choice.** The 5/8/15/25 hop scope dropdown now persists per character.

### Performance

- Mousemove no longer re-renders the whole graph view when you're not hovering anything.
- Zone tints and trail glows skip recompute on pan/zoom (only on actual data changes).

## What's new in v0.6.4

**Hotfix:** profiles are no longer destroyed by Lichborne upgrades, and the File → Open Profiles Folder menu works on fresh installs.

- **Profiles moved out of the install directory.** Pre-v0.6.4 stored them inside `<install-dir>\profiles\`, which the NSIS installer wiped on every upgrade (the previous version's uninstaller runs first, removing everything in the install folder, then the new build is extracted). Profiles now live in `%APPDATA%\lichborne\profiles\` — the standard userData location, untouched by installs and uninstalls.
- **Two-stage migration on upgrade.** The installer's pre-init hook reads the previous install location from the registry and copies `<install-dir>\profiles\*.yaml` (and `.bak` backups) into the new userData location BEFORE the old uninstaller runs, so a normal v0.6.3 → v0.6.4 upgrade rescues your data. A second runtime check on first launch catches any files left behind by non-installer paths (portable copies, manual placements). The old folder is left in place either way so you can verify before removing it manually.
- **"Open Profiles Folder" creates the folder if missing.** The File-menu entry now ensures the profiles directory exists on disk before opening it, so it works correctly on fresh installs that haven't written any profile yet (previously Windows showed a "cannot find" dialog).
- **If you already upgraded v0.6.2 → v0.6.3** before v0.6.4 existed, the v0.6.3 install wiped your old profiles before v0.6.4's rescue hook could run. That data is unrecoverable from Lichborne itself; you'll need to re-add your characters. Sorry. This is the bug v0.6.4 prevents from ever happening again.

## What's new in v0.6.3

The login flow has been completely redesigned around a character launcher and a 3-step Add Character wizard. The old "fill in this form every time" screen is gone. The map's graph view has been rebuilt from the ground up — Lich is now the spatial source of truth and Genie maps are an optional polish layer. Plus timestamped profile backups, schema versioning so future upgrades don't require wiping `profiles/`, a couple of long-standing scroll-key bugs squashed, and small polish across the board.

### Maps rewrite — Lich Graph

- **Lich Graph view** *(replaces the old Genie Graph)*. Renders every room in the local neighborhood (8 hops by default, selector for 5/8/15/25) using Lich's own walk commands as the spatial source of truth. No more "this room can't render because Genie doesn't have it." Walk into a brand-new tunnel and it appears immediately.
- **Optional Genie polish.** Point Lichborne at your Genie maps folder (📁 button in the Lich Graph toolbar) and the view lights up: rooms get district tints by zone, color-tagged rooms (shops, healers, stat trainers, transports, etc.) get a glyph icon overlay, connections Genie knows but Lich doesn't appear as dashed fallback lines, and tooltips gain Genie metadata. Without Genie everything still works — you just see the bare Lich graph.
- **Visual hierarchy.** The current room is a large pulsing circle with a label; rooms one hop away are full-size rounded rects with names above; rooms 2–3 hops are smaller and faded; distant rooms are background dots. Selecting or hovering a far room promotes it to a readable size temporarily.
- **Search any room, anywhere.** Type ≥2 characters in the search box and Lichborne matches across the entire Lich database, not just what's on screen. Click a result to recenter on it (if it's in scope) or just select it (if it's outside).
- **Last-walked trail.** The last 8 rooms you walked through fade into a breadcrumb glow so you can see where you just came from at a glance.
- **Hover an edge** to see the move command (`go gate`, `north`, etc.); Genie-only fallback edges are labeled `(Genie only)` so you can tell at a glance which connections Lich's walk database doesn't cover.
- **NEEDS MAPPING banner** when the game tells Lichborne you're in a room ID that isn't in the Lich map database. Useful for the community mapping effort.
- **Lich Map** (the image-tile view) is the renamed "Image" tab, since both views are Lich-first now.
- **Per-character hop preference.** Your Lich Graph hop selection (5/8/15/25) is saved per character and follows the rest of your YAML profile.
- **Zoom stops getting wiped.** Walking no longer fires a fit-to-view that resets your chosen zoom — pan/zoom stay where you put them.

### Profile schema versioning

- **YAML files now carry their own version.** Both `_shared.yaml` (v1) and `{Character}.yaml` (v2) declare a `profileVersion` field, and Lichborne consults a small migration registry on read. Future schema changes (renaming fields, restructuring) auto-upgrade your existing YAMLs on first launch instead of requiring you to wipe `profiles/`.
- **Future-version files are preserved, not clobbered.** If you ever downgrade Lichborne, a newer YAML stays untouched on disk rather than being overwritten with a shape the older version doesn't understand. Recovery path stays open.

### Login & character launcher

- **Character cards instead of a login form.** When you start Lichborne, you now see a Launcher: one card per saved character showing name, account, game, and connection mode (Lich/Direct). Click `[Connect →]` and you're in. No re-typing your account name every launch.
- **1.5-second cancel grace period.** Clicking a card shows a "Connecting to <name>… [Cancel]" overlay for a brief moment before any network call fires. Catches fat-finger clicks before they cost you anything.
- **Right-click → Delete.** Cards have a context menu for removing characters cleanly. The confirm dialog explains what's removed (the character's YAML and its backups) and what's kept (your saved password, since other characters may share the account).
- **3-step Add Character wizard.** New character setup is a guided flow: account + password + mode → game (DR / DRX / DRT / DRF) → pick character. For Direct connect, step 3 fetches your real character list from EAccess and shows it as a picker — no more typing the character name and hoping you got the capitalization right. For Lich connect, step 3 is a one-time text entry.
- **First-launch auto-detect.** On first launch, Lichborne silently checks `C:\Ruby4Lich5\` and pre-fills your Ruby and Lich paths. If your install is in the default location, the wizard's Lich radio is enabled out of the box — no setup tab visit required.
- **Lich Setup reachable any time.** A `⚙ Lich Setup` button now sits at the top of the Launcher and as a small link in the wizard footer. Verify or fix Ruby path, Lich path, delay, XML Stream Mode, and Hide Lich Window without disconnecting. The same fields also live in the in-session Settings panel.

### Lich Setup polish

- **"Mode" → "XML Stream Mode"** so it's clearer what the dropdown (`--stormfront`, `--genie`, `--wizard`, `--avalon`, `--frostbite`) actually controls.
- **Games List inventory.** Lich Setup now ends with a read-only "Games List" card showing each game code, full name, and conventional Lich port (DR=11024, DRX=11124, DRT=11624, DRF=11324). Per-character game choice happens in the wizard; this card is just so you can validate which ports map to which games.

### Profile backups now timestamped

- **Backups no longer overwrite each other.** Each clean shutdown writes a new `{name}.yaml.{timestamp}.bak` alongside the live YAML — the 5 most recent are kept, older ones are pruned automatically. Previously a single rolling `.bak` was overwritten every shutdown, so a corrupted save could destroy your last known-good backup. Now you have a history to recover from.

### Bug fixes

- **PageUp / PageDown / Home / End scroll the story window from the command bar.** These keys were silently ignored as long as the command input had focus (which is almost always). Now they work the way they always should have — scroll the story window unless another text field (like a highlight rule editor) has focus. *(B75, reported by Legiro)*
- **Scrollbar arrow buttons and thumb-drag now correctly pin and unpin.** Clicking the scrollbar's up/down arrow buttons or dragging the thumb up wasn't triggering scroll-pin behavior — only mouse wheel was. New lines would yank you back to the bottom even after you'd scrolled up to read older text. Fixed. *(B76, reported by Sekmeht)*

### Theme polish

- **Bold text is now yellow across every dark theme** (`<bold>` text such as monster names, bold combat lines) — matching the traditional Genie convention. Light themes (Ivory, Mist, Parchment) and Terminal are unchanged.

### File menu

- **"Open Installation Directory" added.** Sits below "Open Data Folder" in the File menu. Useful for tinkering with `profiles/` or reviewing the install layout. Data Folder still opens `userData` (`passwords.json`, Electron caches); Installation Directory opens the install root.

## What's new in v0.6.2

A multi-character UX polish pass. Tab indicators got a redesign, several small annoyances got fixed, and the Session Log design is now locked in for the next build cycle.

### Tab status indicators redesigned

The character tab bar's status icons are now a single, prioritized slot per tab. The top-priority active condition wins the slot — lower-priority ones are still active in the game, just not surfaced on the tab. Priority order:

1. **💀 Dead**
2. **💫 Stunned** *(new — was already tracked internally but never shown on the tab)*
3. **🩸 Bleeding**
4. **⏳ Roundtime** *(was the misfit ⚠ warning triangle; now a colored hourglass)*

**Health % is always visible** now — no more "skull replaces health" behavior. When dead, 💀 lives in the icon slot and the health % stays showing (naturally red at low values, which already communicates the death state).

**Disconnect dropped its dedicated icon.** A disconnected tab now reads simply as **dimmed + italic** with the last-known icon preserved. To reconnect, click the tab and use the existing Login button in the toolbar. The previous reconnect glyph (↺) was redundant with the dim styling.

**Tab width is now locked at character-add time.** Toggling any state (bleeding clearing, RT expiring, health dropping from 100% to 9%) no longer shifts the tab — fixed-width slots with tabular numerals keep everything pixel-stable. The only thing that varies tab width between tabs is the character name length.

### Window title bar now follows the active tab

Switching between character tabs now correctly updates the OS window title. Previously the title would stick on whichever character last triggered a connection-status event, so the title might still say "Agan" after you switched to Sekmeht's tab. Title is now centralized and re-applies on tab switch.

### Character names display in the server's canonical case

If you typed "sekmeht" lowercase at login but the server returns "Sekmeht," the tab bar now shows "Sekmeht." Previously the tab kept whatever case you typed regardless of what the server said.

### Tab status glyphs no longer cause layout shift

Toggling any indicator (bleeding starting/stopping, RT pulsing on/off) no longer changes the tab's width or shifts neighboring tabs. The glyph slots always reserve their space — they just don't paint when no condition is active.

### Exp panel default sort flipped to descending

On a fresh install, the Exp panel now defaults to descending sort (high-rank skills first), which is what most DR players expect from other clients. Once you toggle it, your choice persists.

### Ctrl+1..9 and Ctrl+Tab work from the command bar

The tab-switch hotkeys (Ctrl+1, Ctrl+2, … Ctrl+9 to jump to a tab by slot; Ctrl+Tab to cycle) were previously blocked whenever the command bar was focused — which is basically always during play. They now work regardless of where focus is. Ctrl+Shift+Enter (Quick-Send) was already correctly unguarded.

### Login button on a disconnected tab now opens the login UI

If you have multiple characters open and one is disconnected, clicking "Login" in its toolbar used to close the tab and dump you on whatever other tab was active — with no way to actually re-login. Now closing the tab also opens the Add Character form so you can re-add that character (or any other) immediately. If it was your only tab, the full Login screen appears as before.

### Smaller polish

- Per-character `localStorage` is now correctly cleaned up when you close the last tab and start over.

### Looking ahead — Session Log spec locked

The full design for the upcoming **Session Log** feature is now captured in DESIGN.md §28 and the Release E2 checklist. It will write per-character daily log files in plain text (one file per day per character, `[timestamp][stream] text` format) that you can open in any external editor. An in-client modal will provide tactical lookups — Recent Tail for "what just happened," Quick Search for "when did X occur," and an Open Logs Folder button to jump straight to the files in your OS. Build starts after v0.6.2 ships.

## What's new in v0.6.1

A post-v0.6.0 polish pass focused on multi-character bugs and the profile-save system. Nothing visible has changed for single-character users — every fix shores up something that only manifested once you started running multiple characters in one Lichborne instance.

### Map options now persist across sessions

The graph view's label mode, Image/Graph view choice, Z-level filter, and color-legend toggle are now stored per-character. Set them once, they're remembered the next time you log that character in.

### Multi-character polish

- **Reconnecting a character no longer freezes the tab UI.** If you got server-dropped and clicked **+** to log the same character back in, the tab would visually freeze even though commands still worked behind the scenes. Game events for the new session were being silently filtered out by an event listener that had captured the *old* session id. Fixed.
- **Adding a character no longer overwrites the active character's title bar.** Clicking **+** with an existing character connected used to flip the OS window title from `Sekmeht · DR [Connected]` to `DR [Not connected]` until the login modal closed. The modal now keeps its hands off the title.
- **Quick-Send won't silently drop commands to disconnected characters anymore.** Disconnected entries in the target dropdown are now greyed out and unselectable, and the default target skips them. If you have only disconnected tabs, the form shows "No connected characters" instead of accepting a no-op send.
- **Closing a disconnected tab is now instant.** Previously the close path queued a phantom 5-second graceful-disconnect against a dead socket — harmless but odd. Fixed.
- **Attempting to log a second character on the same SimuCo account is now blocked clearly.** DragonRealms only allows one active character per account; before, you'd get a cryptic "Invalid login key" error from the server (and possibly kick your first session). Lichborne now refuses the second login at the form with a clear message: *"Sekmeht is already connected on account FOO. Disconnect them first."* If somehow the server-side error slips through, it gets translated into the same hint.

### Theme and settings now follow the active tab

When you have two characters with different themes (or different fonts, vitals-bar position, etc.), switching between their tabs now correctly re-applies that tab's saved settings to the DOM. Previously the visible CSS was just "whoever changed a setting last wins" until you toggled something on the new tab.

### Profile saves are now crash-resilient

A new internal pattern (`useProfileSaver` hook) is wired into every per-character setting toggle. The result: changes you make — panel layout, exp panel sort, map label mode, stream timestamps, etc. — schedule a YAML save immediately rather than waiting for some other event to trigger one. Even a hard app kill within the 2.5-second debounce window won't lose changes. (And graceful shutdown still does a defense-in-depth final save of every active character regardless.)

### Smaller fixes

- Auto-copy on text selection now fires only once per mouseup, not once per mounted tab. Cosmetic only — clipboard contents were identical — but cleaner.

### Profile format note

The v0.6.0 → v0.6.1 upgrade does **not** include automatic profile migration. If you're upgrading from a v0.5.x or earlier YAML (typed `settings:` / `layout:` / `automations:` shape), delete `profiles/{Character}.yaml` before launching v0.6.1. Lichborne will re-create a clean v2 file on your next login and your in-game state (highlights, triggers, contacts, etc.) will need to be re-entered from scratch. v0.6.0 → v0.6.1 is a no-op (same v2 format).

## What's new in v0.6.0

### Run multiple characters in one Lichborne

Lichborne now manages multiple characters in a single running app — each in its own tab, with no more juggling separate exe instances and no more cross-character profile collisions.

- **Character tab bar** — every connected character gets a tab showing name, game code, live health % (color-coded by threshold), and status glyphs: 🩸 bleeding, ⚠ roundtime active, 💀 dead.
- **Click to switch, instantly** — switching tabs is zero-cost. Every tab stays mounted in the background, so vitals, scroll position, panel layout, and game text are all exactly where you left them. No remount flash.
- **Disconnected tabs stay informative** — dim with an ↺ reconnect marker, but last-known health and glyphs are preserved. You can see at a glance that "Sekmeht 51% 🩸 ↺" is in trouble even while AFK.
- **Add a character with `+`** — opens the standard login form as a modal. The first character on a fresh launch still shows the full login screen.
- **Close a tab with `×`** — gracefully QUITs that character; other tabs unaffected.

### Quick-Send — Ctrl+Shift+Enter

A floating command input that targets any character without switching tabs. Tell your Empath to heal your main, ask your alt to grab a gem — Quick-Send defaults to the next character after your active one, sends on Enter, cancels on Esc.

### Keyboard shortcuts

- **Ctrl+1** through **Ctrl+9** — jump to a tab by slot.
- **Ctrl+Tab** — cycle to the next tab.
- **Ctrl+Shift+Enter** — open Quick-Send.

Macros, mode hotkeys, and PageUp/Down/Home/End now correctly route only to the active tab — pressing F1 in your main's tab won't fire your alt's macros.

### Profile system rewritten

The way per-character settings round-trip to `{Character}.yaml` was rebuilt from scratch.

- **Per-character isolation** — highlights, triggers, contacts, panel layout, exp settings, automations, themes — each character's data is fully isolated. Editing in one tab no longer leaks to another.
- **Backup on graceful shutdown** — every time you close the app cleanly, your live `{Character}.yaml` and `_shared.yaml` are copied alongside as `.yaml.bak`. If the live file is ever corrupted, rename the `.bak` to recover your last known-good state.
- **Atomic writes** — profiles now write to a `.tmp` file and rename in place. A crash mid-save can no longer leave you with a half-written, unparseable YAML.
- **Race-safe concurrent saves** — two characters editing settings at the same time each have their own debounced save timer; one's save never clobbers the other's.

### Migration to profile v2

Profiles are now `profileVersion: 2`. Existing YAMLs are upgraded automatically the first time each character logs in — no manual steps. The new file shape collapses everything previously nested under `settings:` / `layout:` / `automations:` / `contacts:` into a flat `state:` map; values are identical, just reorganized. Adding new per-character features no longer requires editing the profile system in three places — anything the client writes to a character-scoped key now flows into the YAML automatically.

### Polish

- Window title bar reflects only the active character, not whichever tab most recently received game text.
- Tab status updates skip when nothing has actually changed, so vital ticks that don't move your health % don't redraw the bar.

## What's new in v0.5.1

### Exp panel — learning rate bars and guild badging

- **Learning rate bars** — a thin progress bar now appears below each skill row showing how fast you are learning. The bar fills from 0 to 100% based on your current mindstate (0–34). Color indicates intensity: green for low (absorbing–cogitating), amber for mid (considering–pondering), orange for high (ruminating–crystallizing), and red for locked (34/34).
- **Fraction display** — each skill now shows `(X/34)` at the end of the row, matching the native game format you already know from `>exp` output (e.g. `understanding (14/34)`).
- **Bar colors are themeable** — the four bar colors (`--exp-bar-low`, `--exp-bar-mid`, `--exp-bar-high`, `--exp-bar-locked`) are CSS custom properties. They are set in the base dark theme and all themes inherit them; custom themes can override them per-theme.
- **Guild badging and focus filter** — select your guild from the badging picker to overlay P / S / T / G badges on each skill name showing its skillset priority. With a guild selected, the focus mode filter can narrow the Learning section to only Primary, Secondary, or Tertiary skills.
- **Exp panel settings persist to your character YAML** — badging selection, pinned skills, sort mode, sort direction, and focus filter are now saved to your `CharacterName.yaml` profile and restored on next login.

### Map — graph view auto-centers on login

- **Map no longer loads off-center** — the graph view now automatically centers on your current room when it first loads. Previously the view would come up at the wrong position and require a manual click of the ◆ button to snap to your location. The fit effect now fires the moment the SVG canvas is ready rather than waiting for a zone change.

### Bug fixes

- **Exp panel sort defaulted to Z-A on fresh install** — the sort direction was read with `!== 'asc'`, which evaluates `true` when nothing is stored (null). Changed to `=== 'desc'` so an absent key correctly defaults to ascending (A-Z), matching other DR clients.
- **Badging selection not saving to YAML** — changing your guild in the exp panel wrote to localStorage but did not trigger a profile save. The YAML would only update on disconnect. Fixed: guild changes now schedule an immediate debounced profile write.
- **Skill pins not saving to YAML** — same issue as above for pinning individual skills. Fixed: pin toggles now also schedule a profile write.

## What's new in v0.5.0

### Lich Dashboard — deep read access to your Lich installation

- **Variables tab** — browse every Lich variable in scope (`global`, `server`, `char`, and others) directly from the client. Includes decoded Ruby types: symbols, arrays, hashes, booleans, and Time values all display in readable form.
- **Settings tab** — view your current `lich_settings` values pulled directly from Lich's SQLite database.
- **Sessions tab** — see every active Lich session with PID, character name, game code, role, frontend type, and start time. Active sessions (heartbeat within the last 30 seconds) are highlighted.
- **Profiles tab — YAML profile editor** — view and edit your Lich character profile files (`.yaml` scripts in the profiles folder) directly from Lichborne. Features include:
  - Full YAML syntax highlighting using highlight.js with VS Code dark+ palette (comments, keys, strings, numbers all color-coded distinctly)
  - Line number gutter synchronized with the editor scroll
  - Inline YAML validator — click **Validate** to check for syntax errors; errors report the exact line number
  - `combat_teaching_skill` quick-edit field for fast skill swaps without touching the raw YAML
  - **Review & Save** diff view — before committing any change, a side-by-side diff highlights exactly which lines were added or removed; changed hunks shown in context with a "Show all lines" toggle to see the complete file
  - Live sessions lock the profile selector row while an edit is in progress so you can't switch files mid-edit

### Bug fixes

- **Ruby Time values now display correctly** — variables containing Ruby `Time` objects (e.g. `repair_timer_snap`) were showing garbled binary characters. The Marshal decoder now correctly reads the little-endian 8-byte Time format and renders a clean `YYYY-MM-DD HH:MM:SS` timestamp.
- **Sessions tab columns corrected** — the Sessions tab was failing with a SQLite column error due to mismatched column names. Fixed to match the actual `session_summary_state` schema (`session_name`, `game_code`, `last_heartbeat_at` as integer seconds).
- **Health and exp output no longer runs off screen** — lines inside `<output class="mono"/>` blocks (the `>health` wound list, `>exp` output, etc.) were displayed with `white-space: pre`, which suppresses all wrapping. Long wound descriptions ran off the right edge of the panel. Fixed: changed to `white-space: pre-wrap` so column spacing is preserved while lines still wrap at the panel boundary. (Thanks Legiro for the report.)

## What's new in v0.4.0

### Active Scripts Panel — see what Lich is running

- **New "Lich Scripts" panel** — add it via the Panel Manager to see every script currently running under Lich. Refreshes every 5 seconds automatically, or hit the ↻ button to poll immediately.
- **Script status at a glance** — each row shows whether a script is running (green), paused (amber), or being killed (red), along with an uptime counter and a badge (`C` for custom scripts you own, `▶` for Lich core scripts).
- **Pause, resume, and kill from the panel** — buttons act immediately. Kill requires an inline "Kill? Yes / No" confirmation so you don't accidentally stop the wrong script.
- **Transient restarts don't flicker** — scripts that kill and restart themselves quickly (like T2 spawning buff) stay visible in the panel across the restart cycle rather than disappearing and reappearing.
- **Killed scripts disappear cleanly** — after confirming a kill, the script shows "killing" status and is removed from the panel as soon as the next poll confirms it is gone. It no longer briefly re-appeared as "running" while the linger window counted down.
- **Newest scripts at the top** — the list is sorted by start time descending, so the script you most recently launched is always at the top.

### Script Palette — quick-launch bar in the toolbar

- **Configurable command buttons** — a strip of compact buttons appears in the toolbar when configured. Each button sends a command (e.g. `;t2`, `;buff`, `;tend`) with a single click. Hidden when empty. Palette saved per-session in localStorage.

### IPC pipeline improvements (under the hood)

- **Faster event delivery** — all game events from a single TCP read are now batched into one IPC call instead of one call per line. Login bursts that previously sent 40–60 rapid IPC calls now send one.
- **Raw XML panel overhead eliminated** — the raw XML channel is only active when the Debug panel is open. No serialization cost during normal play.
- **Unknown tag events no longer cross the IPC boundary** — unrecognized Lich-injected XML tags are filtered in the main process before being sent to the renderer.

## What's new in v0.3.2

### Injuries panel — wounds now display correctly

- **Injuries panel now shows your wounds** — the panel was showing "No active wounds." even when you had wounds. The game sends `height="0" width="0"` on all body-part elements regardless of injury status; the actual wound signal is the `name` attribute (`Injury1`, `Injury2`, `Injury3` for light/moderate/severe, or the part name when healthy). The wound detector was checking height/width and always returning zero. Fixed — injuries display and color-code correctly by severity.

### Login — remember your password

- **Password saved per account** — a "Remember password" checkbox on the login screen saves your password encrypted with Windows DPAPI (`safeStorage`). When you type an account name that has a saved password, the field fills automatically. The password is only saved after a successful connection, and cleared if you uncheck the box.

### Themes — improved contrast and full CSS var coverage

- **Text is easier to read across all themes** — several darkBase color values were too close to their backgrounds: `--text-dim`, `--text-faint`, `--compass-center-text`, `--hand-label-color`, `--room-section-color`, `--exp-rate-color`, and map muted text. The `--border-faint` value was literally identical to `--bg-base` (#1a1a1a), making structural borders invisible. All lifted to legible values. The `classic` theme compass inactive and center text were near-invisible on their near-black background and have been corrected.
- **All guild themes** have their map muted-text color raised to approximately 3:1 contrast on the respective map background (was as low as 1.6:1 in some themes).
- **Bold text is now yellow across all dark themes** — `<bold>` text (monster names, bold combat lines) now renders as bright yellow (#ffff00) in all dark themes (Dark, Darker, Classic, and all guild themes), matching the traditional Genie experience. Light themes (Ivory, Mist, Parchment) and Terminal are unchanged.
- **Hardcoded colors removed from CSS** — injury severity colors, the exp footer sting/sleep indicators, the debug active button, scroll-anchor badge states, disconnect/login button states, and the update banner are all now driven by CSS custom properties and `color-mix()`, so they respond correctly to every theme including light themes (Ivory, Mist, Parchment) and custom themes.

### Parser — bold state no longer bleeds across sessions

- **Yellow text after Lich script output fixed** — if a Lich script sent text containing a literal `<` (e.g. `health: 60 < 65`) wrapped in `<pushBold/>`, the tokenizer would misparse `< 65<popBold/>` as a single malformed tag and silently swallow the closing `<popBold/>`. This left `boldDepth` stuck at 1 for the rest of the session, making all subsequent text appear bold — which the dark theme renders yellow. Fix: `boldDepth` is now reset to 0 at each `<prompt>` boundary. Prompts are frame boundaries in the DR protocol and bold cannot legitimately survive one.
- **Style state no longer carries into a new session** — `parser.reset()` is now called when initiating a new login, so a stuck `boldDepth`, orphaned color stack, or any other parser state from the previous session cannot bleed into the new one.

### Login — Lich settings sync to second windows

- **Advanced settings no longer reset to defaults in new windows** — Lich path, Ruby path, port, and other advanced fields now write to the shared profile YAML whenever you change them on the login screen, not just after a successful connection. A second window opening concurrently reads the YAML and picks up your current settings instead of falling back to defaults.

### Import wizard — Wrayth strings row no longer duplicated

- **Duplicate "Substitution rules" row removed from Wrayth import** — the Wrayth parser was setting both `stringsCount` (shown as "Wrayth strings") and `substitutionCount` (shown as "Substitution rules") from the same `<strings>` block data, producing two rows for the same content in the Step 3 summary. The spurious `substitutionCount` assignment has been removed; only the "Wrayth strings" row appears now.

## What's new in v0.3.1

### Map — room matching fixes

- **Map now follows you reliably** — room matching completely reworked. The client extracts your Lich room ID directly from the game subtitle and does a direct lookup, so the current room indicator lights up correctly even in areas where multiple rooms share the same name (like "Abandoned Road")
- **Genie graph matching improved** — Genie nodes that were showing as unmatched orphans despite being mapped in Lich (like "Bulk Materials" in Leth Deriel) now match correctly. The matcher tries the full zone-qualified title as a fallback when the short name alone doesn't match
- **Better mismatch messages** — when a room can't be found in the Lich map, the banner now says "Lich #NNNN not in map" when the game sent a room ID, so you know the room exists but isn't mapped yet

### Map — graph view improvements

- **Cross-zone exits in the detail panel** — rooms with a ◆ diamond now show which zone they connect to. Click the exit command (e.g. `go meeting portal`) to walk there, or click the zone name to browse that zone in the graph without walking
- **Detail panel stays current as you move** — once you open the detail panel by clicking a room, it follows you as you move rather than staying locked on the room you first clicked
- **Cleaner detail panel** — room name is no longer buried in the full zone-qualified title; zone shows as a small badge beside it. Genie coordinates moved to a tooltip on the room ID. "You are here" indicator sits inline in the header
- **◆ Recenter works from any zone** — if you've browsed to a different zone and press ◆, it now switches back to your actual zone and centers on you rather than jumping to the wrong position
- **↺ Reload button** — reloads the Lich map database on demand. Useful after Lich maps a new room — no restart needed
- **Auto-reload on map download** — when `repository.lic` downloads a new map database, Lichborne detects it and reloads automatically

### Map — bug fixes

- **Mouse wheel zoom fixed** — scroll wheel now works in the Graph view immediately after the panel loads
- **Map controls no longer break zoom** — clicking the fit, zoom, center, or floor buttons no longer disrupts mouse wheel zoom
- **Single center button** — the duplicate ◆ Re-center button in the Graph toolbar has been removed

## How to install

1. Download `Lichborne-0.8.0-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.7.1...v0.8.0
