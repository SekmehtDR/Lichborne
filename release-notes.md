## v0.18.6 — A guard on the quit 🛑

A small, tester-driven release.

### Closing with several characters up now asks first

Closing the main window quits Lichborne and logs out everything — which is what
it's meant to do, but it's also one stray click away from dropping several
characters at once, losing position and roundtime along with them.

If **two or more** characters are connected, you now get a confirmation that
**names them**, so you can see exactly what you're about to log out — including
the alt you'd forgotten was still on.

- One character (or none) still closes straight away — no extra click for the
  ordinary case.
- Disconnected tabs don't count. Only characters actually logged in.
- It covers every way of quitting: the ✕, Cmd/Ctrl+Q, File → Quit, and the
  taskbar.
- Cancel is the default, so a reflexive Enter or Esc never ends your session.
- Closing a separate character window asks the same way, and reminds you that
  **Window → Move Character to Main Window** keeps that character running.

Installing an update still quits without asking twice — you already said yes.

### SimuCoins now show your balance

Lichborne already read your balance during every check and then threw it away,
so the coin could only ever tell you whether something was claimable. Now it
tells you what you have.

- **Settings → SimuCoins** shows each account's balance and when it was last
  checked, under its status.
- **The coin popover** adds one line summarising the total across your accounts.
  It stays the same size whether you have two accounts or twelve.
- **It survives restarts** — previously the balance lived only in memory, so
  reopening Lichborne showed "Not checked yet" until the next check finished.

Every balance is shown with its age, always, so a figure from three days ago
says so. If a check fails, the last known balance stays put with its real age
rather than vanishing or pretending to be fresh. Nothing extra is sent to the
store — this is the same once-per-launch check, just no longer discarding what
it already learned.

### Fixes

- **A theme you picked no longer reverts after restarting.** Choosing a theme
  applied it immediately but never wrote it to your character's profile, so the
  next launch quietly restored the old one. It only happened when the theme was
  the *only* thing you changed that session, which is why it was so easy to
  miss.
- **A one-shot trigger no longer comes back armed.** A trigger set to fire once
  disabled itself correctly, but the change wasn't saved to your profile — so
  after a restart it was ready to fire a second time.
