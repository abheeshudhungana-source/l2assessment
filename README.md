# Customer Inbox Triage App

## Overview

The Customer Inbox Triage app is a lightweight AI-powered tool that helps classify customer support messages and recommend actions. It uses Groq AI to categorize messages, applies rule-based urgency scoring, and suggests next steps based on predefined templates.

## Problem Statement

Support teams waste time manually reading and triaging customer messages. This tool provides an automated first pass at classification to help prioritize and route messages more efficiently.

## Tech Stack

- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Groq API (Llama 3.3 70B - Free tier)
- **Runtime**: Browser-based (local development only)

## Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Groq API key (FREE - get from https://console.groq.com)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd "L2 assessment"
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Groq API Key**
   
   Create a `.env.local` file in the root directory:
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add your Groq API key:
   ```
   VITE_GROQ_API_KEY=gsk_your-actual-key-here
   ```
   
   Get your FREE API key from: https://console.groq.com/keys
   
   **Why Groq?** Groq offers a generous free tier with fast inference and no credit card required!

4. **Run the application**
   ```bash
   npm run dev
   ```
   
   The app will be available at `http://localhost:5173`

## How It Works

1. **Paste Message**: User pastes a customer support message into the text area
2. **Analyze**: Click "Analyze Message" to process the input
3. **Classification**: The app runs three processes in parallel:
   - **Category Classification** (LLM): Uses Groq AI (Llama 3.3 70B) to categorize the message
   - **Urgency Scoring** (Rule-based): Applies simple rules to determine urgency
   - **Recommendation** (Template-based): Maps category to a recommended action
4. **Display Results**: Shows category, urgency tag, recommended action, and AI reasoning
5. **History**: All analyses are saved to localStorage and viewable in the History tab


## Example Test Messages

Try analyzing these messages to see how the triage system works:

### Example 1: Production Issue
```
Our production server is down
```

### Example 2: Customer Feedback
```
Hi there! I just wanted to say thank you for your amazing customer service. I've been using your product for three years now and I'm really happy with it. Keep up the great work!
```

### Example 3: Feature Request
```
I would love to see a dark mode option in the app. It would be much easier on my eyes during night time usage.
```

### Example 4: Payment Issue
```
I tried to update my payment method but the page keeps loading forever. Is this a known issue?
```

### Example 5: Billing Question
```
Can I upgrade my subscription to the pro plan?
```

### Example 6: Technical Support
```
The dashboard won't load when I try to access it. I've tried refreshing but it keeps timing out.
```

## Assessment Notes: Issues Found, Fixes, and Limitations

As part of a technical assessment, the app was tested with 10 real-world customer
messages and found to have three significant issues, two of which were fixed here
(see PR [#1](https://github.com/abheeshudhungana-source/l2assessment/pull/1) for
the full diff and commit history).

### 1. Blank-screen crash with no API key configured

`llmHelper.js` built the Groq client eagerly at module load. The SDK throws
synchronously when the key is missing or empty, which crashed the whole React app
before anything could render — a totally blank page on a clean clone, in CI, or in
a demo, with nothing printed to the console. **Fixed**: the client is now built
lazily and only when a key is present, so every failure mode (no key, bad key,
network error, API error) falls through the same `try/catch` to the existing
keyword-based mock categorizer.

### 2. Urgency scoring was backwards on real incidents

The original scorer keyed almost entirely on message *style* — length, ALL CAPS,
`?`, even weekday/hour — instead of *content*. Full before/after on all 10 test
messages, computed by extracting the actual old and new `calculateUrgency`
functions into a standalone script ([`verification/compute_before_after.cjs`](verification/compute_before_after.cjs),
reproducible with `node verification/compute_before_after.cjs`) and running them directly against each
message's text (not driven through the live app via Playwright, and not
recalled from memory). **Computed Monday, Nov 9, 2026, ~14:44 ET** (a weekday,
inside normal business hours):

| # | Message | Before | After | Changed? |
|---|---|---|---|---|
| 1 | "SERVER IS DOWN" | Low | **High** | yes |
| 2 | "OUR CHECKOUT IS BROKEN!!! WE ARE LOSING SALES RIGHT NOW" | High | High | no |
| 3 | "...charged my card twice...fraud..." (polite tone) | Low | **High** | yes |
| 4 | "It would be great if you could add dark mode...Thanks!" | Medium | **Low** | yes |
| 5 | "Just wanted to say thank you...excellent...love the product!" | Low | Low | no |
| 6 | "How do I reset my password?" | Low | Low | no |
| 7 | "I'd like to cancel my subscription...higher than expected" | Medium | Medium | no |
| 8 | Long, mostly-positive message, one mild "slow" complaint | High | **Medium** | yes |
| 9 | "Site down now" | Low | **High** | yes |
| 10 | "Is anyone else seeing a 500 error on checkout?...blocking customers." | Low | **Medium** | yes |

