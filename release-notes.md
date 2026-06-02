## What's new in v0.9.1

This release reworks how Lichborne launches Lich so that **Ruby/GTK script windows now work** — scripts like `kill-counter` and `;vars setup` that pop up their own window. Lichborne previously launched Lich in a way that made those windows unreliable (some never painted, some crashed Lich on interaction), and v0.9.0 added a warning about them. The real fix was the launch itself.

### GTK script windows should now work

Lichborne now starts Lich as a normal Windows GUI process (using `rubyw.exe`, the windowless Ruby interpreter, the same way Frostbite and Genie launch Lich) instead of as a hidden console process. That gives Ruby/GTK the process context their windows need to paint and stay interactive.

- Nothing to configure — Lichborne automatically uses `rubyw.exe` from your existing Ruby folder (it falls back to your configured `ruby.exe` if `rubyw.exe` isn't there). Your Lich/Ruby paths in Settings don't need to change.
- The connection itself is unchanged — same port, same login, same multi-character and bulk-connect behavior.
- **Please test your GTK scripts** (`;vars setup`, `kill-counter`, etc.) and report anything that still misbehaves — with this launch change it's now a real bug worth looking into, not an expected limitation.

If a launch ever fails, Lich's startup output is now saved to a log file at `…\lichborne\Logs\lich-launch\<Character>.log`, which makes diagnosing a bad Ruby/Lich path easier.

### Removed: the GTK-script warning

The one-time "GTK code detected in script…" advisory added in v0.9.0 is gone — it existed only because GTK windows didn't work, and now that they should, the warning is no longer needed. (The in-app **Lich Dashboard → Variables** editor remains the recommended replacement for `;vars setup` regardless.)

---

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

### Fixed: Lichborne→Lichborne import preview showed triggers with no commands

When importing an automations export from another character, the preview list showed your imported triggers as having no commands — even though they did. This was a display-only bug in the preview (the actual import always brought the triggers in correctly), now fixed so the preview shows each trigger's commands.
