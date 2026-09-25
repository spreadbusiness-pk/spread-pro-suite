import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BranchInput = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  phone: z.string().trim().max(50).nullable().optional(),
  whatsapp: z.string().trim().max(50).nullable().optional(),
  email: z.string().trim().max(200).nullable().optional(),
  manager_id: z.string().uuid().nullable().optional(),
  currency: z.string().trim().max(10).default("PKR"),
  status: z.string().trim().max(20).default("active"),
  active: z.boolean().default(true),
});

export const listBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context.supabase as any)
      .from("branches")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []) as any[];
  });

export const createBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => BranchInput.parse(d))
  .handler(async ({ data, context }) => {
    const payload = { ...data, code: data.code.toUpperCase() };
    const { data: row, error } = await (context.supabase as any)
      .from("branches")
      .insert(payload)
      .select("*")
      .single();
    if (error) {
      if (/row-level security/i.test(error.message)) {
        return { ok: false as const, error: "You do not have permission to create branches. Only an admin can add a branch." };
      }
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const, row };
  });

export const updateBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), values: BranchInput }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase as any)
      .from("branches")
      .update({ ...data.values, code: data.values.code.toUpperCase() })
      .eq("id", data.id)
      .select("*")
      .single();
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const, row };
  });

export const deleteBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("branches").delete().eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });

export const toggleBranch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any)
      .from("branches")
      .update({ active: data.active, status: data.active ? "active" : "inactive" })
      .eq("id", data.id);
    if (error) return { ok: false as const, error: error.message };
    return { ok: true as const };
  });
