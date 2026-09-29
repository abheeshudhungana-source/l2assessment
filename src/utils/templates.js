/**
 * Recommendation Templates - Maps categories to recommended actions, departments, and SLA targets
 */

export const VALID_CATEGORIES = [
  "Technical Problem",
  "Billing Issue",
  "Feature Request",
  "Account & Security",
  "Churn Risk",
  "General Inquiry",
  "Customer Praise"
];

export const VALID_URGENCIES = ["Critical", "High", "Medium", "Low"];

export const VALID_DEPARTMENTS = [
  "Engineering / DevOps",
  "Billing & Finance",
  "Tier 1 Support",
  "Customer Success",
  "Product Management"
];

// Deterministic Category -> Primary Department Mapping (Guardrail)
export const CATEGORY_DEPARTMENT_GUARDRAIL = {
  "Technical Problem": "Engineering / DevOps",
  "Billing Issue": "Billing & Finance",
  "Feature Request": "Product Management",
  "Account & Security": "Engineering / DevOps",
  "Churn Risk": "Customer Success",
  "Customer Praise": "Customer Success",
  "General Inquiry": "Tier 1 Support",
  "Unknown": "Tier 1 Support"
};

// Urgency -> SLA Target Mapping
export const URGENCY_SLA_MAP = {
  "Critical": "15 minutes",
  "High": "1 hour",
  "Medium": "4 hours",
  "Low": "24 hours"
};

const actionTemplates = {
  "Technical Problem": "Verify system logs, check status page, and alert engineering if service interruption.",
  "Billing Issue": "Review customer billing history, payment gateway logs, and verify card status.",
  "Feature Request": "Log suggestion in product backlog, tag relevant module, and notify product owner.",
  "Account & Security": "Verify user identity, audit login logs, and reset security credentials if compromised.",
  "Churn Risk": "Initiate high-priority customer success outreach and review retention incentives.",
  "Customer Praise": "Send heartfelt thank-you note and log positive sentiment in customer score.",
  "General Inquiry": "Provide direct answer and link relevant knowledge base / FAQ documentation.",
  "Unknown": "Review manually and route to Tier 1 triage."
};

/**
 * Get recommended action for a given category and urgency
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @returns {string} - Recommended next step
 */
export function getRecommendedAction(category, urgency) {
  if (urgency === "Critical") {
    return "IMMEDIATE ESCALATION: Page on-call team and post incident update on status board.";
  }
  return actionTemplates[category] || actionTemplates["General Inquiry"];
}

/**
 * Get all available categories
 * 
 * @returns {string[]} - List of categories
 */
export function getAvailableCategories() {
  return VALID_CATEGORIES;
}

/**
 * Determines if message should be escalated based on severity, not character length
 * 
 * @param {string} category - The message category
 * @param {string} urgency - The urgency level
 * @param {string} message - The original message
 * @returns {boolean} - Whether to escalate
 */
export function shouldEscalate(category, urgency, message) {
  if (urgency === "Critical") return true;
  if (urgency === "High" && (category === "Technical Problem" || category === "Churn Risk" || category === "Account & Security")) return true;
  return false;
}

