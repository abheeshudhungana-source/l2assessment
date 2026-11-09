/**
 * Recommendation Templates - Maps categories (and urgency) to recommended actions
 */

const actionTemplates = {
  "Billing Issue": "Ask user to check billing portal.",
  "Technical Problem": "Suggest user to restart their browser.",
  "General Inquiry": "Respond with FAQ link.",
  // Was previously (incorrectly) mapped to the billing-portal message, a
  // copy/paste bug - a feature request has nothing to do with billing.
  "Feature Request": "Log the suggestion for the product team and send an acknowledgment.",
  "Unknown": "Review manually."
}

// Escalation guidance shown for High-urgency messages, on top of the normal
// category template, so the two most urgency-sensitive categories get a
// visibly different instruction than their Low/Medium counterparts.
const highUrgencyPrefix = {
  "Billing Issue": "Escalate immediately to a human agent (possible fraud/financial impact) - ",
  "Technical Problem": "Escalate immediately to on-call engineering (possible outage) - ",
}

/**
 * Get recommended action for a given category and urgency.
 *
 * Previously this ignored urgency entirely (it was only ever called with the
 * category), so a High-urgency outage and a Low-urgency one got the exact
 * same generic suggestion. Urgency now actually changes the guidance for the
 * categories where that matters most.
 *
 * @param {string} category - The message category
 * @param {string} [urgency] - The urgency level ("High" | "Medium" | "Low")
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  const base = actionTemplates[category] || "No recommendation available."
  if (urgency === 'High' && highUrgencyPrefix[category]) {
    return highUrgencyPrefix[category] + base.charAt(0).toLowerCase() + base.slice(1)
  }
  return base
}

/**
 * Get all available categories
 *
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return Object.keys(actionTemplates)
}

/**
 * Determines if message should be escalated
 *
 * Previously based only on message.length > 100, so a short "SERVER DOWN!!!"
 * would never escalate while a long, calm, mostly-positive message always
 * would. Escalation now follows urgency (the signal actually designed to
 * capture severity) instead of message length, which has no bearing on how
 * serious an issue is.
 *
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency) {
  return urgency === 'High'
}
