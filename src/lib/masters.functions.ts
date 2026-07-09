import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ALLOWED = [
  "products",
  "product_categories",
  "machines",
  "papers",
  "ctp_plates",
  "finishing_options",
  "binding_options",
  "labour_rates",
  "transport_rates",
] as const;

const TableName = z.enum(ALLOWED);

export const listMaster = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: TableName, branch_id: z.string().uuid().nullable().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    let q = (context.supabase as any).from(data.table).select("*").order("created_at", { ascending: false });
    if (data.branch_id && (data.table === "machines" || data.table === "papers")) {
      q = q.eq("branch_id", data.branch_id);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const upsertMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({
      table: TableName,
      id: z.string().uuid().optional().nullable(),
      values: z.record(z.string(), z.any()),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.id) {
      const { data: row, error } = await sb.from(data.table).update(data.values).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await sb.from(data.table).insert(data.values).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteMaster = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ table: TableName, id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
