## What's new in v0.13.1

### More room, and a better-behaved theme

- **Slimmer stream-label tabs.** The little tab bars that label each panel's streams (Thoughts, Room, Conversation, …) were taller than they needed to be — on a stacked layout that adds up to real lost space. They're now noticeably slimmer, reclaiming vertical room for the text that matters. Applies to both Static and Windowed Panels. *(Thanks to TheTargonian for the nudge.)*

- **The map now follows your theme.** Previously, picking a theme changed the map, but *editing* a theme — or importing one from another client — left the map stuck on its old colors. Now the map's background, labels, and chrome track your theme's App Background and Game Text on every theme, and update live while you're editing in the Theme Editor. The directional path lines and the green "you-are-here" marker stay their own colors so they're always easy to read. *(Thanks to Binu and Sekmeht for tracking it down.)*

- **Compact vitals text is centered.** In the compact vitals bar, the readout ("M: 100%") sat a touch high instead of dead-center. Fixed. *(Thanks to Sekmeht.)*

- **The Lich Scripts panel stops polling when it's closed.** Lichborne refreshes its running-scripts list by quietly asking Lich every few seconds — but it was doing that for every connected character even when you weren't looking at the scripts panel, which could occasionally interfere with Lich scripts like the automapper. Now it only refreshes while a Lich Scripts panel is actually open; closed means completely silent. *(Thanks to Binu.)*

- **Tidier Lich Scripts panel.** The "Active Scripts" heading and the status strip at the bottom were oversized; both are now tight strips that match the size and feel of the other panels. *(Thanks to Sekmeht.)*

---

## What's new in v0.13.0

### Windowed Panels — float your whole layout

- **A brand-new way to arrange the client: Windowed Panels.** Open **Panels** and hit **Switch to Windowed Panels**, and your entire layout pops free into floating windows you can drag, resize, and arrange however you like. Your classic docked setup is now called **Static Panels** — nothing changes there unless you opt in, and you can switch back any time.

- **Everything decouples.** Not just the side panels — the **main game text, the command/input bar, the vitals bar, and the status (icon) bar** all become independent windows. Put the input bar wherever you want it. Float vitals across the top. Stack your thought/death/arrival panels anywhere. It's your screen.

- **Magnetic snapping.** Drag a window near a screen edge or another window and it **snaps flush**, with a guide line showing where it'll land — so you can hand-build a clean tiled layout in seconds. Hold **Alt** while dragging to place freely without snapping, and use **arrow keys** to nudge the focused window a pixel at a time.

- **Unlimited windows.** Add as many panel windows as you want from the Panel Manager's **Add Window** list, and re-add any bar you've closed (so the command bar can never be lost). Each window has a title bar you can rename, hide (for a compact look), or close.

- **Lock Windows.** Once your layout is just right, tick **Lock windows** to prevent accidental dragging or resizing.

- **It's yours and it's saved.** Windowed layouts are per-character, persist across launches, and travel with **Profile Transfer**. The Panel Manager keeps things tidy — it shows the Static-Panel zone tools in panel mode and the windowed controls in windowed mode, so you only ever see what's relevant.

> Streams (Thoughts, Room, Experience, Conversations, …) work exactly as before — they're just the *content* you place inside panels, whether those panels are static or windowed.
