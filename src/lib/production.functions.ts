import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PRODUCTION_STATUSES = [
  "pending",
  "ctp_plate_making",
  "paper_cutting",
  "printing",
  "finishing",
  "binding",
  "packing",
  "ready_for_delivery",
  "delivered",
] as const;

export type ProductionStatus = (typeof PRODUCTION_STATUSES)[number];

export const listProductionJobs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        status: z.string().optional(),
        priority: z.string().optional(),
        page: z.number().optional(),
        pageSize: z.number().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 50);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    const sb = context.supabase as any;
    let q = sb
      .from("production_jobs")
      .select(
        "*, machine:machines(name), order:orders(order_no,priority,delivery_date,status,branch_id,customer_id,customer:customers(company_name,customer_code),branch:branches(name,code))",
        { count: "exact" },
      )
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    let filtered = (rows ?? []) as any[];
    if (data.priority && data.priority !== "all") {
      filtered = filtered.filter((r) => r.order?.priority === data.priority);
    }
    if (data.search) {
      const s = data.search.toLowerCase();
      filtered = filtered.filter(
        (r) =>
          (r.job_no ?? "").toLowerCase().includes(s) ||
          (r.order?.order_no ?? "").toLowerCase().includes(s) ||
          (r.order?.customer?.company_name ?? "").toLowerCase().includes(s),
      );
    }
    return { rows: filtered, count: count ?? 0, page, pageSize };
  });

export const getProductionJob = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: job, error } = await sb
      .from("production_jobs")
      .select(
        "*, machine:machines(*), order:orders(*, customer:customers(*), branch:branches(*))",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!job) throw new Error("Production job not found");
    const { data: items } = await sb
      .from("order_items")
      .select("*, product:products(name,product_size,paper_type,paper_gsm,default_machine_id)")
      .eq("order_id", job.order_id);
    return { job, items: items ?? [] };
  });

export const updateProductionStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(PRODUCTION_STATUSES),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const patch: Record<string, any> = { status: data.status };
    if (data.status !== "pending") {
      const { data: existing } = await sb
        .from("production_jobs")
        .select("started_at")
        .eq("id", data.id)
        .maybeSingle();
      if (existing && !existing.started_at) patch.started_at = new Date().toISOString();
    }
    if (data.status === "delivered") patch.completed_at = new Date().toISOString();
    const { data: row, error } = await sb
      .from("production_jobs")
      .update(patch)
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const startProductionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("production_jobs")
      .update({ status: "ctp_plate_making", started_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const completeProductionJob = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: row, error } = await sb
      .from("production_jobs")
      .update({ status: "delivered", completed_at: new Date().toISOString() })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateJobDetails = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        assigned_machine_id: z.string().uuid().nullable().optional(),
        special_instructions: z.string().max(2000).nullable().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { id, ...patch } = data;
    const { data: row, error } = await sb
      .from("production_jobs")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });
