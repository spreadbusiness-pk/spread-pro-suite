import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Filters = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  branch_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
});

export type ReportFilters = z.infer<typeof Filters>;

const n = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
};

export const getReportData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Filters.parse(d ?? {}))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;

    // ---- company / currency
    const { data: company } = await sb
      .from("company_settings")
      .select("name,address,phone,email,logo_url,currency")
      .eq("singleton", true)
      .maybeSingle();

    // ---- orders
    let oq = sb
      .from("orders")
      .select(
        "id,order_no,order_date,delivery_date,status,priority,branch_id,customer_id,total_cost,selling_price,net_profit,profit_pct,paper_cost,ctp_cost,printing_cost,die_cutting_cost,finishing_cost,binding_cost,labour_cost,transport_cost,customer:customers(company_name,customer_code),branch:branches(name,code)",
      )
      .order("order_date", { ascending: false });
    if (data.from) oq = oq.gte("order_date", data.from);
    if (data.to) oq = oq.lte("order_date", data.to);
    if (data.branch_id) oq = oq.eq("branch_id", data.branch_id);
    if (data.customer_id) oq = oq.eq("customer_id", data.customer_id);
    const { data: orders, error: oErr } = await oq;
    if (oErr) throw new Error(oErr.message);

    // ---- invoices
    let iq = sb
      .from("invoices")
      .select(
        "id,invoice_no,invoice_date,due_date,status,payment_status,subtotal,discount,grand_total,received_amount,remaining_balance,order:orders(order_no,branch_id,customer_id,customer:customers(company_name,customer_code),branch:branches(name,code))",
      )
      .order("invoice_date", { ascending: false });
    if (data.from) iq = iq.gte("invoice_date", data.from);
    if (data.to) iq = iq.lte("invoice_date", data.to);
    const { data: invRaw, error: iErr } = await iq;
    if (iErr) throw new Error(iErr.message);
    let invoices = (invRaw ?? []) as any[];
    if (data.branch_id) invoices = invoices.filter((r) => r.order?.branch_id === data.branch_id);
    if (data.customer_id) invoices = invoices.filter((r) => r.order?.customer_id === data.customer_id);

    // ---- payments
    let pq = sb
      .from("payments")
      .select(
        "id,payment_date,method,reference_no,amount,customer_id,invoice:invoices(invoice_no,order:orders(order_no,branch_id)),customer:customers(company_name,customer_code)",
      )
      .order("payment_date", { ascending: false });
    if (data.from) pq = pq.gte("payment_date", data.from);
    if (data.to) pq = pq.lte("payment_date", data.to);
    if (data.customer_id) pq = pq.eq("customer_id", data.customer_id);
    const { data: payRaw, error: pErr } = await pq;
    if (pErr) throw new Error(pErr.message);
    let payments = (payRaw ?? []) as any[];
    if (data.branch_id) payments = payments.filter((r) => r.invoice?.order?.branch_id === data.branch_id);

    // ---- production
    let jq = sb
      .from("production_jobs")
      .select(
        "id,job_no,status,created_at,machine:machines(name),order:orders(order_no,order_date,branch_id,customer_id,delivery_date,customer:customers(company_name))",
      )
      .order("created_at", { ascending: false });
    if (data.from) jq = jq.gte("created_at", data.from);
    if (data.to) jq = jq.lte("created_at", `${data.to}T23:59:59`);
    const { data: jobRaw, error: jErr } = await jq;
    if (jErr) throw new Error(jErr.message);
    let jobs = (jobRaw ?? []) as any[];
    if (data.branch_id) jobs = jobs.filter((r) => r.order?.branch_id === data.branch_id);
    if (data.customer_id) jobs = jobs.filter((r) => r.order?.customer_id === data.customer_id);

    // ---- inventory (not date scoped — current position)
    const { data: invItems } = await sb
      .from("inventory_items")
      .select("id,name,category,brand,size,paper_type,paper_gsm,unit,current_stock,minimum_stock,purchase_rate,supplier,active");

    const ordersList = (orders ?? []) as any[];

    const sales = {
      count: ordersList.length,
      revenue: ordersList.reduce((s, o) => s + n(o.selling_price), 0),
      cost: ordersList.reduce((s, o) => s + n(o.total_cost), 0),
      profit: ordersList.reduce((s, o) => s + n(o.net_profit), 0),
    };

    const invoiced = invoices.reduce((s, i) => s + n(i.grand_total), 0);
    const received = invoices.reduce((s, i) => s + n(i.received_amount), 0);
    const outstanding = invoices.reduce((s, i) => s + n(i.remaining_balance), 0);

    return {
      company: company ?? null,
      currency: company?.currency ?? "PKR",
      orders: ordersList,
      invoices,
      payments,
      jobs,
      inventory: (invItems ?? []) as any[],
      summary: {
        ...sales,
        invoiced,
        received,
        outstanding,
        paymentsTotal: payments.reduce((s, p) => s + n(p.amount), 0),
        jobsTotal: jobs.length,
      },
    };
  });
