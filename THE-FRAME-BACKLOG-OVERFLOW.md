# The Frame — Backlog Overflow

> Issues that couldn't be created in Linear (free plan 250-issue limit hit).
> When space opens up, create these as Linear tickets.

## Sales Module — Missing Features

### Prospects — Enrichment UI + Outscraper integration (P2)
Labels: bubbe, frontend, backend, integration
Enrichment engine exists (sales/lib/enrichment.ts) but no UI. Add Enrich button on prospect detail, bulk enrich from list, wire to /api/v1/sales/enrich, configure Outscraper key in settings.

### Pipeline — Deal detail page wired to real data (P2)
Labels: bubbe, frontend
Wire deal-detail.tsx to /api/v1/sales/deals/[id], activity timeline with notes/emails/calls, add activity form, snooze, stage change tracking.

### Pipeline — Create new deal from prospect (P2)
Labels: bubbe, frontend
No Create Deal flow. Add button on prospect detail + pipeline page. Dialog: select stage, set value, add note. POST to /api/v1/sales/deals. Auto-link company_id.

### Campaigns — Instantly sync wiring (P2)
Labels: bubbe, backend, integration
Instantly client (226L) + sync (170L) exist but not connected. Wire sync endpoint, link campaign IDs, auto-sync stats, configure API key in settings.

### Campaigns — Reply inbox with response classification (P2)
Labels: bubbe, frontend, backend, ai-agent
Reply inbox + response-classifier agent exist but disconnected. Wire inbox to fetch replies, auto-classify, action buttons (qualify/reply/dismiss).

### Campaigns — Lead ICP classification (P3)
Labels: bubbe, frontend, backend, ai-agent
ICP classifier agent (214L) + API exist. Wire auto-classify on import, show score on lead detail, bulk classify, configure ICP criteria.

## Orders Module — Missing Features

### Orders — Detail page with line items + fulfillment (P2)
Labels: bubbe, frontend, backend
Create /orders/[id] detail page. Line items table, fulfillment workflow (ship/track), returns section, status timeline. Wire to fulfillment.ts engine.

### Orders — Shopify webhook order sync (P1)
Labels: bubbe, backend, integration
Handler exists (251L). Register webhooks, handle orders/create+updated+cancelled, auto-sync to DB, sync fulfillment back.

### Orders — Faire order sync (P1)
Labels: bubbe, backend, integration
Faire sync engine exists (154L). Add periodic polling, map Faire format to schema, create orders + line items, handle net terms.

### Orders — Manual order creation UI (P2)
Labels: bubbe, frontend
POST API exists but no UI. Create Order dialog: select customer, add line items from catalog, set terms, calculate totals.

## Inventory Module — Missing Features

### Inventory — Stock sync from Shopify + Faire (P1)
Labels: bubbe, backend, integration
Schema exists but data empty. Sync Shopify inventory, record movements on orders, low stock alerts, reorder points.

### Inventory — Purchase order lifecycle completion (P2)
Labels: bubbe, frontend, backend
PO pages exist. Add PDF gen, mark sent, receive shipment (partial/full + QC), auto-update inventory on receipt.

### Inventory — QC inspection forms (P3)
Labels: bubbe, frontend
QC schema + API exist, no UI. Inspection form per PO: defect rate, photos, pass/fail. History on PO detail. Alert on high defects.

### Inventory — Demand forecasting wired to UI (P3)
Labels: bubbe, frontend, backend, ai-agent
Agent (189L) exists. Run forecast from dashboard, chart per SKU, suggest reorder quantities, confidence intervals.

## Finance Module — Missing Features

### Finance — Settlement reconciliation dashboard (P2)
Labels: bubbe, frontend, backend
Settlement schema + sync engines (412L combined) exist. Wire page to real data, reconciliation view, flag discrepancies, manual adjustments.

### Finance — Expense management full UI (P2)
Labels: bubbe, frontend
APIs exist but need: list with filters, create/edit form, categories, receipt upload, monthly summary chart.

### Finance — P&L report generation (P2)
Labels: bubbe, frontend, backend
P&L engine exists (165L). Wire to generate from orders + expenses, by channel, date range, export CSV/PDF, period comparison.

