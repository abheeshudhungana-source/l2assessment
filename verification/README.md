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
  10 messages. Run with `node compute_before_after.cjs`. **This is fully
  deterministic and gives the exact same output every time, regardless of
  when you run it** — it does not call `Date` at all. It deliberately omits
  the old scorer's weekend/after-hours penalty, which is why it's safe to
  omit: this is the script behind the README/PR's main before/after table.

- **`compute_before_after_v2.cjs`** — same idea, but reproduces the old
  scorer with full fidelity, including the weekend/after-hours penalty.
  It reports each message's level under three conditions. Two of them are
  fixed, hardcoded day/hour values (`weekday/9-17` = Monday 2pm,
  `weekend/off-hours` = Sunday 2am) passed as parameters, **not read from
  the system clock — these two columns are also deterministic and will
  match this file's output on any machine, any day.** The third column,
  `now`, *does* read the real system clock via `new Date()` and will differ
  depending on when you run it — it's printed for context only and isn't
  what the README/PR cite as evidence; the time-sensitivity claim in both
  rests on the two fixed columns, not on `now`. Run with
  `node compute_before_after_v2.cjs`. This is what found that rows #2, #4,
  #7, and #8 differ between the two fixed conditions — see the main
  README's "Known limitation" sections for the full writeup. Note the
  weekend/off-hours penalties are applied categorically in the original
  code (any Saturday or Sunday; any hour before 9 or after 17 triggers the
  same flat penalty, not a graduated one), so the single `Sunday 2am` test
  point generalizes to the whole weekend/off-hours category — it was not
  separately checked against every other weekend day or off-hour.

Both `.cjs` scripts are plain Node and need nothing installed beyond Node
itself; anyone can clone this repo and re-run them to check the numbers,
on any day, with no setup beyond having Node installed.
