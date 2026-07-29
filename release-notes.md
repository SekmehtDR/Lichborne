## v0.18.1 — Tighter windows, calmer coins 🪟🪙

A fast follow-up to v0.18.0, built entirely out of your first week of reports. Thank you — every item below came from someone hitting it and telling us.

### Windowed Panels stop wasting space

If you use **Windowed Panels**, you've been losing more room than you realised. Every floating window reserved a strip at the top for its title bar, so even windows snapped perfectly edge-to-edge left a visible gap between their *contents*. TheTargonian counted six of those gaps in his layout — close to half a window of game text.

Two changes fix it properly:

- **The drag handle now sits *over* your content instead of taking a slice of it.** It reserves nothing, so what you arrange is exactly what you get. It stays quiet until you hover the window.
- **Locking your layout hides it entirely** — and drops the window shadow and softens the border — so locked Windowed Panels finally read like docked panels.

*Heads-up:* vitals, status and command bars you saved before this update still carry the old title allowance, so they load a touch taller than they need to be. Resizing is now WYSIWYG, so dragging the bottom edge up once fixes it for good — or use the new **Fit bars to content** button in the Panel Manager to snap all of them at once. (It never moves windows you've placed — only their heights — so a neighbour below may end up with a small gap or overlap to drag closed.)

### Fixed: the Genie map ignored your theme until it finished loading

On a light theme the map canvas sat **dark brown** while it loaded, and while it waited for game data — then snapped to the right colour the moment a zone appeared. The loading veil was a fixed dark colour that never followed the theme. It does now, along with several other map details that were stuck on dark-theme colours: the stop button, the legend's swatches, and the room-id badges.

*Still to do:* a handful of map surfaces (the error overlay, the room detail panel) are still on fixed dark colours and will look out of place on light themes. They're on the list.

### SimuCoins: setup in Settings, one click to collect

The coin popover was doing two jobs, and it fell over for anyone with more than a couple of accounts — JadedSoul's list made it taller than the screen, impossible to scroll, and clicking inside it shoved the *entire client* out of view until you clicked something else. That last part was nastier than it looked, and it's fixed at the root.

So the two jobs are now split:

- **Settings → SimuCoins** is where you set things up: which accounts are watched, Auto-claim, each account's current status, and the full explanation of exactly what gets sent — sitting right above the switch that does it.
- **The coin** in the top bar is just the payoff. It lights up when coins are waiting, and one click **collects them from every watched account at once**. It's now the same size whether you have one account or twenty.

Nothing about your privacy changed: still nothing sent until you enable an account, still your own saved password to Simutronics' own store over HTTPS, still no store data on disk, still checked once per launch and never in a background loop.

### Lich Dashboard fixes

- **Fixed: you couldn't edit Lich scripts at all.** The **Edit** button on the Scripts tab has been permanently greyed out since v0.18.0, insisting "this file couldn't be read" about scripts that had loaded perfectly. Nobody reported it — it turned up in a bug sweep. Editing works again.

- **It no longer loses your place after saving.** Search for a line, edit the file, save — and the view returns to the line you found instead of stranding you somewhere else.
- **The Scripts editor's find box** said "Search YAML…" while you were editing Ruby. It doesn't any more.
- Validation banners are slimmer — they were rendering taller than their own text.

### Also

- **Fixed: resizing a very small floating window snapped it bigger.** Dragging a window's *side* could jump its *height* — most visible on a compact vitals bar, which is smaller than the normal minimum size. Resizing now only constrains the edge you're actually dragging.

### macOS: "damaged and can't be opened" 🍎

Our first Mac tester couldn't open Lichborne at all — macOS said **"Lichborne is damaged and can't be opened. You should move it to the Trash."**

**Nothing was damaged.** That's how Apple Silicon words "this app isn't notarized by Apple," and our own instructions were wrong: we told you to expect a friendly "unidentified developer" prompt with an **Open Anyway** button. That button doesn't appear for this one.

Two things changed. The app is now **ad-hoc signed**, which Apple Silicon requires before it will run anything at all. And the instructions everywhere now lead with the step that actually works:

```bash
xattr -cr /Applications/Lichborne.app
```

Run that once after dragging Lichborne to Applications and it opens normally from then on. (If macOS offers **System Settings → Privacy & Security → Open Anyway** instead, that works too.)

The real cure is Apple's $99/yr certificate, which a free project isn't buying yet — if Mac interest keeps up, we'll revisit it.

### Credits

**Zithri** joins the contributors list for that report — first Mac tester, first Mac bug, day one. The name pills in **Help → About Lichborne** also sit properly centred now.

### Notes

- **Still chasing one:** Sekmeht reported a search highlight sitting about half a line off after validating and saving a YAML. The surrounding code is hardened in this build — the editor's measurements now re-check themselves whenever anything about its layout changes — but we could not reproduce the offset itself, so it may not be gone. If you see it, please shout, and a screenshot with the validation banner visible would help a lot.
- Windows, Linux and Mac behaviour is otherwise unchanged from v0.18.0.
