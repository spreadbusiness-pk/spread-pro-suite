import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CustomerInput = z.object({
  company_name: z.string().trim().min(1).max(200),
  customer_name: z.string().trim().min(1).max(200),
  mobile: z.string().trim().max(40).optional().nullable(),
  whatsapp: z.string().trim().max(40).optional().nullable(),
  email: z.string().trim().email().max(200).optional().or(z.literal("")).nullable(),
  address: z.string().trim().max(500).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  business_type: z.string().trim().max(100).optional().nullable(),
  gst_ntn: z.string().trim().max(100).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const listCustomers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; status?: string; page?: number; pageSize?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    const page = Math.max(1, data.page ?? 1);
    const pageSize = Math.min(100, data.pageSize ?? 20);
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let q = context.supabase
      .from("customers")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(
        `company_name.ilike.${s},customer_name.ilike.${s},mobile.ilike.${s},email.ilike.${s},customer_code.ilike.${s}`,
      );
    }
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, count, error } = await q;
    if (error) throw new Error(error.message);
    return { rows: rows ?? [], count: count ?? 0, page, pageSize };
  });

export const getCustomer = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const createCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => CustomerInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = {
      ...data,
      email: data.email || null,
      created_by: context.userId,
      customer_code: "",
    };
    const { data: row, error } = await context.supabase
      .from("customers")
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), values: CustomerInput }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("customers")
      .update({ ...data.values, email: data.values.email || null })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("customers").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDashboardStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { count: totalCustomers } = await context.supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    const { count: activeCustomers } = await context.supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("status", "active");
    const { data: recent } = await context.supabase
      .from("customers")
      .select("id,customer_code,company_name,created_at,status")
      .order("created_at", { ascending: false })
      .limit(6);
    return {
      totalCustomers: totalCustomers ?? 0,
      activeCustomers: activeCustomers ?? 0,
      recentCustomers: recent ?? [],
    };
  });
