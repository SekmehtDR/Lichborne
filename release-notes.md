## What's new in v0.11.4

### Fixes

- **Main window no longer clips the bottom line at larger fonts.** At font size 13 and up, the last line could slip partly under the vitals bar — and the bigger your font, the more got cut off. The text window now keeps the final line fully clear of the vitals bar at every font size. Changing your font size also no longer kicks you out of "follow" mode (no more stray "new lines" badge popping up as if you'd scrolled away). *(Thanks, Rakkor.)*

---

## What's new in v0.11.3

### Smarter highlight overlaps

When two highlights cover the same text, Lichborne now keeps the **most specific** one for each part — a highlight on a single word shows through a broader highlight on a whole phrase, instead of one hiding the other. Color, background, bold, and glow can even come from *different* overlapping highlights at once (so a word's color can sit on a phrase's background). The upshot: you don't have to fuss with the order of your highlights to get the right one to win — it just works. (This is how the Profanity client handles highlights.)
