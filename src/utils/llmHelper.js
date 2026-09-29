import Groq from 'groq-sdk';
import {
  VALID_CATEGORIES,
  VALID_URGENCIES,
  VALID_DEPARTMENTS,
  CATEGORY_DEPARTMENT_GUARDRAIL,
  URGENCY_SLA_MAP,
  getRecommendedAction
} from './templates.js';
import { calculateUrgency } from './urgencyScorer.js';

/**
 * LLM Helper for Relay AI Customer Inbox Triage
 * Provides multi-dimensional categorization, semantic urgency prioritization,
 * intelligent department routing, and customer draft replies.
 */

// Initialize Groq client with universal env safety
const apiKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_API_KEY)
  || (typeof process !== 'undefined' && process.env?.VITE_GROQ_API_KEY)
  || '';

const groq = new Groq({
  apiKey,
  dangerouslyAllowBrowser: true // Required for browser-based calls in local dev
});

export const TRIAGE_SYSTEM_PROMPT = `
You are an expert AI customer operations triage engine for Relay AI.
Analyze the incoming customer support message and return a strictly valid JSON object matching the schema below.

CRITICAL INSTRUCTIONS:
1. NEGATION & CONTEXT: Carefully analyze semantic intent and negation.
   - If a customer says "This is NOT urgent" or "No rush", mark urgency as "Low".
   - If a customer says "I don't need billing help, but my server is down", categorize under "Technical Problem", NOT Billing.
   - If a customer expresses gratitude or praise ("Thank you so much!"), categorize under "Customer Praise" with "Low" urgency, regardless of exclamation marks.
2. OUTAGES & HIGH SEVERITY: Any mention of active production downtime, database loss, system crash, or severe payment failure is "Critical" or "High" urgency regardless of message length.
3. OUTPUT FORMAT: Output ONLY pure, parseable JSON with no conversational preamble or markdown code fences.

JSON SCHEMA:
{
  "category": "Technical Problem" | "Billing Issue" | "Feature Request" | "Account & Security" | "Churn Risk" | "General Inquiry" | "Customer Praise",
  "urgency": "Critical" | "High" | "Medium" | "Low",
  "department": "Engineering / DevOps" | "Billing & Finance" | "Tier 1 Support" | "Customer Success" | "Product Management",
  "slaTarget": "15 minutes" | "1 hour" | "4 hours" | "24 hours",
  "recommendedAction": "string (concrete operational next step for the support agent)",
  "draftReply": "string (professional, empathetic response draft ready to send to the customer)",
  "reasoning": "string (succinct justification of the classification and urgency)"
}
`;

/**
 * Normalizes and validates the raw JSON payload against canonical enums and guardrails.
 * Does NOT perform crude substring keyword overrides that stomp on LLM semantic reasoning.
 */
export function normalizeTriagePayload(parsed, originalMessage) {
  // 1. Sanitize & Enforce Canonical Category
  const category = VALID_CATEGORIES.includes(parsed?.category)
    ? parsed.category
    : "General Inquiry";

  // 2. Enforce Canonical Urgency
  const urgency = VALID_URGENCIES.includes(parsed?.urgency)
    ? parsed.urgency
    : calculateUrgency(originalMessage);

  // 3. Department Guardrail (Reconcile against Category taxonomy)
  let department = VALID_DEPARTMENTS.includes(parsed?.department)
    ? parsed.department
    : CATEGORY_DEPARTMENT_GUARDRAIL[category];

  // Logical constraint: Customer Praise or Feature Request should not route to Engineering/DevOps
  if (category === "Customer Praise" && department === "Engineering / DevOps") {
    department = "Customer Success";
  }
  if (category === "Feature Request" && department === "Engineering / DevOps") {
    department = "Product Management";
  }

  // 4. Deterministic SLA Target alignment
  const slaTarget = URGENCY_SLA_MAP[urgency] || "4 hours";

  // 5. Recommended Action & Draft Reply
  const recommendedAction = parsed?.recommendedAction?.trim() || getRecommendedAction(category, urgency);
  const draftReply = parsed?.draftReply?.trim() || generateDefaultDraft(category, originalMessage);
  const reasoning = parsed?.reasoning?.trim() || `Classified as ${category} with ${urgency} urgency based on customer intent.`;

  return {
    category,
    urgency,
    department,
    slaTarget,
    recommendedAction,
    draftReply,
    reasoning
  };
}

/**
 * Helper to generate default customer draft when none is returned
 */
function generateDefaultDraft(category, message) {
  switch (category) {
    case "Technical Problem":
      return "Hello, thank you for alerting us to this issue. Our engineering team is currently investigating, and we will update you as soon as we have a resolution.";
    case "Billing Issue":
      return "Hi there, thank you for reaching out regarding your account. I would be happy to review your billing details and assist you with this.";
    case "Feature Request":
      return "Hi, thank you for the valuable suggestion! I have forwarded this feedback directly to our product team for roadmap consideration.";
    case "Customer Praise":
      return "Thank you so much for your wonderful feedback and support! It means a lot to our entire team.";
    default:
      return "Hello, thank you for reaching out. We have received your inquiry and our support team is happy to assist you.";
  }
}

/**
 * Resilient JSON parsing helper that extracts JSON object from potential markdown wrappers
 */
function safeParseJson(rawContent) {
  if (!rawContent || typeof rawContent !== 'string') return null;
  
  // Try direct parse
  try {
    return JSON.parse(rawContent.trim());
  } catch (e) {
    // Attempt to extract from markdown code fence
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
    if (jsonMatch && jsonMatch[1]) {
      try {
        return JSON.parse(jsonMatch[1].trim());
      } catch (innerErr) {
        // continue
      }
    }
    
    // Attempt to extract first outer curly braces
    const firstBrace = rawContent.indexOf('{');
    const lastBrace = rawContent.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawContent.slice(firstBrace, lastBrace + 1));
      } catch (innerErr2) {
        // continue
      }
    }
  }
  return null;
}

/**
 * Main Triage function using Groq AI with graceful semantic fallback
 * 
 * @param {string} message - The customer support message
 * @returns {Promise<{category: string, urgency: string, department: string, slaTarget: string, recommendedAction: string, draftReply: string, reasoning: string}>}
 */
export async function triageMessage(message) {
  if (!message || !message.trim()) {
    return getSemanticOfflineFallback(message);
  }

  // Check if API key is configured
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    return getSemanticOfflineFallback(message);
  }

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: TRIAGE_SYSTEM_PROMPT
        },
        {
          role: "user",
          content: `Customer support message to triage:\n"""\n${message}\n"""`
        }
      ],
      temperature: 0.1,
      response_format: { type: "json_object" }
    });

    const content = response.choices?.[0]?.message?.content;
    const parsed = safeParseJson(content);

    if (parsed) {
      return normalizeTriagePayload(parsed, message);
    }
    
    console.warn('Could not parse structured JSON from Groq, using fallback');
    return getSemanticOfflineFallback(message);
  } catch (error) {
    console.warn('Groq API error, engaging semantic fallback:', error.message);
    return getSemanticOfflineFallback(message);
  }
}

/**
 * Legacy wrapper for backward compatibility with existing tests/pages
 */
export async function categorizeMessage(message) {
  const result = await triageMessage(message);
  return {
    category: result.category,
    urgency: result.urgency,
    department: result.department,
    slaTarget: result.slaTarget,
    recommendedAction: result.recommendedAction,
    draftReply: result.draftReply,
    reasoning: result.reasoning
  };
}

/**
 * Semantic Offline Fallback Engine
 * Accurately handles classification, urgency, department, and actions
 * even when the API is down, rate-limited, or unconfigured.
 */
