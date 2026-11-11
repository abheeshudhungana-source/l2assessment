/**
 * Urgency Scorer - rule-based urgency calculation
 *
 * Scores urgency from what the message actually reports (outages, financial
 * harm, security/fraud, data loss, explicit urgency language), not from
 * superficial style cues. The previous version scored almost entirely from
 * style - message length, letter case, punctuation, and the time of day it
 * happened to arrive - and got real incidents backwards: "SERVER IS DOWN"
 * and "Site down now" scored Low, a fraud/double-charge complaint scored
 * Low, while a long, mostly-positive message with one mild complaint scored
 * High. For a tool whose whole job is telling a support team what to look at
 * first, that's not a cosmetic bug, it's the product failing at its one job.
 *
 * Design: High urgency requires an actual critical-severity signal (an
 * outage, fraud, data loss, explicit urgency language, etc.) - something a
 * support team genuinely needs to see first. Milder signals (a generic bug
 * report, slowness, frustration, exclamation marks) can lift a message into
 * Medium but can't manufacture High on their own, so a handful of excited
 * punctuation in an otherwise calm message can no longer outscore an actual
 * incident report.
 *
 * Signal words are matched on word boundaries, not as plain substrings, so
 * "down" no longer matches inside "download" and "legal" no longer matches
 * inside "illegal" - see verification/compute_word_boundary_and_negation.cjs
 * for the exact before/after cases this fixes. A short negation check also
 * means "no outage, thanks!" and "that's not a security issue" are not
 * flagged High just because the signal word is present.
 *
 * Known remaining gap (documented, not fixed here): this still only
 * recognizes an incident if it uses one of the words below. "Nobody can log
 * in" reports a real problem but matches no signal, so it scores the same as
 * a routine question. Closing that needs expanding the signal vocabulary
 * (or a semantic check), which is its own change with its own before/after
 * verification - see README "Known limitations".
 */

// Signals that something is actually broken, urgent, or harmful right now.
// Any one of these is enough to flag High: these are exactly the reports a
// support team needs surfaced first, however the message is phrased.
const CRITICAL_SIGNALS = [
  'down', 'outage', 'not working', "isn't working", 'broken', "can't access",
  'cannot access', "can't login", 'cannot login', 'locked out',
  'data loss', 'lost my data', 'lost all my', 'security', 'breach', 'hacked',
  'fraud', 'fraudulent', 'unauthorized charge', 'stolen',
  'losing sales', 'losing customers', 'lost sales', 'production is',
  'urgent', 'emergency', 'asap', 'immediately', 'right now', 'critical',
  'legal', 'lawsuit', 'lawyer',
];

// A duplicate/incorrect charge is one of the clearest fraud-adjacent signals
// support can get, but customers phrase it many ways ("charged twice",
// "charged me twice", "charged my card twice", "double charged"). Matching
// one fixed phrase misses most real phrasings, so this checks the concept
// (charge + twice/double) instead of one exact string.
function reportsDuplicateCharge(lowerMessage) {
  const mentionsCharge = lowerMessage.includes('charge');
  const mentionsDuplicate = lowerMessage.includes('twice') || lowerMessage.includes('double');
  return mentionsCharge && mentionsDuplicate;
}

// Negation cues that, when they appear shortly before a matched signal word,
// mean the customer is ruling the problem OUT rather than reporting it - e.g.
// "no outage, thanks!" or "glad that's not a security issue". Without this,
// the match below would flag both of those High.
const NEGATION_WORDS = [
  'no', 'not', 'never', 'nothing', 'without',
  "isn't", 'isnt', "wasn't", 'wasnt', "aren't", 'arent',
  "doesn't", 'doesnt', "didn't", 'didnt', "don't", 'dont',
];
const NEGATION_WINDOW_WORDS = 4;

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Word-boundary match instead of a plain substring check, so short common
// words in the signal lists only match as whole words. Without this,
// "down" matches inside "download", "legal" matches inside "illegal", and
// "security" matches "security camera" - none of which report an actual
// incident.
function buildSignalRegex(phrase) {
  return new RegExp(`\\b${escapeRegExp(phrase)}\\b`, 'gi');
}

function isNegatedAt(lowerMessage, matchIndex) {
  const precedingWords = lowerMessage
    .slice(0, matchIndex)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(-NEGATION_WINDOW_WORDS);
  return precedingWords.some((word) => NEGATION_WORDS.includes(word.replace(/[.,!?;:]+$/, '')));
}

// Milder signals worth a smaller bump: something is wrong, but not
// necessarily on fire. These can push a message into Medium, not High.
const MODERATE_SIGNALS = [
  'error', 'crash', 'crashed', 'crashing', 'bug', 'glitch', 'issue',
  'problem', 'slow', 'loading', 'failed', 'failing', "doesn't work",
  'blocking', 'blocked', 'stuck', 'frustrated', 'disappointed', 'refund',
  'cancel', 'overcharged',
];

const POSITIVE_SIGNALS = ['happy', 'love', 'great', 'excellent', 'wonderful'];

function countMatches(lowerMessage, phrases) {
  let count = 0;
  for (const phrase of phrases) {
    const regex = buildSignalRegex(phrase);
    let match = regex.exec(lowerMessage);
    while (match !== null) {
      if (!isNegatedAt(lowerMessage, match.index)) {
        count += 1;
      }
      match = regex.exec(lowerMessage);
    }
  }
  return count;
}

export function calculateUrgency(message) {
  const lowerMessage = message.toLowerCase();

  const criticalHits = countMatches(lowerMessage, CRITICAL_SIGNALS) + (reportsDuplicateCharge(lowerMessage) ? 1 : 0);
  const moderateHits = countMatches(lowerMessage, MODERATE_SIGNALS);
  const positiveHits = countMatches(lowerMessage, POSITIVE_SIGNALS);

  // Capped so spamming "!!!!!!!!!!" can't manufacture urgency on its own.
  const exclamationCount = Math.min((message.match(/!/g) || []).length, 3);

  // Writing in all caps generally signals heightened urgency or frustration,
  // not calm - it should never pull the score down the way the old version did.
  const isShouting = message === message.toUpperCase() && /[A-Z]/.test(message) && message.trim().length > 10;

  // An actual severity signal (outage, fraud, data loss, "urgent", etc.) is
  // the one thing that reliably means "look at this first" - flag High
  // regardless of tone, length, or politeness. A calmly-worded fraud report
  // is not less urgent than an angry one.
  if (criticalHits > 0) {
    return 'High';
  }

  // No critical signal, but something is still clearly wrong, or the
  // customer is visibly worked up about it (shouting, multiple exclamation
  // marks): worth a human's attention soon, but not drop-everything.
  if (moderateHits > 0 || isShouting || exclamationCount >= 2) {
    return 'Medium';
  }

  // Purely positive feedback with no complaint at all: genuinely low
  // priority, nothing to action.
  if (positiveHits > 0) {
    return 'Low';
  }

  // Deliberately NOT scored: question marks (an incident report is still an
  // incident whether or not it's phrased as a question), and the day/hour
  // the message arrived (when support happens to be reading it is an
  // SLA/staffing concern, not a property of how severe the customer's
  // problem is - if anything, an outage reported off-hours deserves equal
  // attention, not less).

  // A plain, neutral message with no urgency, complaint, or sentiment signal
  // at all (a routine "how do I..." question, a short greeting) is low
  // priority by default.
  return 'Low';
}
