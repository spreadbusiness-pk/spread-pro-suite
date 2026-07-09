import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals } from "./costing";

const OrderInput = z.object({
  branch_id: z.string().uuid().nullable().optional(),
  customer_id: z.string().uuid().nullable().optional(),
  quotation_ref: z.string().max(100).nullable().optional(),
  sales_person_id: z.string().uuid().nullable().optional(),
  order_date: z.string().optional(),
  delivery_date: z.string().nullable().optional(),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  status: z.string().default("new"),
  customer_remarks: z.string().max(4000).nullable().optional(),
  internal_notes: z.string().max(4000).nullable().optional(),
  paper_cost: z.number().default(0),
  ctp_cost: z.number().default(0),
  printing_cost: z.number().default(0),
  ink_cost: z.number().default(0),
  finishing_cost: z.number().default(0),
  binding_cost: z.number().default(0),
  labour_cost: z.number().default(0),
  transport_cost: z.number().default(0),
  misc_cost: z.number().default(0),
  profit_pct: z.number().default(25),
  override_selling: z.number().nullable().optional(),
});

const OrderItemInput = z.object({
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  quantity: z.number().default(1),
  unit: z.string().max(20).default("pcs"),
  specs: z.record(z.string(), z.any()).default({}),
  line_total: z.number().default(0),
});

function withTotals(values: z.infer<typeof OrderInput>) {
  const t = computeTotals(values);
  const { override_selling: _os, ...rest } = values;
  return { ...rest, ...t };
}

export const listOrders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      search: z.string().optional(),
      status: z.string().optional(),
      branch_id: z.string().uuid().optional().nullable(),
      priority: z.string().optional(),
      page: z.number().optional(),
      pageSize: z.number().optional(),
    }).parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = (context.supabase as any)
      .from("orders")
      .select("*, customer:customers(company_name,customer_code), branch:branches(name,code)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`order_no.ilike.${s},quotation_ref.ilike.${s},internal_notes.ilike.${s}`);
    }
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    if (data.branch_id) q = q.eq("branch_id", data.branch_id);
    if (data.priority && data.priority !== "all") q = q.eq("priority", data.priority);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, pageSize };
  });

export const getOrder = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const [orderRes, itemsRes, filesRes, timelineRes] = await Promise.all([
      sb.from("orders").select("*, customer:customers(*), branch:branches(*)").eq("id", data.id).maybeSingle(),
      sb.from("order_items").select("*, product:products(name)").eq("order_id", data.id).order("created_at", { ascending: true }),
      sb.from("order_files").select("*").eq("order_id", data.id).order("created_at", { ascending: false }),
      sb.from("order_timeline").select("*").eq("order_id", data.id).order("created_at", { ascending: false }),
    ]);
    if (orderRes.error) throw new Error(orderRes.error.message);
    return {
      order: orderRes.data,
      items: itemsRes.data ?? [],
      files: filesRes.data ?? [],
      timeline: timelineRes.data ?? [],
    };
  });

export const createOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ values: OrderInput, items: z.array(OrderItemInput).default([]) }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = { ...withTotals(data.values), created_by: context.userId };
    const { data: order, error } = await sb.from("orders").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    if (data.items.length) {
      const items = data.items.map((it) => ({ ...it, order_id: order.id }));
      const { error: itemsErr } = await sb.from("order_items").insert(items);
      if (itemsErr) throw new Error(itemsErr.message);
    }
    return order;
  });

export const updateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), values: OrderInput, items: z.array(OrderItemInput).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: order, error } = await sb.from("orders").update(withTotals(data.values)).eq("id", data.id).select("*").single();
    if (error) throw new Error(error.message);
    if (data.items) {
      await sb.from("order_items").delete().eq("order_id", data.id);
      if (data.items.length) {
        const rows = data.items.map((it) => ({ ...it, order_id: data.id }));
        const { error: e2 } = await sb.from("order_items").insert(rows);
        if (e2) throw new Error(e2.message);
      }
    }
    return order;
  });

export const updateOrderStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.string(), note: z.string().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { error } = await sb.from("orders").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    if (data.note) {
      await sb.from("order_timeline").insert({ order_id: data.id, status: data.status, note: data.note, actor_id: context.userId });
    }
    return { ok: true };
  });

export const deleteOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("orders").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const duplicateOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: src, error } = await sb.from("orders").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);
    const { id: _id, order_no: _n, created_at: _c, updated_at: _u, ...rest } = src;
    const { data: newOrder, error: e2 } = await sb.from("orders").insert({ ...rest, status: "new", created_by: context.userId }).select("*").single();
    if (e2) throw new Error(e2.message);
    const { data: items } = await sb.from("order_items").select("*").eq("order_id", data.id);
    if (items?.length) {
      const rows = items.map((it: any) => {
        const { id: _iid, order_id: _oid, created_at: _cc, ...r } = it;
        return { ...r, order_id: newOrder.id };
      });
      await sb.from("order_items").insert(rows);
    }
    return newOrder;
  });

export const signOrderFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await (context.supabase as any).storage
      .from("order-files")
      .createSignedUrl(data.path, 60 * 60);
    if (error) throw new Error(error.message);
    return { url: signed?.signedUrl };
  });

export const recordOrderFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      order_id: z.string().uuid(),
      path: z.string(),
      filename: z.string(),
      mime: z.string().optional().nullable(),
      size: z.number().optional().nullable(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("order_files")
      .insert({ ...data, uploaded_by: context.userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteOrderFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), path: z.string() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    await sb.storage.from("order-files").remove([data.path]);
    const { error } = await sb.from("order_files").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getOrderDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const today = new Date().toISOString().slice(0, 10);
    const [totalRes, pendingRes, todayRes, deliveredTodayRes, byBranchRes, lowStockRes] = await Promise.all([
      sb.from("orders").select("id,total_cost,selling_price,net_profit,status,branch_id", { count: "exact" }),
      sb.from("orders").select("id", { count: "exact", head: true }).not("status", "in", "(delivered,cancelled)"),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("order_date", today),
      sb.from("orders").select("id", { count: "exact", head: true }).eq("status", "delivered").gte("updated_at", `${today}T00:00:00Z`),
      sb.from("orders").select("branch_id,selling_price,net_profit,branch:branches(name,code)"),
      sb.from("papers").select("id,name,current_stock,minimum_stock"),
    ]);
    const lowStock = ((lowStockRes.data ?? []) as any[]).filter(
      (p) => Number(p.current_stock ?? 0) <= Number(p.minimum_stock ?? 0) && Number(p.minimum_stock ?? 0) > 0,
    );
    const branchAgg: Record<string, { name: string; code: string; orders: number; revenue: number; profit: number }> = {};
    for (const r of (byBranchRes.data ?? []) as any[]) {
      const key = r.branch_id ?? "unassigned";
      if (!branchAgg[key]) branchAgg[key] = { name: r.branch?.name ?? "Unassigned", code: r.branch?.code ?? "—", orders: 0, revenue: 0, profit: 0 };
      branchAgg[key].orders += 1;
      branchAgg[key].revenue += Number(r.selling_price ?? 0);
      branchAgg[key].profit += Number(r.net_profit ?? 0);
    }
    return {
      totalOrders: totalRes.count ?? 0,
      pendingOrders: pendingRes.count ?? 0,
      todayOrders: todayRes.count ?? 0,
      deliveredToday: deliveredTodayRes.count ?? 0,
      branches: Object.values(branchAgg),
      lowStock,
    };
  });