### Finance — Cash flow forecast from real data (P2)
Labels: bubbe, frontend, backend, ai-agent
Engine (149L) + predictor agent (149L) exist. Wire to settlements + expenses, 12-week projection, scenario modeling, cash shortage alerts.

### Finance — Xero integration (P3)
Labels: bubbe, backend, integration
Xero client (225L) exists. Add OAuth flow, settings config, auto-sync invoices, pull chart of accounts, map categories.

## Customers Module — Missing Features

### Customers — Detail page with health + orders + timeline (P2)
Labels: bubbe, frontend
Wire /customers/[id] to real data. Health history chart, order list, reorder predictions, communication log.

### Customers — Auto account creation from orders (P2)
Labels: bubbe, backend
Wire account-sync.ts to auto-create customer accounts on first order. Calculate lifetime value, track order frequency.

### Customers — Churn prediction agent wired to UI (P3)
Labels: bubbe, frontend, backend, ai-agent
Churn predictor agent exists. Show risk scores on customer list, alert on churning accounts, suggested actions.

### Customers — Reorder prediction + reminders (P3)
Labels: bubbe, frontend, backend, ai-agent
Reorder engine exists. Show next reorder date, send reminders via notification system, track accuracy.

## Marketing Module — Missing Features

### Marketing — Content calendar CRUD + scheduling (P2)
Labels: bubbe, frontend, backend
Content calendar tab fetches data but needs full CRUD. Create/edit/delete content items, drag-and-drop reschedule.

### Marketing — Social media dashboard (P2)
Labels: bubbe, frontend
Social media tab is 123L stub. Add platform cards (Instagram, TikTok, Pinterest), post composer, engagement metrics.

### Marketing — SEO dashboard with keyword tracking (P2)
Labels: bubbe, frontend, backend
SEO tab exists (135L). Wire to seo_keywords table, add/track keywords, rank tracking, content suggestions.

### Marketing — Ad spend tracking dashboard (P2)
Labels: bubbe, frontend, backend
Ads tab is 21L stub. Campaign list, spend/ROAS tracking, budget management, platform breakdown.

### Marketing — Influencer management with outreach tracking (P2)
Labels: bubbe, frontend, backend
Influencer tab is 24L stub. Influencer list, outreach status, product seeding tracker, content tracking, ROI.

### Marketing — Klaviyo integration + flow status (P3)
Labels: bubbe, frontend, backend, integration
Klaviyo tab is 36L stub, client exists (71L). Wire to show flow status, subscriber growth, email performance.

## Intelligence + AI + Infrastructure

### Intelligence — Sell-through analytics from real data (P2)
Labels: bubbe, frontend, backend
Hardcoded mock data. Wire to sell-through API. Date range filters, velocity calculations, dead stock alerts.

### Intelligence — Trend detection agent wired to UI (P3)
Labels: bubbe, frontend, backend, ai-agent
Trend detector (27L stub) needs implementation + UI. Detect trends, declining products, seasonal patterns.

### Intelligence — Business health score (P3)
Labels: bubbe, backend, ai-agent
business-health.ts (31L stub). Composite score from sales velocity, cash flow, inventory health, retention.

### AI Center — Wire agent dashboard to real job queue (P2)
Labels: bubbe, frontend, backend
Mock agent list. Wire to jobs + agent_runs tables. Real status, token usage, run history, enable/disable.

### AI Center — Agent execution engine (P2)
Labels: bubbe, backend, ai-agent
Agent orchestrator (196L) exists but agents use mock data. Wire execution: schedule runs, track tokens/cost.

### Dashboard — Wire all summary cards to real data (P1)
Labels: bubbe, frontend, backend
Dashboard may use mock aggregations. Wire: total prospects, active deals, pending orders, revenue, inventory value.

### Auth — Role-based access control enforcement (P3)
Labels: bubbe, frontend, backend, infrastructure
Users have roles but no enforcement. Add middleware checks per route, hide UI elements by role.

### Settings — API key validation + test connection (P2)
Labels: bubbe, frontend, backend
Settings page has key inputs but no validation. Add Test Connection buttons for each integration.
