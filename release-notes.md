## v0.18.0 — Lichborne comes to Linux and macOS 🐧🍎

The headline: **Lichborne now runs on Windows, Linux, and macOS.** Windows stays the fully-supported platform you know; Linux and Mac arrive as **betas** — everything works, they're just new, and we'd love your reports.

### Linux (beta)

- Download the **`.AppImage`**, make it executable (`chmod +x`), and run — works on any modern distro.
- **Auto-update works** on Linux just like Windows.
- Lich setup: install Lich per the [official wiki](https://github.com/elanthia-online/lich-5/wiki/Documentation-for-Installing-and-Upgrading-Lich) (Lich in `~/Lich5`, Ruby 4.0+ via rbenv or your distro) and Lichborne's **Auto Detect** will find it. Heads-up for Fedora: the system Ruby is 3.x and current Lich requires **Ruby 4.0+** — Lichborne now warns you about this right in the setup dialog.
- If "Remember password" is greyed out, your desktop has no keyring service (GNOME Keyring / KWallet) — install one, or just type the password each session.

### macOS (beta, Apple Silicon)

- Download the **`.dmg`**, drag to Applications. **First launch:** macOS will say the app is from an unidentified developer — go to **System Settings → Privacy & Security → "Open Anyway"** (one time only).
- **Why the warning?** Apple charges $99/year for the certificate that removes it. Lichborne is a free project with a small tester pool, so for now we ship unsigned — the app is safe and the source is public. If enough Mac players show up, we'll revisit the certificate.
- **Updates on Mac are manual for now** (auto-update requires that same certificate) — grab new versions from this Releases page.
- Mac conventions work: **Cmd+F** search, **Cmd+1–9** character switching, **Cmd+Shift+Enter** Quick Send (Ctrl versions still work too). Your Cmd+C/V/X are never touched.
- Lich setup: the wiki's Mac install (`~/Desktop/Lich5`, rbenv Ruby) is auto-detected. The first Auto Detect will ask permission to look at your Desktop folder — that's macOS asking, and it's only so we can find Lich there.

### Claim your free SimuCoins without leaving the client 🪙

Simutronics gives subscribers **free SimuCoins every month — but you have to claim them**, and they're easy to forget. Lichborne can now do it for you.

- Click the **coin** in the top bar to enable it for an account. It signs in to store.play.net with your saved password, checks your balance, and tells you if coins are waiting.
- Coins available? The coin lights up as **polished gold with a shine sweeping across it** and shows the count — one click claims them. Nothing waiting? It sits there dull and quiet. Prefer hands-off? Flip on **Auto-claim** per account. (Epilepsy-safe mode keeps the gold and drops the shimmer.)
- Nothing to claim? The coin stays quiet, and if you've never enabled it, **it doesn't appear at all.**
- Also available as `/simucoin`, `/simucoin check`, and `/simucoin claim` (or just `/sc`).

**On your privacy:** nothing is sent anywhere until you enable it for an account, and the popover tells you exactly what happens before you do. Lichborne signs in to Simutronics' own store over HTTPS with the account password you already saved, reads your balance, and signs out — no store data is kept on disk, and it's checked once when you start the client (never in a background loop). Thanks to Thires, whose Genie SimuCoins plugin showed how this works.

### A fresh look ✨

- **The launcher wears the Lichborne logo now** — the artwork sits alongside "DragonRealms Client" and your version at the top of the character screen.
- **Favorites collapses.** Click the Favorites header to fold it away (it stays open by default, and remembers your choice).
- **A consistent look across the client's windows.** The About Lichborne styling — the accent header band, rounded corners, chip-style tabs — now runs through the **Automations** window (and every one of its tabs), **Contacts**, and **Edit Profile**, with the character launcher's account sections restyled to match. More windows will follow.
- **Fixed a light-theme annoyance:** text fields in those windows were white-on-white on Classic Light, so they looked like empty outlines. They have a proper fill now.

### You can see what connecting is actually doing

- **The connect screen now narrates itself** — "signing in to your account", "starting Lich", "waiting for Lich on port 11024" — instead of an anonymous spinner. If Lich takes more than about 10 seconds it tells you what's usually wrong (Ruby/Lich paths, or antivirus) rather than just counting.
- **Bulk Connect shows progress** — which character it's on, how many are left, and a progress bar — and the result window now leads with the outcome ("Connected 2, 1 failed") with a clear list of anything that didn't connect.
- All the connect, conflict, and confirmation windows got the same styling as the rest of the client, and the connecting card **no longer jitters** as its status text changes.

### Quick Send goes to everyone by default

Quick Send (`Ctrl+Shift+Enter`) used to target one character — the next one after your active tab. Now it opens with **All characters** ticked, so telling the whole team to do something is one keystroke and Enter. Untick All and pick exactly who you want; the footer always tells you where it's about to go. With only one character connected there's no picker at all — it just sends to them.

### Smoother, and some rules that never worked now do

- **Highlights and triggers that never fired now fire.** If a rule's pattern contained a `.` (very common — anything using `.+`, like `joins the .+`), an internal optimisation could silently skip it: no error, the rule looked enabled, it just never matched. That's fixed. **If you have highlights or triggers you gave up on, try them again.**
- **The client no longer freezes when you search your logs.** Searching, listing streams, or building an export used to lock up *every* connected character for a few seconds on a big log history. Those now run in slices, so the game keeps flowing.
- **Triggers that write to a log file** no longer stutter the client when they fire often — those writes are batched now.
- **Mutes and substitutes got roughly 9× cheaper per line**, which matters most if you imported a big set from Genie or Frostbite.
- **The Genie map keeps up with you now.** Every step you took was secretly re-drawing every room marker on the map — in a big zone that's over a thousand of them, and it cost more than half a frame each time. Moving and dragging around the map are both markedly smoother, most of all in dense town zones.
- **Walking around town is smoother** if you use Contacts — updating "last seen" no longer forces the whole screen to re-evaluate every highlight.

### For everyone

- **Lich Dashboard:** line numbers in the **Scripts** editor now stay lined up with the code all the way down (wide Ruby scripts used to drift them out of alignment).
- Lich path auto-discovery is smarter on every platform, and the setup dialog now warns if your Ruby is too old for current Lich (5.18+ needs Ruby 4.0).
- Releases are now built and published from GitHub's own build machines — same installers, more reliable pipeline, and it's what makes the three platforms possible.

### Notes

- Windows behavior is unchanged in this release — same installer, same auto-update, same everything.
- Linux/Mac testers: please report anything odd in Discord — you're the first wave, and reports are what graduate these builds out of beta.
