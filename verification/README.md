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
  fixed, hardcoded day/hour values — `weekday/9:00-17:59` (Monday 2pm,
  inside the actual no-penalty window: the code penalizes
  `getHours() < 9 || getHours() > 17`, so hour 17 itself, i.e. 5:00-5:59pm,
  is still penalty-free) and `weekend/off-hours` (Sunday 2am) — passed as
  parameters, not read from the system clock. These two columns are
  deterministic and will match this file's output on any machine, any day.
  The third column, `now`, does read the real system clock via `new Date()`
  and will differ depending on when you run it. It's printed for context
  only. It isn't what the README/PR cite as evidence; the time-sensitivity
  claim in both rests on the two fixed columns, not on `now`. Run with
  `node compute_before_after_v2.cjs`. This is what found that rows #2, #4,
  #7, and #8 differ between the two fixed conditions — see the main
  README's "Known limitation" sections for the full writeup. The
  weekend/off-hours penalties are applied categorically in the original
  code for these four rows: any Saturday or Sunday, and any hour before 9
  or after 17, triggers the same flat penalty, not a graduated one. So the
  `Sunday 2am` test point — which applies *both* penalties at once —
  generalizes to the whole weekend/off-hours category for these four rows.
  See `check_time_combinations.cjs` below for the check that confirms this,
  including each penalty in isolation.

- **`check_time_combinations.cjs`** — also pure Node, also fully
  deterministic (same hardcoded-parameter approach as `v2`, no `Date`
  calls). Checks the 4 time-sensitive rows (#2, #4, #7, #8) under all 4
  combinations separately: weekday/business-hours (baseline), weekday/
  off-hours only, weekend/business-hours only, and weekend/off-hours
  combined. Confirms that **either penalty alone is already enough** to
  drop each of these 4 rows one level — the combined condition doesn't
  cause any additional drop beyond what one penalty alone causes. Run with
  `node check_time_combinations.cjs`.

All three `.cjs` compute scripts are plain Node and need nothing installed
beyond Node itself; anyone can clone this repo and re-run them to check the
numbers, on any day, with no setup beyond having Node installed.
(`test_messages.cjs` is the exception — it needs Playwright and a running
dev server, as noted above.)
