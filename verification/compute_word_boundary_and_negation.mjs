// Verifies the word-boundary + negation fix to calculateUrgency.
//
// Unlike the other verification scripts (which reproduce old/new logic by
// hand for comparison against a pre-fix commit), this one imports the real,
// current src/utils/urgencyScorer.js directly - it has no dependencies, so
// it runs standalone under Node's ESM loader. The "before this fix" scorer
// below is a hand-reproduction of the plain-substring matching this change
// replaces, kept only for the side-by-side comparison.
//
// Run: node verification/compute_word_boundary_and_negation.mjs

import { calculateUrgency as afterFixUrgency } from '../src/utils/urgencyScorer.js';

// "Before this fix": plain substring match, no negation awareness.
// Reproduced exactly from the version of urgencyScorer.js this change edits.
function beforeFixUrgency(message) {
  const lowerMessage = message.toLowerCase();
  const CRITICAL_SIGNALS = [
    'down', 'outage', 'not working', "isn't working", 'broken', "can't access",
    'cannot access', "can't login", 'cannot login', 'locked out',
    'data loss', 'lost my data', 'lost all my', 'security', 'breach', 'hacked',
    'fraud', 'fraudulent', 'unauthorized charge', 'stolen',
    'losing sales', 'losing customers', 'lost sales', 'production is',
    'urgent', 'emergency', 'asap', 'immediately', 'right now', 'critical',
    'legal', 'lawsuit', 'lawyer',
  ];
  function reportsDuplicateCharge(lm) {
    return lm.includes('charge') && (lm.includes('twice') || lm.includes('double'));
  }
  const MODERATE_SIGNALS = [
    'error', 'crash', 'crashed', 'crashing', 'bug', 'glitch', 'issue',
    'problem', 'slow', 'loading', 'failed', 'failing', "doesn't work",
    'blocking', 'blocked', 'stuck', 'frustrated', 'disappointed', 'refund',
    'cancel', 'overcharged',
  ];
  const POSITIVE_SIGNALS = ['happy', 'love', 'great', 'excellent', 'wonderful'];
  function countMatches(lm, phrases) {
    return phrases.reduce((count, phrase) => count + (lm.includes(phrase) ? 1 : 0), 0);
  }
  const criticalHits = countMatches(lowerMessage, CRITICAL_SIGNALS) + (reportsDuplicateCharge(lowerMessage) ? 1 : 0);
  const moderateHits = countMatches(lowerMessage, MODERATE_SIGNALS);
  const positiveHits = countMatches(lowerMessage, POSITIVE_SIGNALS);
  const exclamationCount = Math.min((message.match(/!/g) || []).length, 3);
  const isShouting = message === message.toUpperCase() && /[A-Z]/.test(message) && message.trim().length > 10;
  if (criticalHits > 0) return 'High';
  if (moderateHits > 0 || isShouting || exclamationCount >= 2) return 'Medium';
  if (positiveHits > 0) return 'Low';
  return 'Low';
}

console.log('=== Documented false-positive cases this change fixes ===\n');
const falsePositiveCases = [
  ['no outage, thanks!', 'Low', 'negation: ruling the outage OUT'],
  ["glad that's not a security issue", 'Low', 'negation: ruling the security issue OUT'],
  ['Can you help me download the invoice?', 'Low', '"down" is a substring of "download" - not a whole word'],
  ['Is this legally binding?', 'Low', '"legal" is a substring of "legally" - not a whole word'],
  ['illegal', 'Low', '"legal" is a substring of "illegal" - not a whole word'],
];
let allPassed = true;
for (const [msg, expectedAfter, note] of falsePositiveCases) {
  const before = beforeFixUrgency(msg);
  const after = afterFixUrgency(msg);
  const ok = after === expectedAfter;
  if (!ok) allPassed = false;
  console.log(`"${msg}"`);
  console.log(`  before: ${before}  ->  after: ${after}  (expected: ${expectedAfter}, ${ok ? (before !== after ? 'FIXED' : 'already ok') : 'NOT FIXED'})`);
  console.log(`  why: ${note}\n`);
}

console.log('=== NOT fixed by this change (documented, different root cause) ===\n');
// "security" in "security camera" is a correctly-bounded WHOLE word match -
// word-boundary matching has nothing to fix here. The problem is the same
// word used in a different sense (a product feature, not an incident
// report), which needs a collocation/semantic check, not a boundary fix.
// Listing it here (expected to still be High) so this script keeps proving
// that, rather than silently claiming a fix that didn't happen.
const stillBrokenCases = [
  ['I love the new security camera app', 'High', '"security" is correctly a whole word here; same word, different meaning - needs a semantic/collocation check, not boundary matching'],
];
for (const [msg, expectedAfter, note] of stillBrokenCases) {
  const after = afterFixUrgency(msg);
  const asExpected = after === expectedAfter;
  if (!asExpected) allPassed = false;
  console.log(`"${msg}"  ->  ${after}  (still ${expectedAfter}, as expected: ${asExpected})`);
  console.log(`  why still broken: ${note}\n`);
}

console.log('=== Sanity check: a real critical report with no negation is still flagged High ===\n');
const stillCaughtCases = [
  ['SERVER IS DOWN', 'High'],
  ['The site is down for everyone', 'High'],
  ["I think someone charged my card twice and I'm worried about fraud.", 'High'],
  ['This is a legal matter, I need to speak to a lawyer', 'High'],
];
for (const [msg, expected] of stillCaughtCases) {
  const after = afterFixUrgency(msg);
  const ok = after === expected;
  if (!ok) allPassed = false;
  console.log(`"${msg}"  ->  ${after}  (expected: ${expected}, ${ok ? 'ok' : 'REGRESSION'})`);
}

console.log('\n=== Regression check: original 10 test messages (compute_before_after.cjs) unchanged by this fix ===\n');
const originalMessages = [
  ['SERVER IS DOWN', 'High'],
  ['OUR CHECKOUT IS BROKEN!!! WE ARE LOSING SALES RIGHT NOW', 'High'],
  ["Hi, could you please help? I think someone charged my card twice and I'm worried about fraud. Thanks so much!", 'High'],
  ['It would be great if you could add dark mode to the dashboard. Thanks!', 'Low'],
  ["Just wanted to say thank you, your support team is excellent and I love the product!", 'Low'],
  ['How do I reset my password?', 'Low'],
  ["I'd like to cancel my subscription please, the charge was higher than expected.", 'Medium'],
  ["Hey there, I hope you're doing well today! I just wanted to reach out and say that overall I've been really happy with the service over the past few months, though I did notice the loading times are a little slow sometimes, no big deal though, just thought I'd mention it in case it helps!", 'Medium'],
  ['Site down now', 'High'],
  ['Is anyone else seeing a 500 error on checkout? This is blocking customers.', 'Medium'],
];
originalMessages.forEach(([msg, expectedFromReadme], i) => {
  const after = afterFixUrgency(msg);
  const ok = after === expectedFromReadme;
  if (!ok) allPassed = false;
  console.log(`#${i + 1}: ${after}  (README "After" column: ${expectedFromReadme}, ${ok ? 'matches' : 'CHANGED'})  "${msg.slice(0, 55)}${msg.length > 55 ? '...' : ''}"`);
});

console.log(`\n=== Summary ===`);
console.log(allPassed
  ? 'All false-positive/negation cases now resolve correctly, real incidents are still caught, and none of the original 10 messages changed result.'
  : 'SOME CASES DID NOT MATCH EXPECTATIONS - see above.');
process.exit(allPassed ? 0 : 1);