**6 of 10 messages changed urgency level.** The 3 that moved *up* to High (#1,
#3, #9) are genuine incidents the old scorer buried as Low. The one that moved
*down* from High (#8) was a false positive — a calm, mostly-positive message.
#4 and #10 moved to more appropriate levels given their actual content. (An
earlier version of this table incorrectly listed #7 as Low→Medium; it was
actually Medium→Medium, i.e. unchanged — corrected here after recomputing
directly from the scoring code rather than relying on an earlier summary.)

**The "Before" column is time-sensitive and this table reflects one specific
moment.** The old scorer's weekend/after-hours penalties (`-20` on Saturday/
Sunday, `-15` outside 9am–5pm, both based on `new Date()` at the moment it
runs) mean its score for a given message can change depending on when it's
computed, even though the message text never changes. Checked directly with
[`verification/compute_before_after_v2.cjs`](verification/compute_before_after_v2.cjs)
(reproducible with `node verification/compute_before_after_v2.cjs`): of
these 10 messages, **#2, #4, #7, and #8 would score differently** if this
table had been computed on a weekend or outside business hours instead —
specifically, each would drop one level (#2 High→Medium, #4 Medium→Low, #7
Medium→Low, #8 High→Medium) under those conditions. Checked with
[`verification/check_time_combinations.cjs`](verification/check_time_combinations.cjs)
against all 4 time conditions separately (not just the combined weekend+
off-hours case): **either the weekend penalty alone or the off-hours
penalty alone is already enough** to cause the one-level drop for all 4
rows. The combined condition causes no additional drop beyond either
penalty alone. For these four rows, this generalizes across the whole
weekend/off-hours category, not just the specific Sunday 2am point tested,
because the original code applies each penalty as a flat `-20`/`-15`, not
a graduated one — any Saturday or Sunday triggers the same weekend penalty,
and any hour before 9am or after 5:59pm triggers the same off-hours
penalty. #7 in
particular — shown
above as unchanged (Medium→Medium) — would actually look like a Medium→Low
*improvement* if this table had been run on a weekend instead of a Monday
afternoon. The new scorer has no time dependency at all (verified by reading
`calculateUrgency` — it never references `Date`), so the **"After" column is
stable regardless of when it's computed**; only "Before" moves.

**Fixed**: rewrote the scorer as tiered/gated logic — an actual severity signal
(outage, fraud, security, data loss, explicit urgency language) now forces
**High** regardless of tone, length, or punctuation; milder signals (bug, slow,
frustrated, shouting, 2+ exclamation marks) lift a message to **Medium**; the
old style-based penalties (caps lowering urgency, `?` lowering urgency,
weekend/after-hours lowering urgency) were removed entirely, since none of them
say anything about how serious the customer's actual problem is.

### 3. Recommendation logic ignored urgency and had a copy-paste bug

`templates.js` mapped `"Feature Request"` to the billing-portal message (copy-paste
bug), `getRecommendedAction(category, urgency)` silently dropped the `urgency`
argument it was already given, and a `shouldEscalate()` function existed but was
never called anywhere in the app. **Fixed**: corrected the mapping, made
recommendations urgency-aware (a High-urgency Billing/Technical issue now gets an
explicit escalate-to-human instruction), and wired `shouldEscalate` into
`AnalyzePage` with a visible escalation banner.

### Known limitation: naive keyword gating can false-positive on negation

The urgency scorer (and the mock categorizer it falls back to) match on raw
substrings, with no negation handling. A message like **"no outage, thanks!"**
or **"glad that's not a security issue"** would still match `outage` / `security`
and get flagged **High**, even though the customer is explicitly saying the
opposite. This wasn't in the original 10 test messages, so it slipped through
re-testing, but it's a real gap worth calling out rather than overstating the
fix's robustness. Out of scope for this pass; the fix would be a short
negation-window check (e.g. don't count a critical-signal match if a negation
word like "no"/"not"/"isn't" appears within a few words before it) before
scoring. Flagging as a known issue rather than a blocking one, since
false-positive-High is a much safer failure mode for a support-triage tool than
false-negative-Low.

### Known limitation: critical-signal matching is substring-based, not word-boundary

The same keyword matching also triggers on substrings inside unrelated words,
since it's a plain `.includes()` check rather than a word-boundary match.
Verified by extracting `CRITICAL_SIGNALS` and running the match logic
directly against each example (not through the live app's UI): **"Can you
help me download the invoice?"** matches `down` and gets flagged High; **"Is
this legally binding?"** and **"illegal"** match `legal`; **"I love the new
security camera app"** matches `security`. Same root cause as the negation
issue above (no linguistic structure, just substrings) and the same fix
direction — switch to word-boundary regex matching (e.g. `\bdown\b`) for the
short, common words in `CRITICAL_SIGNALS` (`down`, `legal`, `security`,
`asap`) that are most prone to this. Not fixed in this pass; listed here as
a known issue.

The duplicate-charge check (`reportsDuplicateCharge`) has the same
substring-matching problem, not the negation problem above — it's a loose
"charge" + "double"/"twice" check, not a misread negation. Verified the same
way, by extracting `reportsDuplicateCharge` and running it directly: **"Can
you double-check the charge on my account?"** returns `true`, even though
nothing fraudulent is being reported.

### Known limitation: some real incidents without a critical keyword land at Medium, not High

Not every genuine incident uses one of the words in `CRITICAL_SIGNALS`.
**"Is anyone else seeing a 500 error on checkout? This is blocking
customers."** (test message #10) only matches `error` and `blocking` —
both `MODERATE_SIGNALS`, not critical ones — so it scores **Medium**, even
though "blocking customers" during checkout is arguably something a support
team should see immediately. This is the mirror image of the other
limitations above: those over-flag (false High), this one plausibly
under-flags a real issue to Medium instead of High. Not fixed in this pass;
a reasonable next step is promoting phrases like "blocking customers" into
`CRITICAL_SIGNALS`, though that risks reintroducing more substring
false-positives (see above) and would need its own before/after check.

### Known limitation: escalation prefix can produce an odd-sounding instruction

`getRecommendedAction` prepends the escalation guidance to the *existing*
category template rather than replacing it, so a High-urgency Technical
Problem produces: **"Escalate immediately to on-call engineering (possible
outage) - suggest user to restart their browser."** — a real example,
verified by running it through the live app. The escalation framing and the
generic self-serve tip underneath don't make sense together. Not a
correctness bug in the urgency/escalation logic itself, but a rough edge in
the combined wording worth fixing by giving High-urgency categories a
standalone message instead of a prefix+base concatenation.

### Verification

- `npm run build` succeeds with no errors, before and after this change.
- `npm run lint`: **6 errors before this change, 5 after** (verified by running
  lint against both the pre-fix commit and the fixed code directly, not
  estimated). One was actually fixed as a side effect of this change —
  `templates.js`'s `urgency` parameter was previously declared but never
  used, and is now used by `getRecommendedAction`. **The other 5 are
  unrelated to this change and were already present before it — not
  introduced, and not fixed, by this PR:**
  - `DashboardPage.jsx:14` and `HistoryPage.jsx:10` — "Cannot access variable
    before it is declared"
  - `HomePage.jsx:16` — calling `setState` synchronously inside an effect
  - `llmHelper.js` — 2 unused-variable errors (`lines`, `reasoning`); these
    sit at different line numbers after this change only because the added
    lines above them shifted the file, not because anything new was added
    there
- Re-tested a fresh clone with **no** `.env.local` / API key present: the app
  renders normally (no blank screen) and the mock categorizer correctly
  produces Technical Problem / High urgency / escalation banner for an
  outage message.

## Security Note

⚠️ **Warning**: This application exposes the Groq API key in the browser (using `dangerouslyAllowBrowser: true`). This is acceptable for local development only but should **NEVER** be done in production. In a real application, API calls should be made from a secure backend server.

## Why Groq?

- ✅ **Completely Free** - No credit card required
- ✅ **Fast Inference** - Groq's LPU technology is incredibly fast
- ✅ **Generous Limits** - ~14,400 requests/day on free tier
- ✅ **High Quality** - Llama 3.3 70B performs excellently
- ✅ **Easy Signup** - Get started in minutes at https://console.groq.com

## License

This project is for educational purposes only.
