/**
 * F3-009: AI Email Copywriter Agent
 * Template-based personalized email generation by ICP tier.
 */
import { sqlite } from "@/lib/db";

interface EmailTemplate {
  subject: string;
  body: string;
}

interface CompanyContext {
  name: string;
  type: string | null;
  state: string | null;
  city: string | null;
  icpTier: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactTitle: string | null;
}

// ── Templates by ICP Tier ──

const TEMPLATES: Record<string, Record<string, EmailTemplate>> = {
  A: {
    intro: {
      subject: "{{firstName}}, curated eyewear for {{companyName}}",
      body: `Hi {{firstName}},

I came across {{companyName}} and was genuinely impressed by what you've built in {{city}}. Your store's reputation for quality really stands out.

I'm reaching out from Jaxy Eyewear — we design modern, trend-forward frames specifically for independent retailers like yours. Our wholesale partners consistently see strong sell-through rates because we focus on styles that customers actually want to wear.

I'd love to share our latest collection with you. Would you be open to a quick 10-minute call this week?

Best,
The Jaxy Team`,
    },
    follow_up: {
      subject: "Quick follow-up — Jaxy × {{companyName}}",
      body: `Hi {{firstName}},

Just wanted to circle back on my previous email. I know you're busy, so I'll keep this short:

- **No minimums** on first orders
- **Free shipping** on orders over $500
- **60-day** net terms available

Happy to send over our line sheet if you'd like to take a look — no commitment needed.

Best,
The Jaxy Team`,
    },
  },
  B: {
    intro: {
      subject: "Wholesale eyewear opportunity for {{companyName}}",
      body: `Hi {{firstName}},

I'm reaching out from Jaxy Eyewear. We work with {{type}} retailers across the country, offering modern frames at competitive wholesale pricing.

A few things that set us apart:
- Trend-forward designs that sell
- Flexible ordering with low minimums
- Dedicated wholesale support

Would you be interested in seeing our latest collection?

Best,
The Jaxy Team`,
    },
    follow_up: {
      subject: "Jaxy Eyewear — line sheet for {{companyName}}",
      body: `Hi {{firstName}},

Following up on my previous note. I'd love to send over our wholesale line sheet — it includes our full collection with pricing.

Our {{state}} retailers have been doing particularly well with our new spring styles. No pressure, just thought it might be worth a look.

Let me know!

Best,
The Jaxy Team`,
    },
  },
  C: {
    intro: {
      subject: "New wholesale eyewear brand — Jaxy",
      body: `Hi {{firstName}},

Jaxy Eyewear is a new wholesale eyewear brand offering modern, affordable frames for retailers.

Key highlights:
- Competitive wholesale pricing
- Low minimum orders
- Fast shipping from US warehouse

Interested in learning more? I can send over our catalog.

Best,
The Jaxy Team`,
    },
    follow_up: {
      subject: "Jaxy Eyewear wholesale catalog",
      body: `Hi {{firstName}},

Just a quick follow-up — would you like to see our wholesale catalog? We have a wide range of frames at great price points.

Happy to answer any questions.

Best,
The Jaxy Team`,
    },
  },
};

const TYPE_LABELS: Record<string, string> = {
  independent: "independent",
  chain: "chain",
  boutique: "boutique",
  online: "online",
  department_store: "department store",
  other: "",
};

function fillTemplate(template: EmailTemplate, ctx: CompanyContext): EmailTemplate {
  const vars: Record<string, string> = {
    "{{firstName}}": ctx.contactFirstName || "there",
    "{{lastName}}": ctx.contactLastName || "",
    "{{companyName}}": ctx.name,
    "{{city}}": ctx.city || "your area",
    "{{state}}": ctx.state || "your state",
    "{{type}}": TYPE_LABELS[ctx.type || "other"] || "",
  };

  let subject = template.subject;
  let body = template.body;

  for (const [key, val] of Object.entries(vars)) {
    subject = subject.replaceAll(key, val);
    body = body.replaceAll(key, val);
  }

  return { subject, body };
}

export function writeEmail(companyId: string, templateName: string = "intro"): EmailTemplate | null {
  const company = sqlite.prepare(`
    SELECT c.name, c.type, c.state, c.city, c.icp_tier,
      ct.first_name, ct.last_name, ct.title
    FROM companies c
    LEFT JOIN contacts ct ON ct.company_id = c.id AND ct.is_primary = 1
    WHERE c.id = ?
  `).get(companyId) as Record<string, string | null> | undefined;

  if (!company) return null;

  const ctx: CompanyContext = {
    name: company.name || "Your Store",
    type: company.type,
    state: company.state,
    city: company.city,
    icpTier: company.icp_tier,
    contactFirstName: company.first_name,
    contactLastName: company.last_name,
    contactTitle: company.title,
  };

  const tier = ctx.icpTier || "C";
  const tierTemplates = TEMPLATES[tier] || TEMPLATES.C;
  const template = tierTemplates[templateName] || tierTemplates.intro;

  return fillTemplate(template, ctx);
}
