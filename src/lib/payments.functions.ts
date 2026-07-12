import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const METHODS = ["cash", "bank_transfer", "cheque", "jazzcash", "easypaisa", "online_transfer"] as const;

const PaymentInput = z.object({
  invoice_id: z.string().uuid(),
  payment_date: z.string().optional(),
  method: z.enum(METHODS).default("cash"),
  reference_no: z.string().max(200).nullable().optional(),
  amount: z.number().nonnegative(),
  notes: z.string().max(2000).nullable().optional(),
});

export const listPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        customer_id: z.string().uuid().optional(),
        invoice_id: z.string().uuid().optional(),
        method: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(200, data.pageSize ?? 50);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = (context.supabase as any)
      .from("payments")
      .select(
        "*, invoice:invoices(invoice_no, grand_total, order:orders(order_no)), customer:customers(company_name, customer_code)",
        { count: "exact" },
      )
      .order("payment_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.customer_id) q = q.eq("customer_id", data.customer_id);
    if (data.invoice_id) q = q.eq("invoice_id", data.invoice_id);
    if (data.method && data.method !== "all") q = q.eq("method", data.method);
    if (data.from) q = q.gte("payment_date", data.from);
    if (data.to) q = q.lte("payment_date", data.to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`reference_no.ilike.${s},notes.ilike.${s}`);
    }
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, pageSize };
  });

export const listInvoicesForPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ customer_id: z.string().uuid().optional() }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any)
      .from("invoices")
      .select(
        "id, invoice_no, invoice_date, grand_total, received_amount, remaining_balance, payment_status, order:orders(order_no, customer_id, customer:customers(id, company_name, customer_code))",
      )
      .not("status", "eq", "cancelled")
      .order("invoice_date", { ascending: false })
      .limit(500);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let list = (rows ?? []) as any[];
    if (data.customer_id) list = list.filter((r) => r.order?.customer_id === data.customer_id);
    return list;
  });

export const getInvoiceForPayment = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ invoice_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: inv, error } = await sb
      .from("invoices")
      .select(
        "id, invoice_no, grand_total, advance_payment, received_amount, remaining_balance, payment_status, order:orders(order_no, customer:customers(id, company_name, customer_code))",
      )
      .eq("id", data.invoice_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return inv;
  });

export const createPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => PaymentInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = {
      invoice_id: data.invoice_id,
      payment_date: data.payment_date ?? new Date().toISOString().slice(0, 10),
      method: data.method,
      reference_no: data.reference_no ?? null,
      amount: data.amount,
      notes: data.notes ?? null,
      created_by: context.userId,
    };
    const { data: row, error } = await sb.from("payments").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), values: PaymentInput.partial() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("payments")
      .update(data.values)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deletePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("payments").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getCustomerLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        customer_id: z.string().uuid(),
        from: z.string().optional(),
        to: z.string().optional(),
        payment_status: z.string().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: customer, error: ce } = await sb
      .from("customers")
      .select("*")
      .eq("id", data.customer_id)
      .maybeSingle();
    if (ce) throw new Error(ce.message);

    let invQ = sb
      .from("invoices")
      .select(
        "id, invoice_no, invoice_date, grand_total, received_amount, remaining_balance, payment_status, status, order:orders!inner(customer_id, order_no)",
      )
      .eq("order.customer_id", data.customer_id);
    if (data.from) invQ = invQ.gte("invoice_date", data.from);
    if (data.to) invQ = invQ.lte("invoice_date", data.to);
    if (data.payment_status && data.payment_status !== "all")
      invQ = invQ.eq("payment_status", data.payment_status);
    const { data: invoices, error: ie } = await invQ;
    if (ie) throw new Error(ie.message);

    let payQ = sb
      .from("payments")
      .select("id, payment_date, method, reference_no, amount, notes, invoice:invoices(invoice_no)")
      .eq("customer_id", data.customer_id);
    if (data.from) payQ = payQ.gte("payment_date", data.from);
    if (data.to) payQ = payQ.lte("payment_date", data.to);
    const { data: payments, error: pe } = await payQ;
    if (pe) throw new Error(pe.message);

    const { data: company } = await sb
      .from("company_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    return { customer, invoices: invoices ?? [], payments: payments ?? [], company };
  });