export function getSemanticOfflineFallback(message) {
  const text = (message || '').toLowerCase().trim();

  // --- SEVERITY-FIRST OFFLINE TRIAGE HIERARCHY ---

  // 1. Check for Active Negative Complaints & Outages FIRST
  const hasActiveComplaint = /(still|haven't|not)\s+(been\s+)?fixed|(is|was|still|keeps)\s+(broken|down|crashing|failing|buggy)|(cannot|can't|unable to)\s+(access|login|use|load)|(refund|cancel\s+(my|our)\s+(account|subscription))|(but|however)\s+.*?(broken|down|not\s+working|failed|slow|issue|problem|worse|again)/i.test(text);

  const isActiveOutage = /\b(server|database|system|production|api|site)\b.*?\b(down|crashed|crashing|lost|unreachable|offline|unavailable)\b/i.test(text)
    || /\b(lost connection|data loss|critical outage|can't access dashboard|hacked|breach|unauthorized)\b/i.test(text)
    || /\b(database connection lost|server down now)\b/i.test(text);

  // If there is an active outage (unless it is purely historical praise like "was down last week but now fixed")
  const isPureHistoricalPraise = /^(thanks?|thank you).*?(was\s+down|fixed).*?(now\s+(working|good|fine)|resolved)/i.test(text) && !text.includes("again") && !text.includes("worse");

  if (isActiveOutage && !isPureHistoricalPraise) {
    return {
      category: "Technical Problem",
      urgency: "Critical",
      department: "Engineering / DevOps",
      slaTarget: "15 minutes",
      recommendedAction: "IMMEDIATE ESCALATION: Page on-call engineering team and verify system telemetry.",
      draftReply: "We are urgently investigating this issue with our engineering team right now. We will provide an update within 15 minutes.",
      reasoning: "Offline rule: Detected active production downtime, database loss, or critical system disruption."
    };
  }

  // 2. Customer Praise (Guarded: NEVER matches if an active complaint exists)
  const isPraise = /(thank you|thanks|appreciate|great job|love the app|awesome work|really happy|positive feedback|really nice design)/i.test(text);
  const isPraiseIdiom = /(no\s+(complaints?|issues?|problems?)|without\s+(any\s+)?(issue|problem)|not\s+only.*?but|thanks\s+for\s+fixing|resolved\s+(the|this|our)\s+issue|appreciate\s+the\s+quick\s+(fix|turnaround))/i.test(text);

  if ((isPraise || isPraiseIdiom) && !hasActiveComplaint) {
    return {
      category: "Customer Praise",
      urgency: "Low",
      department: "Customer Success",
      slaTarget: "24 hours",
      recommendedAction: "Send thank-you response and log positive feedback in customer health score.",
      draftReply: "Thank you so much for the kind words! We really appreciate your support and are thrilled to hear you're having a great experience.",
      reasoning: "Offline rule: Detected positive customer sentiment and appreciation without active support complaints."
    };
  }

  // 3. Technical Problems / Active Bugs
  const isTechnical = /\b(bug|error|not loading|keeps loading|times out|broken|issue with|won't load|glitch|won't open|not working)\b/i.test(text)
    || hasActiveComplaint;

  if (isTechnical) {
    return {
      category: "Technical Problem",
      urgency: "High",
      department: "Engineering / DevOps",
      slaTarget: "1 hour",
      recommendedAction: "Collect user browser/device logs, inspect recent deployment errors, and triage bug.",
      draftReply: "Hello, thank you for letting us know about this issue. Our team is investigating what caused this glitch and will get back to you shortly.",
      reasoning: "Offline rule: Detected active technical defect, unresolved bug, or system failure."
    };
  }

  // 4. Feature Request
  if (/\b(feature|would love to see|could you add|nice to have|dark mode|csv export|suggestion|wish you had)\b/i.test(text)) {
    return {
      category: "Feature Request",
      urgency: "Low",
      department: "Product Management",
      slaTarget: "24 hours",
      recommendedAction: "Log suggestion in product backlog, tag relevant module, and notify product owner.",
      draftReply: "Thank you for the great suggestion! I have forwarded this feature request to our product team for roadmap review.",
      reasoning: "Offline rule: Customer is requesting a new product capability or enhancement."
    };
  }

  // 5. Billing / Subscription / Payment Issue (Check for negation like "don't need billing")
  const isBillingNegated = /(not|no|don't|do not)\s+(need\s+)?billing/i.test(text);
  if (!isBillingNegated && /\b(billing|payment|invoice|credit card|charge|subscription|pro plan|upgrade|refund|cancel)\b/i.test(text)) {
    const isPaymentFailure = text.includes("fail") || text.includes("declined") || text.includes("cancel") || text.includes("refund");
    return {
      category: "Billing Issue",
      urgency: isPaymentFailure ? "High" : "Medium",
      department: "Billing & Finance",
      slaTarget: isPaymentFailure ? "1 hour" : "4 hours",
      recommendedAction: "Review customer billing account history, payment gateway logs, and verify card status.",
      draftReply: "Hello, thank you for reaching out regarding your account. I would be happy to review your billing details and assist you with this.",
      reasoning: "Offline rule: Financial, subscription, or payment inquiry detected."
    };
  }

  // 6. Security & Account Access
  if (/\b(password|login|unauthorized|hacked|mfa|2fa|locked out|access)\b/i.test(text)) {
    return {
      category: "Account & Security",
      urgency: "High",
      department: "Engineering / DevOps",
      slaTarget: "1 hour",
      recommendedAction: "Verify account identity, audit authentication logs, and assist with secure access recovery.",
      draftReply: "Hello, we take account security very seriously. Please confirm your account email so we can verify your credentials securely.",
      reasoning: "Offline rule: Account authentication or security concern detected."
    };
  }

  // 7. General Inquiry (Default fallback)
  return {
    category: "General Inquiry",
    urgency: "Low",
    department: "Tier 1 Support",
    slaTarget: "24 hours",
    recommendedAction: "Review inquiry and provide standard FAQ links or direct answers.",
    draftReply: "Hello, thank you for contacting Relay support! How can we assist you today?",
    reasoning: "Offline rule: Standard informational inquiry requiring Tier 1 assistance."
  };
}

