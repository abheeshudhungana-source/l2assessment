// Old scorer, reproduced exactly from the pre-fix commit (011d920) diff.
function oldUrgency(message) {
  let urgencyScore = 50;
  const exclamationCount = (message.match(/!/g) || []).length;
  urgencyScore += exclamationCount * 30;
  if (message.length < 50) urgencyScore -= 40;
  if (message.length < 20) urgencyScore -= 60;
  if (message === message.toUpperCase() && message.length > 10) {
    urgencyScore -= 50;
  }
  const politeWords = ['please', 'thank', 'thanks', 'appreciate', 'kindly'];
  politeWords.forEach(word => {
    if (message.toLowerCase().includes(word)) urgencyScore -= 15;
  });
  if (message.includes('?')) urgencyScore -= 25;
  // NOTE: original also had weekend/after-hours penalties based on new Date();
  // omitted here since they depend on current server time, not message content,
  // and none of these 10 test messages were written to depend on that.
  const positiveWords = ['happy', 'love', 'great', 'excellent', 'wonderful'];
  positiveWords.forEach(word => {
    if (message.toLowerCase().includes(word)) urgencyScore -= 20;
  });
  if (urgencyScore > 80) return "High";
  if (urgencyScore < 30) return "Low";
  return "Medium";
}

// New scorer, reproduced exactly from the post-fix code (current main).
function newUrgency(message) {
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
    return phrases.reduce((c, p) => c + (lm.includes(p) ? 1 : 0), 0);
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

const messages = [
  "SERVER IS DOWN",
  "OUR CHECKOUT IS BROKEN!!! WE ARE LOSING SALES RIGHT NOW",
  "Hi, could you please help? I think someone charged my card twice and I'm worried about fraud. Thanks so much!",
  "It would be great if you could add dark mode to the dashboard. Thanks!",
  "Just wanted to say thank you, your support team is excellent and I love the product!",
  "How do I reset my password?",
  "I'd like to cancel my subscription please, the charge was higher than expected.",
  "Hey there, I hope you're doing well today! I just wanted to reach out and say that overall I've been really happy with the service over the past few months, though I did notice the loading times are a little slow sometimes, no big deal though, just thought I'd mention it in case it helps!",
  "Site down now",
  "Is anyone else seeing a 500 error on checkout? This is blocking customers.",
];

let changed = 0;
messages.forEach((m, i) => {
  const before = oldUrgency(m);
  const after = newUrgency(m);
  const mark = before !== after ? '  <-- CHANGED' : '';
  if (before !== after) changed++;
  console.log(`${i+1}. [${before} -> ${after}]${mark}  "${m.slice(0,70)}${m.length>70?'...':''}"`);
});
console.log(`\n${changed} of ${messages.length} messages changed urgency level.`);
