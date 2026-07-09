## What's new in v0.15.1

### New — Moons [Beta], the second Lichborne Experience

- **Elanthia's sky, as a living dial.** Open **Experiences → Moons** and the three moons — dark **Katamba**, ember-red **Yavash**, pale-blue **Xibar** — arc across a drawn sky, each positioned by how much of its transit remains. Moons that are up show **"sets in 88m"**; moons below the horizon wait dimmed underneath with **"rises in 152m"**. The countdowns tick in real time, and a small footer always tells you how fresh the data is.
- **A real sun in a sky that lives.** A golden sun rides the same arc as the moons all day and waits below the horizon at night, with its own rise/set countdowns — positioned from the same community data moonwatch uses, plus the game's own sunrise/sunset announcements as they happen. The whole sky follows: bright at midday, warm sunrise and sunset glows at the horizon, deepening night with stars that fade in through twilight and wink out before dawn. Anything about to rise or set breathes gentle horizon rings (expanding for a rise, drawing inward for a set) — and all motion respects your epilepsy-safe setting.
- **Powered by the community moonwatch script.** The moon feed comes from **moonwatch** (crowd-sourced by players across Elanthia): run `;moonwatch window` on any Lich character and the sky lights up on its next report. Until then, the window explains exactly what to do.
- **A sky with a sense of place.** A mountain silhouette lines the horizon; moons that set travel a shallow underground path back to where they'll rise (nothing ever just vanishes); anything about to rise or set breathes gentle horizon rings; and **hovering any body tells its story** — Katamba burnt by the World Dragon's breath, Yavash's celestial fire, Xibar's pristine ice — along with the clock time it next rises or sets. The footer tracks the next event and always shows how fresh the data is.
- Like the Living Tableau, it has hover **A− / A+** text sizing and a **⚙ "Show in this scene"** menu — the sun, the living sky, countdowns, name labels, the silhouette, and the rise/set effects each toggle independently and are remembered per window. It's marked **[Beta]**, costs nothing until you open it, and all motion respects the epilepsy-safe setting. Weather itself is the planned next layer. *(Requested and art-directed by Sekmeht.)*

### Experiences can now live as panel tabs

- **Save the screen space.** Every panel's **+** button now lists the Lichborne Experiences below a separator, each marked with an **[e]** badge — add Moons (or the Living Tableau) as a tab right beside your Thoughts and Combat panels instead of a separate floating window. The tab itself wears the **[e]** too, so the Moons *Experience* never gets mistaken for the moonwatch script's "Moons" text stream. Works in both Static and Windowed layouts, the panel's own A− / A+ sizes it, your ⚙ scene choices carry over, and the tab travels with your layout like any other.

---

## What's new in v0.15.0

### The platform release

- **Lichborne's engine jumped two years forward.** The app now runs on Electron 43 (Chromium 150 / Node 24) — up from a version that had aged out of security support. That means all the browser-engine security patches from the last two years, plus the performance work that came with them. No features changed in this release; if anything *feels* different (font rendering, scrolling, window behavior), please report it — that's exactly what this release is shaking out.
- **A smaller installer.** A packaging cleanup stopped shipping several libraries twice, so the download and install footprint shrink with no change in behavior.
- **Better Windows taskbar behavior.** Lichborne now registers its own app identity with Windows, so pinning it to the taskbar and any notifications group correctly under Lichborne instead of a generic Electron entry.
- **For the curious:** your profiles, settings, logs, and automations are completely untouched by this upgrade — it's the same app on a newer engine.

---
