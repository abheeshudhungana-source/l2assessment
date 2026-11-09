# Verification scripts

These are the scripts used to produce the before/after urgency table and the
time-sensitivity finding in the main README and PR #1. They're included here
so the claims are independently reproducible, not just asserted.

- **`test_messages.cjs`** — the 10 literal test messages, with comments
  explaining why each was chosen, driven through the live app via Playwright
  (requires a running dev server at the URL hardcoded in the script; update
  it to match your `npm run dev` port before running).

- **`compute_before_after.cjs`** — pure Node, no dependencies, no running
  app required. Reproduces the pre-fix and post-fix `calculateUrgency`
  functions directly from the commit diff and runs both against the same
  10 messages. Run with `node compute_before_after.cjs`. This version omits
  the old scorer's weekend/after-hours penalty (noted in its own comment),
  since it predates the time-sensitivity check below.

- **`compute_before_after_v2.cjs`** — same idea, but reproduces the old
  scorer with full fidelity, including the weekend/after-hours penalty
  (`new Date()`-based), and reports each message's level under three
  conditions: right now, weekday/business-hours, and weekend/off-hours.
  Run with `node compute_before_after_v2.cjs`. This is what found that
  rows #2, #4, #7, and #8 are time-sensitive — see the main README's
  "Known limitation" sections for the full writeup.

Both `.cjs` scripts are plain Node and need nothing installed beyond Node
itself; anyone can clone this repo and re-run them to check the numbers.
