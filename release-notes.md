## v0.17.0 — Moons weather & Elanthian calendar + a themed About + combat-scene polish

### The Moons experience — a living sky 🌙

The **Moons** experience (open it from the **Experiences** shelf, or add it as a panel tab) grew into a full celestial scene — weather, the Elanthian calendar, and a sky that actually behaves like a sky:

- **The sky follows the sun.** Daylight is now brightest *around the sun*, warming to gold as it nears the horizon; the glow lingers through **dusk** after it sets and returns before **dawn**. The **sun and moons sink behind the horizon** and disappear while set, then crest back up — and an **at-a-glance panel** above the footer shows every body's next rise/set the whole time. The **landscape itself is lit by day and falls into shadow at night**, the shade sweeping in from the side away from where the sun is rising or setting.
- **The moons look like moons.** Each is **lit from the sun's direction** (a bright side and a shadowed side) and glows in its own colour — ruby/crimson **Yavash**, vivid ice-blue **Xibar** with a silvery-white shine, and soot-dark **Katamba** wreathed in an **ominous violet haze** by day. They also stack by real depth when they overlap.
- **A living landscape below the horizon** 🌲 — a little wilderness now sits under the sky: a distant forest, foreground trees, a winding **stream** and a **lake** that **reflects the sun and moons**. It has real **depth** (nearer things larger), lights and darkens with the day, and **dresses itself by season** — snow-capped trees and an iced-over lake in winter, blossoms in spring, lush green in summer, autumn colours and **falling leaves** in fall. Toggle it under the scene's ⚙ ("Trees & water").
- **Sunrise & sunset rays** fan across the landscape — warm light beams at dawn, long shadows at dusk — and now the **trees cast shadows that follow the sun**, swinging from straight-back at midday to long diagonals near sunset.
- **A deepening night sky** ✨ — the stars now **fill in as the night gets darker**: the brightest appear at dusk, and fainter ones keep emerging the closer it gets to **midnight** (like light pollution clearing), thinning again toward dawn. **Shooting stars** streak from all across a clear sky (clouds hide them, as they should). And the whole scene now **moves smoothly** — the sun, moons, their shadows, the rays and the lake reflections all drift together instead of a jerky redraw.
- **Time of day on the sky** — a bold **DAY / NIGHT / DAWN / DUSK** word, with the finer Elanthian daypart on its own line once you've checked the time.
- **Weather & date** — a **⟳** button silently checks the sky (`WEATHER` and `TIME` go out behind the scenes — nothing clutters your game window) and shows the weather in plain words plus a real date like *4 Ka'len the Sea Drake · 457 A.V. · ❄️ winter*. Weather also updates whenever you naturally glance at the sky; indoors it tells you to step outside.
- **Live weather in the sky** — drifting clouds, wind-slanted snow and rain, a hazy horizon, the odd flicker of lightning; snow settles on the ground and ridgelines in winter. Weather draws over everything else in the sky. All respect your epilepsy-safe setting.
- **Make it yours.** The scene's **⚙ "Show in this scene"** now toggles every layer — sun, sun glow, rays, living sky, moon glow, sun-lit moons, the at-a-glance panel, seasonal touches, weather, and more. (The per-body name and countdown labels are **off by default** now that the panel shows them, but you can switch them back on.)

Everything you type yourself still shows normally — only the ⟳ button is quiet.

### A proper About dialog 💛🎵

**Help → About Lichborne** is now an in-app page that follows your theme, instead of a plain system box. It carries a short note about why Lichborne exists, credits everyone who's helped build and test it, and has quick links to the **GitHub** repo and our **Discord**. And there's a little **music toggle** — muted by default; click the speaker for a tune (it stops when you close the window). Thank you all.

### Living Tableau (beta) — combat scene polish ⚔️

Lots of refinement to the combat scene added last release:

- **Fits its space** — figures now scale to the panel/tab instead of overflowing a small one, the balance/position gauges sit pinned at the bottom where they can't clip, and you always stand clear at the front.
- **The ASSESS arena keeps up with the fight** — creatures you've felled linger as marked **corpses** until they decay instead of vanishing, a killed creature no longer lingers as a "threat," and retreating to a new room no longer drags the old room's creatures along.
- **Calmer by default** — a harmless bystander is no longer flagged as a threat, and the balance/position gauges **fade out** once the fight is over instead of lingering.
- **Thoughts moved out of the way** — telepathic thoughts now collect in a quiet **bottom-left log** (newest at the bottom, older ones fading up) so they never cover the scene.

### Windowed Panels — nicer window chrome

Floating-panel title bars are slimmer and softer (a subtle gradient and hairline instead of a hard grey block), the show/hide-name button is a quiet chevron that appears on hover, and the header no longer jumps height when you toggle the name. All theme-aware.

### Also in this release

- **Command bar trimmed** so it isn't oversized next to the slim chrome, with the roundtime/cast/aim timer strips kept clear of the text cursor.
- **Launcher top-bar buttons centred**, and a small compact-vitals text-centring fix.
- **Re-verified against Lich 5.19.1.** No changes needed. One heads-up: **Lich 5.19.0 specifically** had a bug that could show raw protocol text instead of the game — that's fixed in **5.19.1**, so if you see garbage, update Lich to 5.19.1 or later.
