import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InvoiceInput = z.object({
  order_id: z.string().uuid(),
  invoice_date: z.string().optional(),
  due_date: z.string().nullable().optional(),
  status: z.enum(["draft", "issued", "paid", "cancelled"]).default("draft"),
  discount: z.number().default(0),
  advance_payment: z.number().default(0),
  received_amount: z.number().default(0),
  terms: z.string().max(4000).nullable().optional(),
});

const InvoiceUpdate = InvoiceInput.partial().extend({
  order_id: z.string().uuid().optional(),
});

async function computeFromOrder(sb: any, order_id: string, discount = 0) {
  const { data: order, error } = await sb
    .from("orders")
    .select("id, selling_price")
    .eq("id", order_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!order) throw new Error("Order not found");
  const subtotal = Number(order.selling_price ?? 0);
  const grand = Math.max(subtotal - Number(discount ?? 0), 0);
  return { subtotal, grand_total: grand };
}

export const listInvoices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        payment_status: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = (context.supabase as any)
      .from("invoices")
      .select(
        "*, order:orders(order_no, customer:customers(company_name, customer_code))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`invoice_no.ilike.${s}`);
    }
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.payment_status && data.payment_status !== "all")
      q = q.eq("payment_status", data.payment_status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, pageSize };
  });

export const getInvoice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: invoice, error } = await sb
      .from("invoices")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!invoice) return null;
    // Always read latest order data — do not duplicate
    const { data: order } = await sb
      .from("orders")
      .select("*, customer:customers(*), branch:branches(*)")
      .eq("id", invoice.order_id)
      .maybeSingle();
    const { data: items } = await sb
      .from("order_items")
      .select("*, product:products(name, paper_type, paper_gsm, product_size)")
      .eq("order_id", invoice.order_id)
      .order("created_at", { ascending: true });
    const { data: company } = await sb
      .from("company_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    return { invoice, order, items: items ?? [], company };
  });

export const listInvoiceableOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("orders")
      .select("id, order_no, selling_price, status, customer:customers(company_name)")
      .not("status", "eq", "cancelled")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => InvoiceInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { subtotal, grand_total } = await computeFromOrder(sb, data.order_id, data.discount);
    const payload = {
      order_id: data.order_id,
      invoice_date: data.invoice_date ?? new Date().toISOString().slice(0, 10),
      due_date: data.due_date ?? null,
      status: data.status ?? "draft",
      discount: data.discount ?? 0,
      advance_payment: data.advance_payment ?? 0,
      received_amount: data.received_amount ?? 0,
      terms: data.terms ?? null,
      subtotal,
      grand_total,
      invoice_no: "",
      created_by: context.userId,
    };
    const { data: row, error } = await sb.from("invoices").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), values: InvoiceUpdate }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing, error: e0 } = await sb
      .from("invoices")
      .select("order_id, discount")
      .eq("id", data.id)
      .single();
    if (e0) throw new Error(e0.message);
    const discount = data.values.discount ?? Number(existing.discount ?? 0);
    // Always recompute subtotal + grand_total from the latest order (no duplication)
    const { subtotal, grand_total } = await computeFromOrder(sb, existing.order_id, discount);
    const patch: any = { ...data.values, subtotal, grand_total };
    delete patch.order_id;
    const { data: row, error } = await sb
      .from("invoices")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInvoice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("invoices")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
