/**
 * Urgency Scorer - Semantic severity and business impact evaluation
 * Evaluates urgency based on actual operational risk, downtime, and user impact
 * rather than arbitrary character lengths or exclamation counts.
 */

export function calculateUrgency(message) {
  if (!message || typeof message !== 'string') return "Low";
  const text = message.toLowerCase().trim();

  // 1. Explicit Negation Check (e.g. "not urgent", "no rush")
  if (/(not\s+urgent|no\s+rush|whenever\s+you\s+can|not\s+a\s+priority)/i.test(text)) {
    return "Low";
  }

  // 2. Customer Praise / Gratitude (with compound idiom safety)
  const isPraise = /(thank you|thanks|appreciate|great job|love the app|awesome work|really happy|positive feedback)/i.test(text);
  const isPraiseIdiom = /(no\s+(complaints?|issues?|problems?)|without\s+(any\s+)?(issue|problem)|not\s+only.*?but|thanks\s+for\s+fixing|resolved\s+(the|this|our)\s+issue)/i.test(text);
  const hasActiveComplaint = /(is|was|still|keeps)\s+(broken|down|crashing|failing|buggy)|(cannot|can't|unable to)\s+(access|login|use|load)|(refund|cancel\s+(my|our)\s+(account|subscription))/i.test(text);
  
  if ((isPraise && !hasActiveComplaint) || isPraiseIdiom) {
    return "Low";
  }

  // 3. Critical Severity: Active Outage, Data Loss, Security Compromise
  const isOutage = /\b(server|database|system|production|api|site)\b.*?\b(down|crashed|crashing|lost|unreachable|offline|unavailable)\b/i.test(text)
    || /\b(lost connection|data loss|critical outage|can't access dashboard|hacked|breach|unauthorized)\b/i.test(text)
    || /\b(database connection lost|server down now)\b/i.test(text);

  if (isOutage) {
    return "Critical";
  }

  // 4. High Severity: Payment Failure, Churn Threat, Broken Core Functionality
  const isHighSeverity = /\b(payment failed|card declined|charged twice|cannot charge|cancel my account|cancel subscription|demand refund|urgent|emergency|blocking our team)\b/i.test(text)
    || (/\b(loading forever|times out|keeps timing out|error)\b/i.test(text) && text.includes("dashboard"));

  if (isHighSeverity) {
    return "High";
  }

  // 5. Low Severity: Feature Requests & General FAQ Questions
  const isFeatureRequest = /\b(feature request|would love to see|could you add|nice to have|dark mode|csv export)\b/i.test(text);
  const isSimpleFAQ = /\b(business hours|pricing|how much|faq|how do i)\b/i.test(text);

  if (isFeatureRequest || isSimpleFAQ) {
    return "Low";
  }

  // Default to Medium for general troubleshooting
  return "Medium";
}

