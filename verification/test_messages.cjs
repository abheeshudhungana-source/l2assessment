const { chromium } = require('/opt/npm-tools/node_modules/playwright');

const messages = [
  // 1: Genuine outage, short + ALL CAPS — should be obviously High urgency
  "SERVER IS DOWN",
  // 2: Genuine outage, short + ALL CAPS + exclamation
  "OUR CHECKOUT IS BROKEN!!! WE ARE LOSING SALES RIGHT NOW",
  // 3: Polite but genuinely urgent billing/security issue
  "Hi, could you please help? I think someone charged my card twice and I'm worried about fraud. Thanks so much!",
  // 4: Feature request phrased politely
  "It would be great if you could add dark mode to the dashboard. Thanks!",
  // 5: Positive feedback, no action needed
  "Just wanted to say thank you, your support team is excellent and I love the product!",
  // 6: General question
  "How do I reset my password?",
  // 7: Billing cancellation request, calm tone
  "I'd like to cancel my subscription please, the charge was higher than expected.",
  // 8: Long rambling but low-severity message (tests shouldEscalate's length-only logic)
  "Hey there, I hope you're doing well today! I just wanted to reach out and say that overall I've been really happy with the service over the past few months, though I did notice the loading times are a little slow sometimes, no big deal though, just thought I'd mention it in case it helps!",
  // 9: Short, non-caps, genuinely urgent technical outage
  "Site down now",
  // 10: Technical bug report, polite, with question mark (tests urgency-lowering of '?')
  "Is anyone else seeing a 500 error on checkout? This is blocking customers.",
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const results = [];

  for (const msg of messages) {
    await page.goto('http://localhost:5180/analyze', { waitUntil: 'networkidle' });
    await page.fill('textarea', msg);
    await page.click('button:has-text("Analyze Message")');
    await page.waitForTimeout(1500);
    const category = await page.locator('.inline-block.bg-blue-100').first().innerText().catch(() => 'ERR');
    const urgency = await page.locator('div.inline-block.px-4.py-2.rounded-lg.font-semibold').nth(1).innerText().catch(() => 'ERR');
    const action = await page.locator('.bg-purple-50 p').first().innerText().catch(() => 'ERR');
    results.push({ msg, category, urgency, action });
    console.log(`MSG: ${JSON.stringify(msg)}\n  -> Category: ${category} | Urgency: ${urgency} | Action: ${action}\n`);
  }

  require('fs').writeFileSync('/tmp/test_results.json', JSON.stringify(results, null, 2));
  await browser.close();
})();
