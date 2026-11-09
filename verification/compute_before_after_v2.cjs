// Old scorer, FULL fidelity including the date-based penalty this time
// (previous version of this script omitted it).
function oldUrgencyFull(message) {
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
  const now = new Date();
  if (now.getDay() === 0 || now.getDay() === 6) urgencyScore -= 20;
  if (now.getHours() < 9 || now.getHours() > 17) urgencyScore -= 15;
  const positiveWords = ['happy', 'love', 'great', 'excellent', 'wonderful'];
  positiveWords.forEach(word => {
    if (message.toLowerCase().includes(word)) urgencyScore -= 20;
  });
  if (urgencyScore > 80) return "High";
  if (urgencyScore < 30) return "Low";
  return "Medium";
}

const now = new Date();
console.log('Computed at:', now.toString(), '| day:', now.getDay(), '(0=Sun,6=Sat) | hour:', now.getHours());

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

// Also compute the weekend/after-hours worst case to show the sensitivity.
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

messages.forEach((m, i) => {
  const nowResult = oldUrgencyFull(m);
  const weekdayBusinessHours = toLevel(oldUrgencyScoreRaw(m, 1, 14)); // Mon 2pm, baseline
  const worstCase = toLevel(oldUrgencyScoreRaw(m, 0, 2)); // Sunday 2am: both penalties apply
  const flag = (nowResult !== worstCase) ? '  <-- TIME-SENSITIVE' : '';
  console.log(`${i+1}. now=${nowResult}  weekday/9-17=${weekdayBusinessHours}  weekend/off-hours=${worstCase}${flag}`);
});
