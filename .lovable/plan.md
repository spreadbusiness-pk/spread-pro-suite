# Spread Business ERP — Phase 2 Plan

Extend the existing Phase 1 foundation into a full printing & packaging ERP with multi-branch, order management, and a costing engine. All existing pages, auth, RLS patterns and design system stay intact.

## 1. Database (single migration)

New tables (all with RLS + GRANTs, `branch_id` scoping where applicable, `has_branch_access()` security-definer helper):

- `branches` — code, name, address, city, phone, whatsapp, email, manager_id, currency, status, active
- `user_branches` — user_id, branch_id (many-to-many; super_admin sees all)
- `product_categories` and `products` — category, name, description, default_unit, default_formula (jsonb), active
- `machines` — name, type, manufacturer, model, colors, min/max sheet size, speed, setup_time, cost_per_hour, cost_per_sheet, electricity_cost, maintenance_cost, status, branch_id
- `papers` — name, brand, gsm, sheet_size, purchase_rate, selling_rate, current_stock, min_stock, branch_id
- `ctp_plates` — name, size, cost, supplier
- `finishing_options` — name, rate, unit, active
- `binding_options` — name, rate, unit, active
- `labour_rates` — type, rate, unit
- `transport_rates` — type, rate, unit
- `orders` — order_no (auto `SP-<BRANCHCODE>-000001` via sequence-per-branch), branch_id, customer_id, quotation_ref, sales_person_id, order_date, delivery_date, priority, status, customer_remarks, internal_notes, totals (paper/ctp/print/ink/finishing/binding/labour/transport/misc costs, total_cost, profit_pct, selling_price, net_profit), created_by
- `order_items` — order_id, product_id, qty, specs (jsonb: size, colors, sides, gsm, paper_id, machine_id, plates, finishings[], bindings[]), line totals
- `order_files` — order_id, path, filename, mime, size, uploaded_by
- `order_timeline` — order_id, status, note, actor_id, created_at

Existing tables get a nullable `branch_id` column (backfill left to admin) and updated RLS: super_admin/admin see all, others limited to `has_branch_access(branch_id)`.

Storage bucket `order-files` (private) for artwork uploads (PDF/AI/CDR/PSD/EPS/JPG/PNG/ZIP).

Auto order number via `nextval('order_seq_' || branch_code)` created lazily by trigger.

## 2. Server functions (`src/lib/*.functions.ts`)

All under `requireSupabaseAuth`:
- `branches.functions.ts` — list/get/create/update/delete/toggle
- `masters.functions.ts` — CRUD for products, categories, machines, papers, plates, finishings, bindings, labour, transport
- `orders.functions.ts` — list (filters: branch/status/customer/date/priority/search), get, create, update, delete, duplicate, updateStatus, uploadFile, listFiles
- `costing.ts` — pure helpers computing cost breakdown from order_items + master rates (called client + server)
- `dashboard.functions.ts` — extended with branch-scoped metrics

## 3. Routes / UI

New under `_authenticated/`:
- `branches/` — list + sheet form (admin only)
- `masters/` — tabbed page: Products, Machines, Papers, CTP, Finishing, Binding, Labour, Transport
- `orders/` — list with advanced filters, pagination, search
- `orders/new` — full order builder (branch → customer → items → specs → live costing panel → files → save)
- `orders/$id` — details, edit, duplicate, print job card, artwork upload, timeline, status changer
- Update `dashboard` (index) — branch selector + branch-wise sales/orders/revenue/profit cards, pending orders, machine utilization, today's production/delivery, low stock alerts, Recharts breakdown

Existing customers/settings/users pages get an optional `branch_id` field.

Sidebar gets: Branches, Masters (grouped), and expanded Orders.

## 4. Costing engine

Client-side reactive calculator on the order form:
```
paperCost   = sheets * paper.purchase_rate
ctpCost     = plates * ctp.cost
printCost   = impressions * machine.cost_per_sheet + setup_hours * machine.cost_per_hour
finishing   = Σ finishing.rate * qty
binding     = Σ binding.rate * qty
labour      = Σ labour.rate * hours
transport   = Σ transport.rate
misc        = user input
total       = sum(above)
selling     = total * (1 + profit_pct/100)   OR   user-set price
net_profit  = selling - total
```
Stored on the order row; recomputed on save server-side to prevent tampering.

## 5. File uploads

Private `order-files` bucket, signed URLs. Client accepts the listed extensions, 25 MB per file cap.

## 6. Job Card

Printable A4 view at `/orders/$id/job-card` (route + `window.print()`), showing full specs, materials, machine, finishings, cost summary, delivery info.

## 7. Order status pipeline

Enum `order_status` with the 15 states from the spec. Timeline auto-writes on every status change (actor + note).

## 8. Access rules

- `super_admin` / `admin`: all branches
- Branch manager (new `branch_manager` role added to `app_role`) + staff: only rows where `branch_id` is in their `user_branches`
- All new tables enforce this via `has_branch_access(branch_id)` security-definer function

## Notes / assumptions

- No demo data seeded — real empty state; you create your first branch, then everything else.
- Ink cost tracked as a line on order (no separate ink master this phase — can extend later).
- Quotations page stays "coming soon" for now (order has a free-text `quotation_ref`); quotation module is a natural Phase 3.
- Everything typed end-to-end, RLS enforced, keys/roles never trusted from client.

Confirm and I'll build it in one pass.
