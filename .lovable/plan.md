# Spread Business ERP & CRM — Phase 1 Plan

Build the foundation of a real, extensible ERP/CRM (not a demo). Phase 1 focuses on: branding/design system, auth with roles, customer management (full CRUD), company settings, dashboard shell, and the sidebar navigation for future phases.

## 1. Backend (Lovable Cloud / Supabase)

Enable Lovable Cloud, then create schema via migration:

- `app_role` enum: `super_admin | admin | sales | designer | production | delivery | accountant`
- `profiles` (id → auth.users, full_name, phone, avatar_url, created_at)
- `user_roles` (id, user_id, role) + `has_role()` security-definer
- `customers` (id, customer_code, company_name, customer_name, mobile, whatsapp, email, address, city, business_type, gst_ntn, notes, status, created_by, created_at, updated_at)
- `company_settings` (singleton row: logo_url, name, phone, whatsapp, email, website, address, currency, timezone)
- RLS + GRANTs for all tables
- Auto-create profile trigger on signup; first signup becomes `super_admin`
- Storage buckets: `avatars`, `company-assets`

## 2. Design System (`src/styles.css`)

Luxury corporate tokens in oklch:
- Primary `#0B2F7A`, Secondary `#071B4A`, Gold accent `#D4AF37`
- Glass surfaces (`--glass-bg`, `--glass-border`), soft elevation shadows, gold gradient token
- Full light + dark palettes; radius scale bumped for rounded cards
- Serif display font (Playfair Display) + Inter body via `<link>` in `__root.tsx`

## 3. Routes

```
/auth                      sign in / sign up / forgot password
/reset-password            recovery flow
/_authenticated/           protected layout (managed)
  index                    dashboard
  customers                list + search + filter + pagination
  customers/new
  customers/$id            details + edit
  orders                   Phase 2 placeholder page
  quotations               Phase 2 placeholder
  invoices                 Phase 2 placeholder
  production               Phase 2 placeholder
  inventory                Phase 2 placeholder
  reports                  Phase 2 placeholder
  users                    admin-only: list users + assign roles
  settings                 company settings + profile + change password
```

Phase-2 pages ship as clean "Coming in Phase 2" screens with the sidebar wired so future work drops in.

## 4. UI Shell

- `AppSidebar` (shadcn sidebar, collapsible icon mode, gold active accent, role-aware items)
- Topbar: search, theme toggle (light/dark), notifications placeholder, profile menu
- Dashboard cards: Today's Orders, Pending, Completed, Monthly Sales, Today's Revenue, Pending Payments, Total Customers (Phase 1 shows real customer count + zeroed metrics with tooltips "activates in Phase 2"), Recent Activity, Monthly Sales chart (Recharts), Quick Actions
- Customers: table with search/filter/pagination, add/edit sheet, detail drawer, delete confirm
- Settings: company form + logo upload + profile + change password
- Skeletons, toasts (sonner), confirm dialogs (AlertDialog)

## 5. Server Functions

- `listCustomers`, `getCustomer`, `createCustomer`, `updateCustomer`, `deleteCustomer` — `requireSupabaseAuth`
- `getCompanySettings`, `updateCompanySettings` — admin-only
- `listUsers`, `assignRole` — super_admin/admin only
- `getDashboardStats` — customer count now; extensible for orders/revenue

## 6. Deploy

Final message includes: publish via Publish button, connect custom domain, first user auto-promoted to super_admin, how to add other users.

## Notes
- No demo data seeded — real empty state.
- Google sign-in NOT added (spec asks for email login + forgot password only).
- Everything typed, RLS enforced, keys/roles never client-trusted.

Confirm and I'll build.