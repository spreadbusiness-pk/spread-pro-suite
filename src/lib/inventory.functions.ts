import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const INVENTORY_CATEGORIES = [
  "paper",
  "ctp_plates",
  "ink",
  "lamination",
  "finishing",
  "binding",
  "packaging",
  "other",
] as const;
export type InventoryCategory = (typeof INVENTORY_CATEGORIES)[number];

export const CATEGORY_LABEL: Record<InventoryCategory, string> = {
  paper: "Paper",
  ctp_plates: "CTP Plates",
  ink: "Ink",
  lamination: "Lamination",
  finishing: "Finishing Materials",
  binding: "Binding Materials",
  packaging: "Packaging Materials",
  other: "Other Materials",
};

const ItemInput = z.object({
  category: z.enum(INVENTORY_CATEGORIES),
  name: z.string().trim().min(1).max(200),
  brand: z.string().trim().max(200).nullable().optional(),
  size: z.string().trim().max(200).nullable().optional(),
  paper_gsm: z.number().nullable().optional(),
  paper_type: z.string().trim().max(100).nullable().optional(),
  unit: z.string().trim().max(50).default("pcs"),
  opening_stock: z.number().nonnegative().default(0),
  minimum_stock: z.number().nonnegative().default(0),
  purchase_rate: z.number().nonnegative().default(0),
  supplier: z.string().trim().max(200).nullable().optional(),
  remarks: z.string().trim().max(2000).nullable().optional(),
  active: z.boolean().default(true),
  batch_number: z.string().trim().max(100).nullable().optional(),
  barcode: z.string().trim().max(100).nullable().optional(),
});

export const listInventoryItems = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        search: z.string().optional(),
        category: z.string().optional(),
        paper_type: z.string().optional(),
        gsm: z.string().optional(),
        supplier: z.string().optional(),
        status: z.string().optional(),
        low_only: z.boolean().optional(),
        out_only: z.boolean().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb.from("inventory_items").select("*").order("created_at", { ascending: false });
    if (data.category && data.category !== "all") q = q.eq("category", data.category);
    if (data.paper_type && data.paper_type !== "all") q = q.eq("paper_type", data.paper_type);
    if (data.gsm && data.gsm !== "all") q = q.eq("paper_gsm", Number(data.gsm));
    if (data.supplier && data.supplier !== "all") q = q.eq("supplier", data.supplier);
    if (data.status === "active") q = q.eq("active", true);
    if (data.status === "inactive") q = q.eq("active", false);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`name.ilike.${s},brand.ilike.${s},size.ilike.${s},supplier.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    let list = (rows ?? []) as any[];
    if (data.low_only) list = list.filter((r) => Number(r.current_stock) <= Number(r.minimum_stock) && Number(r.current_stock) > 0);
    if (data.out_only) list = list.filter((r) => Number(r.current_stock) <= 0);
    return list;
  });

export const getInventorySummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb.from("inventory_items").select("category,current_stock,minimum_stock,purchase_rate,active");
    if (error) throw new Error(error.message);
    const list = (rows ?? []) as any[];
    const byCat: Record<string, { qty: number; value: number; count: number }> = {};
    let totalValue = 0;
    let lowStock = 0;
    let outStock = 0;
    for (const r of list) {
      const cs = Number(r.current_stock ?? 0);
      const rate = Number(r.purchase_rate ?? 0);
      totalValue += cs * rate;
      if (cs <= 0) outStock++;
      else if (cs <= Number(r.minimum_stock ?? 0)) lowStock++;
      const c = r.category as string;
      byCat[c] = byCat[c] ?? { qty: 0, value: 0, count: 0 };
      byCat[c].qty += cs;
      byCat[c].value += cs * rate;
      byCat[c].count += 1;
    }
    return { totalValue, lowStock, outStock, totalItems: list.length, byCat };
  });

export const upsertInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid().nullable().optional(), values: ItemInput }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    if (data.id) {
      const { data: row, error } = await sb.from("inventory_items").update(data.values).eq("id", data.id).select("*").single();
      if (error) throw new Error(error.message);
      return row;
    }
    const payload = { ...data.values, created_by: context.userId };
    const { data: row, error } = await sb.from("inventory_items").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteInventoryItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("inventory_items").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const MovementInput = z.object({
  item_id: z.string().uuid(),
  movement_type: z.enum(["in", "out", "adjustment"]),
  quantity: z.number().refine((v) => v !== 0, "Quantity cannot be zero"),
  movement_date: z.string().optional(),
  reference_no: z.string().max(200).nullable().optional(),
  reason: z.string().max(2000).nullable().optional(),
});

export const listStockMovements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        item_id: z.string().uuid().optional(),
        movement_type: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        search: z.string().optional(),
        limit: z.number().optional(),
      })
      .parse(d ?? {}),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    let q = sb
      .from("stock_movements")
      .select("*, item:inventory_items(name,unit,category)")
      .order("movement_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(Math.min(1000, data.limit ?? 500));
    if (data.item_id) q = q.eq("item_id", data.item_id);
    if (data.movement_type && data.movement_type !== "all") q = q.eq("movement_type", data.movement_type);
    if (data.from) q = q.gte("movement_date", data.from);
    if (data.to) q = q.lte("movement_date", data.to);
    if (data.search) {
      const s = `%${data.search}%`;
      q = q.or(`reference_no.ilike.${s},reason.ilike.${s}`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as any[];
  });

export const createStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => MovementInput.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const payload = {
      item_id: data.item_id,
      movement_type: data.movement_type,
      quantity: Math.abs(data.quantity) * (data.movement_type === "adjustment" && data.quantity < 0 ? -1 : 1),
      movement_date: data.movement_date ?? new Date().toISOString().slice(0, 10),
      reference_type: "manual",
      reference_no: data.reference_no ?? null,
      reason: data.reason ?? null,
      created_by: context.userId,
    };
    const { data: row, error } = await sb.from("stock_movements").insert(payload).select("*").single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteStockMovement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase as any).from("stock_movements").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
