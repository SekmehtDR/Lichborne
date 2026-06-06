## What's new in v0.11.5

### A cleaner, more usable Debug panel

The Debug panel (Fires / Events / Raw XML) got a full look-and-feel pass:

- **Columns line up properly now** across all three tabs, and rows have subtle striping so they're easy to read across.
- **No more washed-out, see-through rows** — surfaces are solid and theme-correct on light themes too.
- **The Goto control is now a clear "Edit →" button** that's always visible and easy to click, jumping straight to the rule in Automations.
- **Drag the top edge to resize the panel** — it opens taller by default and remembers your size per character, so you can give yourself room to scroll back through events and fire history.

---

## What's new in v0.11.4

### Fixes

- **Main window no longer clips the bottom line at larger fonts.** At font size 13 and up, the last line could slip partly under the vitals bar — and the bigger your font, the more got cut off. The text window now keeps the final line fully clear of the vitals bar at every font size. Changing your font size also no longer kicks you out of "follow" mode (no more stray "new lines" badge popping up as if you'd scrolled away). *(Thanks, Rakkor.)*
