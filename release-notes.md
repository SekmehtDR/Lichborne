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

1. Download `Lichborne-0.6.3-setup.exe` below
2. Run the installer — installs to your user profile, no admin rights needed
3. Windows may show a SmartScreen warning. Click **More info** → **Run anyway**

## Known limitations

- Windows only (x64)
- No code signing — SmartScreen warning on first install is expected

## Full Changelog

https://github.com/SekmehtDR/Lichborne/compare/v0.6.2...v0.6.3
