// Checks the 4 time conditions separately (weekday/off-hours and
// weekend/business-hours individually, not just the combined worst case)
// for the 4 messages that compute_before_after_v2.cjs found to be
// time-sensitive, to confirm whether either penalty alone (not just both
// together) is enough to change the urgency level. Fully deterministic:
// day/hour are passed as hardcoded parameters, never read from the clock.
// Run with: node check_time_combinations.cjs
function oldUrgencyScoreRaw(message, dayOverride, hourOverride) {
  let urgencyScore = 50;
  const exclamationCount = (message.match(/!/g) || []).length;
  urgencyScore += exclamationCount * 30;
  if (message.length < 50) urgencyScore -= 40;
  if (message.length < 20) urgencyScore -= 60;
  if (message === message.toUpperCase() && message.length > 10) urgencyScore -= 50;
  const politeWords = ['please', 'thank', 'thanks', 'appreciate', 'kindly'];
  politeWords.forEach(w => { if (message.toLowerCase().includes(w)) urgencyScore -= 15; });
  if (message.includes('?')) urgencyScore -= 25;
  if (dayOverride === 0 || dayOverride === 6) urgencyScore -= 20;
  if (hourOverride < 9 || hourOverride > 17) urgencyScore -= 15;
  const positiveWords = ['happy', 'love', 'great', 'excellent', 'wonderful'];
  positiveWords.forEach(w => { if (message.toLowerCase().includes(w)) urgencyScore -= 20; });
  return urgencyScore;
}
function toLevel(score) {
  if (score > 80) return "High";
  if (score < 30) return "Low";
  return "Medium";
}

const affected = {
  2: "OUR CHECKOUT IS BROKEN!!! WE ARE LOSING SALES RIGHT NOW",
  4: "It would be great if you could add dark mode to the dashboard. Thanks!",
  7: "I'd like to cancel my subscription please, the charge was higher than expected.",
  8: "Hey there, I hope you're doing well today! I just wanted to reach out and say that overall I've been really happy with the service over the past few months, though I did notice the loading times are a little slow sometimes, no big deal though, just thought I'd mention it in case it helps!",
};

// 4 conditions: weekday=Mon(1)/9-17; weekday-offhours=Mon(1)/2am; weekend-businesshours=Sun(0)/14; weekend-offhours=Sun(0)/2am
const conditions = [
  ['weekday/business-hours (baseline)', 1, 14],
  ['weekday/off-hours ONLY', 1, 2],
  ['weekend/business-hours ONLY', 0, 14],
  ['weekend/off-hours (combined, both penalties)', 0, 2],
];

for (const [num, msg] of Object.entries(affected)) {
  console.log(`\n#${num}: "${msg.slice(0,50)}..."`);
  for (const [label, day, hour] of conditions) {
    const score = oldUrgencyScoreRaw(msg, day, hour);
    console.log(`  ${label}: raw=${score} -> ${toLevel(score)}`);
  }
}
