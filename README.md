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
`?`, even weekday/hour — instead of *content*. Before/after on the same 10 test
messages:

| Message | Before | After |
|---|---|---|
| "SERVER IS DOWN" | Low | **High** |
| "Site down now" | Low | **High** |
| "...charged my card twice...fraud..." (polite tone) | Low | **High** |
| Long, mostly-positive message, one mild "slow" complaint | High | **Medium** |
| "How do I reset my password?" | Low | Low |
| "I'd like to cancel my subscription...higher than expected" | Low | Medium |

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
