## What's new in v0.9.0

The Lich **Variables** view is now editable — add, change, and delete your Lich variables right from Lichborne, no `;vars setup` window required. This is the in-app replacement for the `;vars setup` script, which (as several testers found) disconnects Lich when you interact with its pop-up.

### Edit Lich variables in-app

Open **Lich Dashboard → Variables** while connected via Lich and viewing your own character. You can now:

- **Add a variable** — the row at the top takes a name and a value. (Names can't contain spaces; a value of `true` or `false` is stored as a real boolean, matching Lich.)
- **Edit a value** — click the **✎** on any text variable for an inline editor (Enter saves, Esc cancels).
- **Delete a variable** — click the **✕**, then **Delete?** to confirm (two-click so you can't remove a var by accident).

Edits go through Lich's own variable system and are saved to disk immediately, so the change sticks right away — reflected on the next refresh and after reopening. The toolbar now shows a **"refreshed HH:MM:SS"** stamp so you know how current the view is, and the footer explains the persistence model (your edits save immediately; Lich's own auto-save for changes made by scripts runs every ~5 minutes).

A few guardrails, by design:
- Editing is only available for the **connected character's own variables**. You can still *view* any character's variables via the scope dropdown, but those stay read-only (Lich only lets us safely change the variables of the session we're attached to).
- Complex variables (lists, hashes, timestamps) keep their structured, expandable display and can be deleted, but aren't inline-editable — same scope as the old `;vars setup` window.

### Why `;vars setup` disconnects Lich (and what to do instead)

If you ran `;vars setup`, saw the window open, and then got disconnected the moment you tried to add a variable — that's a bug in the Lich `vars.lic` script, not in Lichborne. The script spawns a background thread that touches its GTK window from off the main thread, which is unsafe and crashes Lich under our launch (and any Stormfront-mode launch). Lichborne sees Lich's process exit and reports a disconnect.

Use the in-app **Variables** editor above instead — it does everything `;vars setup` does without the GTK window. The script's non-window commands (`;vars set NAME=VALUE`, `;vars delete NAME`, `;vars list`) also work fine if you prefer the command line.

### Heads-up when a Lich script uses a GTK window

GTK-window scripts (like `kill-counter` or `vars setup`) are unreliable in any Stormfront-mode front-end — some never paint their window, some crash Lich when you interact with it. To save you a confusing silent failure or disconnect, Lichborne now checks scripts as you start them: if a script's source uses GTK, you'll see a one-time bold advisory in the game window —

> **--- Lichborne: GTK code detected in script "kill-counter". GTK windows are not fully supported in this client and may cause Lich to disconnect.**

It's just a heads-up — the command still runs. It fires once per script per session and reports the real script name even if you typed an abbreviation (e.g. `;kill-cou`). The script's non-GTK functions are unaffected; only the GTK window is the problem.

### Fixed: Lichborne→Lichborne import preview showed triggers with no commands

When importing an automations export from another character, the preview list showed your imported triggers as having no commands — even though they did. This was a display-only bug in the preview (the actual import always brought the triggers in correctly), now fixed so the preview shows each trigger's commands.

---

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
