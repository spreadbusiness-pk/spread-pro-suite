import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Plus, Pencil, Trash2, Search, AlertTriangle, Package, Boxes, Layers, Droplet,
  Sparkles, BookMarked, Boxes as BoxesIcon, ArrowDownToLine, ArrowUpFromLine, RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  INVENTORY_CATEGORIES, CATEGORY_LABEL, listInventoryItems, getInventorySummary,
  upsertInventoryItem, deleteInventoryItem, listStockMovements, createStockMovement,
  deleteStockMovement, type InventoryCategory,
} from "@/lib/inventory.functions";
import { formatCurrency } from "@/lib/costing";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/inventory")({ component: InventoryPage });

const CATEGORY_ICONS: Record<InventoryCategory, React.ComponentType<{ className?: string }>> = {
  paper: Layers,
  ctp_plates: BoxesIcon,
  ink: Droplet,
  lamination: Sparkles,
  finishing: Sparkles,
  binding: BookMarked,
  packaging: Package,
  other: Boxes,
};

function InventoryPage() {
  const [tab, setTab] = useState<string>("dashboard");

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Stock</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Inventory</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Paper, plates, ink, finishing &amp; consumables — with live stock movement and auto-deduction from production.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="movements">Stock Movement</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <DashboardPanel onNavigate={setTab} />
        </TabsContent>
        <TabsContent value="items" className="space-y-6">
          <ItemsPanel />
        </TabsContent>
        <TabsContent value="movements" className="space-y-6">
          <MovementsPanel />
        </TabsContent>
        <TabsContent value="reports" className="space-y-6">
          <ReportsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------------- DASHBOARD ---------------- */

function DashboardPanel({ onNavigate }: { onNavigate: (t: string) => void }) {
  const fetchSummary = useServerFn(getInventorySummary);
  const { data, isLoading } = useQuery({ queryKey: ["inv-summary"], queryFn: () => fetchSummary() });

  const s = data ?? { totalValue: 0, lowStock: 0, outStock: 0, totalItems: 0, byCat: {} as Record<string, { qty: number; value: number; count: number }> };
  const cat = (c: InventoryCategory) => s.byCat?.[c] ?? { qty: 0, value: 0, count: 0 };

  const stats: { label: string; value: string; hint?: string; tone?: "default" | "warn" | "danger" }[] = [
    { label: "Total Inventory Value", value: formatCurrency(s.totalValue), hint: `${s.totalItems} items` },
    { label: "Total Paper Stock", value: `${cat("paper").qty.toLocaleString()} units`, hint: `${cat("paper").count} items` },
    { label: "Total Plates", value: `${cat("ctp_plates").qty.toLocaleString()} units`, hint: `${cat("ctp_plates").count} items` },
    { label: "Total Ink", value: `${cat("ink").qty.toLocaleString()} units`, hint: `${cat("ink").count} items` },
    { label: "Total Finishing", value: `${cat("finishing").qty.toLocaleString()} units`, hint: `${cat("finishing").count} items` },
    { label: "Low Stock Items", value: String(s.lowStock), tone: s.lowStock > 0 ? "warn" : "default" },
    { label: "Out of Stock Items", value: String(s.outStock), tone: s.outStock > 0 ? "danger" : "default" },
  ];

  return (
    <div className="space-y-6">
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((st) => (
            <Card key={st.label} className={cn(
              "p-4 shadow-elevated",
              st.tone === "warn" && "border-amber-500/40 bg-amber-500/5",
              st.tone === "danger" && "border-destructive/50 bg-destructive/5",
            )}>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">{st.label}</div>
              <div className="mt-2 font-display text-2xl font-bold">{st.value}</div>
              {st.hint && <div className="mt-1 text-xs text-muted-foreground">{st.hint}</div>}
            </Card>
          ))}
        </div>
      )}

      <Card className="p-4 shadow-elevated">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-display text-lg font-semibold">Stock by category</div>
          <Button size="sm" variant="ghost" onClick={() => onNavigate("items")}>Manage items →</Button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {INVENTORY_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICONS[c];
            const v = cat(c);
            return (
              <div key={c} className="flex items-center gap-3 rounded-lg border bg-card p-3">
                <div className="grid h-10 w-10 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{CATEGORY_LABEL[c]}</div>
                  <div className="text-xs text-muted-foreground">{v.count} items · {formatCurrency(v.value)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ---------------- ITEMS ---------------- */

function ItemsPanel() {
  const qc = useQueryClient();
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [paperType, setPaperType] = useState("all");
  const [gsm, setGsm] = useState("all");
  const [supplier, setSupplier] = useState("all");
  const [editing, setEditing] = useState<any | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const fetchList = useServerFn(listInventoryItems);
  const delFn = useServerFn(deleteInventoryItem);

  const { data, isLoading } = useQuery({
    queryKey: ["inv-items", category, search, status, paperType, gsm, supplier],
    queryFn: () => fetchList({
      data: {
        search: search || undefined,
        category,
        status,
        paper_type: paperType,
        gsm,
        supplier,
      },
    }),
  });

  const rows = (data ?? []) as any[];

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv-items"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      toast.success("Item deleted");
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  // dynamic filter options from data
  const paperTypes = useMemo(() => Array.from(new Set(rows.map((r) => r.paper_type).filter(Boolean))), [rows]);
  const gsms = useMemo(() => Array.from(new Set(rows.map((r) => r.paper_gsm).filter((v) => v != null))).sort((a, b) => Number(a) - Number(b)), [rows]);
  const suppliers = useMemo(() => Array.from(new Set(rows.map((r) => r.supplier).filter(Boolean))), [rows]);

  return (
    <Card className="overflow-hidden shadow-elevated">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search name / brand / supplier" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paperType} onValueChange={setPaperType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="Paper type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All paper types</SelectItem>
            {paperTypes.map((p: any) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={gsm} onValueChange={setGsm}>
          <SelectTrigger className="w-28"><SelectValue placeholder="GSM" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All GSM</SelectItem>
            {gsms.map((g: any) => <SelectItem key={String(g)} value={String(g)}>{g}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={supplier} onValueChange={setSupplier}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Supplier" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {suppliers.map((s: any) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { setEditing(null); setShowForm(true); }}>
          <Plus className="mr-1.5 h-4 w-4" /> New item
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Brand / Size</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Value</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 10 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="py-16 text-center">
                <p className="font-display text-lg font-semibold">No inventory items yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Add your first stock item to start tracking.</p>
              </TableCell></TableRow>
            ) : rows.map((r) => {
              const cs = Number(r.current_stock ?? 0);
              const ms = Number(r.minimum_stock ?? 0);
              const rate = Number(r.purchase_rate ?? 0);
              const out = cs <= 0;
              const low = !out && cs <= ms;
              return (
                <TableRow key={r.id} className={cn("hover:bg-muted/40", (low || out) && "bg-destructive/5")}>
                  <TableCell>
                    <div className="font-medium">{r.name}</div>
                    {(r.paper_type || r.paper_gsm) && (
                      <div className="text-xs text-muted-foreground">
                        {r.paper_type ?? ""}{r.paper_gsm ? ` · ${r.paper_gsm} gsm` : ""}
                      </div>
                    )}
                  </TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] uppercase">{CATEGORY_LABEL[r.category as InventoryCategory] ?? r.category}</Badge></TableCell>
                  <TableCell className="text-xs">
                    {r.brand ?? "—"}{r.size ? ` · ${r.size}` : ""}
                  </TableCell>
                  <TableCell className="text-xs">{r.supplier ?? "—"}</TableCell>
                  <TableCell className={cn("text-right font-mono", out && "text-destructive font-semibold", low && "text-amber-600 font-semibold")}>
                    {cs.toLocaleString()} {r.unit}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{ms.toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(rate)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(cs * rate)}</TableCell>
                  <TableCell>
                    {out ? <Badge variant="destructive">Out</Badge> :
                      low ? <Badge className="bg-amber-500 text-white hover:bg-amber-500">Low</Badge> :
                        r.active ? <Badge variant="outline">Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setShowForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDelId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <ItemFormSheet open={showForm} onOpenChange={setShowForm} item={editing} />
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete inventory item?</AlertDialogTitle>
            <AlertDialogDescription>All stock movements for this item will also be removed. Only admins can delete.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && del.mutate(delId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function ItemFormSheet({ open, onOpenChange, item }: { open: boolean; onOpenChange: (o: boolean) => void; item: any | null }) {
  const qc = useQueryClient();
  const save = useServerFn(upsertInventoryItem);

  const [values, setValues] = useState<any>({});
  useMemo(() => {
    setValues({
      category: item?.category ?? "paper",
      name: item?.name ?? "",
      brand: item?.brand ?? "",
      size: item?.size ?? "",
      paper_gsm: item?.paper_gsm ?? "",
      paper_type: item?.paper_type ?? "",
      unit: item?.unit ?? "pcs",
      opening_stock: item?.opening_stock ?? 0,
      minimum_stock: item?.minimum_stock ?? 0,
      purchase_rate: item?.purchase_rate ?? 0,
      supplier: item?.supplier ?? "",
      remarks: item?.remarks ?? "",
      active: item?.active ?? true,
      batch_number: item?.batch_number ?? "",
      barcode: item?.barcode ?? "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, open]);

  const set = (k: string, v: any) => setValues((s: any) => ({ ...s, [k]: v }));

  const mut = useMutation({
    mutationFn: () => save({
      data: {
        id: item?.id ?? null,
        values: {
          category: values.category,
          name: values.name.trim(),
          brand: values.brand || null,
          size: values.size || null,
          paper_gsm: values.paper_gsm === "" || values.paper_gsm == null ? null : Number(values.paper_gsm),
          paper_type: values.paper_type || null,
          unit: values.unit || "pcs",
          opening_stock: Number(values.opening_stock || 0),
          minimum_stock: Number(values.minimum_stock || 0),
          purchase_rate: Number(values.purchase_rate || 0),
          supplier: values.supplier || null,
          remarks: values.remarks || null,
          active: !!values.active,
          batch_number: values.batch_number || null,
          barcode: values.barcode || null,
        },
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["inv-items"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      toast.success(item ? "Item updated" : "Item created");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const isPaper = values.category === "paper";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{item ? "Edit inventory item" : "New inventory item"}</SheetTitle>
          <SheetDescription>Fields marked with * are required.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Category *">
            <Select value={values.category} onValueChange={(v) => set("category", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INVENTORY_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c]}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Item Name *"><Input value={values.name ?? ""} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field label="Brand"><Input value={values.brand ?? ""} onChange={(e) => set("brand", e.target.value)} /></Field>
          <Field label="Size"><Input value={values.size ?? ""} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 23x36" /></Field>
          {isPaper && (
            <>
              <Field label="Paper Type"><Input value={values.paper_type ?? ""} onChange={(e) => set("paper_type", e.target.value)} placeholder="Art / Offset / Board" /></Field>
              <Field label="Paper GSM"><Input type="number" value={values.paper_gsm ?? ""} onChange={(e) => set("paper_gsm", e.target.value)} /></Field>
            </>
          )}
          <Field label="Unit *"><Input value={values.unit ?? ""} onChange={(e) => set("unit", e.target.value)} placeholder="sheets / kg / ltr" /></Field>
          <Field label="Supplier"><Input value={values.supplier ?? ""} onChange={(e) => set("supplier", e.target.value)} /></Field>
          <Field label="Opening Stock"><Input type="number" step="any" value={values.opening_stock} onChange={(e) => set("opening_stock", e.target.value)} /></Field>
          <Field label="Minimum Stock"><Input type="number" step="any" value={values.minimum_stock} onChange={(e) => set("minimum_stock", e.target.value)} /></Field>
          <Field label="Purchase Rate"><Input type="number" step="any" value={values.purchase_rate} onChange={(e) => set("purchase_rate", e.target.value)} /></Field>
          <Field label="Batch # (future)"><Input value={values.batch_number ?? ""} onChange={(e) => set("batch_number", e.target.value)} /></Field>
          <Field label="Barcode (future)" full><Input value={values.barcode ?? ""} onChange={(e) => set("barcode", e.target.value)} /></Field>
          <Field label="Remarks" full>
            <textarea className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={values.remarks ?? ""} onChange={(e) => set("remarks", e.target.value)} />
          </Field>
          <div className="flex items-center gap-3 sm:col-span-2">
            <Switch checked={!!values.active} onCheckedChange={(v) => set("active", v)} />
            <Label>Active</Label>
          </div>
        </div>
        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={!values.name || mut.isPending} onClick={() => mut.mutate()}>
            {mut.isPending ? "Saving…" : item ? "Save changes" : "Create item"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- STOCK MOVEMENTS ---------------- */

function MovementsPanel() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const fetchList = useServerFn(listStockMovements);
  const delFn = useServerFn(deleteStockMovement);

  const { data, isLoading } = useQuery({
    queryKey: ["stock-mov", search, type, from, to],
    queryFn: () => fetchList({ data: { search: search || undefined, movement_type: type, from: from || undefined, to: to || undefined } }),
  });
  const rows = (data ?? []) as any[];

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["stock-mov"] });
      qc.invalidateQueries({ queryKey: ["inv-items"] });
      qc.invalidateQueries({ queryKey: ["inv-summary"] });
      toast.success("Movement deleted");
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <Card className="overflow-hidden shadow-elevated">
      <div className="flex flex-wrap items-center gap-3 border-b p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search reference / reason" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="in">Stock In</SelectItem>
            <SelectItem value="out">Stock Out</SelectItem>
            <SelectItem value="adjustment">Adjustment</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" className="w-40" value={from} onChange={(e) => setFrom(e.target.value)} />
        <Input type="date" className="w-40" value={to} onChange={(e) => setTo(e.target.value)} />
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" /> New movement</Button>
          </DialogTrigger>
          <MovementDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["stock-mov"] }); qc.invalidateQueries({ queryKey: ["inv-items"] }); qc.invalidateQueries({ queryKey: ["inv-summary"] }); }} />
        </Dialog>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Item</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-16 text-center">
                <p className="font-display text-lg font-semibold">No stock movements yet</p>
                <p className="mt-1 text-sm text-muted-foreground">Movements from production and manual entries appear here.</p>
              </TableCell></TableRow>
            ) : rows.map((r) => {
              const isIn = r.movement_type === "in";
              const isOut = r.movement_type === "out";
              const Icon = isIn ? ArrowDownToLine : isOut ? ArrowUpFromLine : RotateCcw;
              return (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="text-xs">{r.movement_date}</TableCell>
                  <TableCell className="text-sm">{r.item?.name ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn("h-3.5 w-3.5", isIn && "text-emerald-600", isOut && "text-destructive")} />
                      <span className="text-xs uppercase">{r.movement_type}</span>
                    </div>
                  </TableCell>
                  <TableCell className={cn("text-right font-mono text-xs", isIn && "text-emerald-600", isOut && "text-destructive")}>
                    {isOut ? "-" : "+"}{Math.abs(Number(r.quantity)).toLocaleString()} {r.item?.unit ?? ""}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.reference_type === "production_job" ? "Production" : (r.reference_type ?? "Manual")}
                    {r.reference_no ? ` · ${r.reference_no}` : ""}
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
                  <TableCell>
                    {r.reference_type !== "production_job" && (
                      <Button variant="ghost" size="icon" onClick={() => setDelId(r.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete stock movement?</AlertDialogTitle>
            <AlertDialogDescription>Item stock will be recomputed automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && del.mutate(delId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function MovementDialog({ onDone }: { onDone: () => void }) {
  const fetchItems = useServerFn(listInventoryItems);
  const createMv = useServerFn(createStockMovement);
  const itemsQ = useQuery({ queryKey: ["inv-items-picker"], queryFn: () => fetchItems({ data: { status: "active" } }) });

  const [itemId, setItemId] = useState("");
  const [type, setType] = useState<"in" | "out" | "adjustment">("in");
  const [qty, setQty] = useState<number>(0);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [ref, setRef] = useState("");
  const [reason, setReason] = useState("");

  const save = useMutation({
    mutationFn: () => createMv({
      data: {
        item_id: itemId,
        movement_type: type,
        quantity: Number(qty),
        movement_date: date,
        reference_no: ref || null,
        reason: reason || null,
      },
    }),
    onSuccess: () => { toast.success("Movement recorded"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New stock movement</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Item *" full>
          <Select value={itemId} onValueChange={setItemId}>
            <SelectTrigger><SelectValue placeholder="Select item…" /></SelectTrigger>
            <SelectContent>
              {(itemsQ.data ?? []).map((i: any) => (
                <SelectItem key={i.id} value={i.id}>{i.name} · {CATEGORY_LABEL[i.category as InventoryCategory]} · {Number(i.current_stock).toLocaleString()} {i.unit}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Type *">
          <Select value={type} onValueChange={(v) => setType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="in">Stock In</SelectItem>
              <SelectItem value="out">Stock Out</SelectItem>
              <SelectItem value="adjustment">Adjustment</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Quantity *"><Input type="number" step="any" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Reference #"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="PO / invoice / doc" /></Field>
        <Field label="Reason / Notes" full>
          <textarea className="min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
      </div>
      <DialogFooter>
        <Button disabled={!itemId || !qty || save.isPending} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save movement"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

/* ---------------- REPORTS ---------------- */

function ReportsPanel() {
  const [report, setReport] = useState("current");
  return (
    <Card className="p-4 shadow-elevated">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="font-display text-lg font-semibold">Inventory Reports</div>
        <div className="flex-1" />
        <Select value={report} onValueChange={setReport}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current Stock</SelectItem>
            <SelectItem value="movement">Stock Movement</SelectItem>
            <SelectItem value="low">Low Stock</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
            <SelectItem value="valuation">Inventory Valuation</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => window.print()}>Print / PDF</Button>
      </div>
      {report === "movement" ? <MovementReport /> : <StockReport variant={report as any} />}
    </Card>
  );
}

function StockReport({ variant }: { variant: "current" | "low" | "out" | "valuation" }) {
  const fetchList = useServerFn(listInventoryItems);
  const { data, isLoading } = useQuery({
    queryKey: ["inv-report", variant],
    queryFn: () => fetchList({
      data: {
        low_only: variant === "low" || undefined,
        out_only: variant === "out" || undefined,
      },
    }),
  });
  const rows = (data ?? []) as any[];
  const totalValue = rows.reduce((a, r) => a + Number(r.current_stock ?? 0) * Number(r.purchase_rate ?? 0), 0);

  return (
    <div className="space-y-3">
      {variant === "low" && rows.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" /> {rows.length} items at or below minimum stock.
        </div>
      )}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Min</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Value</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
            )) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">No items match this report.</TableCell></TableRow>
            ) : rows.map((r) => {
              const cs = Number(r.current_stock ?? 0);
              const rate = Number(r.purchase_rate ?? 0);
              return (
                <TableRow key={r.id}>
                  <TableCell><div className="font-medium">{r.name}</div>{r.brand && <div className="text-xs text-muted-foreground">{r.brand}</div>}</TableCell>
                  <TableCell><Badge variant="secondary" className="text-[10px] uppercase">{CATEGORY_LABEL[r.category as InventoryCategory] ?? r.category}</Badge></TableCell>
                  <TableCell className="text-xs">{r.supplier ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono">{cs.toLocaleString()} {r.unit}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{Number(r.minimum_stock ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(rate)}</TableCell>
                  <TableCell className="text-right font-mono">{formatCurrency(cs * rate)}</TableCell>
                </TableRow>
              );
            })}
            {rows.length > 0 && (
              <TableRow className="bg-muted/40 font-semibold">
                <TableCell colSpan={6} className="text-right">Total Value</TableCell>
                <TableCell className="text-right font-mono">{formatCurrency(totalValue)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function MovementReport() {
  const fetchList = useServerFn(listStockMovements);
  const { data, isLoading } = useQuery({ queryKey: ["stock-mov-report"], queryFn: () => fetchList({ data: { limit: 500 } }) });
  const rows = (data ?? []) as any[];
  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead>Reference</TableHead>
            <TableHead>Reason</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? Array.from({ length: 6 }).map((_, i) => (
            <TableRow key={i}>{Array.from({ length: 6 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
          )) : rows.length === 0 ? (
            <TableRow><TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">No movements recorded.</TableCell></TableRow>
          ) : rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-xs">{r.movement_date}</TableCell>
              <TableCell>{r.item?.name ?? "—"}</TableCell>
              <TableCell className="text-xs uppercase">{r.movement_type}</TableCell>
              <TableCell className={cn("text-right font-mono", r.movement_type === "in" && "text-emerald-600", r.movement_type === "out" && "text-destructive")}>
                {r.movement_type === "out" ? "-" : "+"}{Math.abs(Number(r.quantity)).toLocaleString()} {r.item?.unit ?? ""}
              </TableCell>
              <TableCell className="text-xs">
                {r.reference_type === "production_job" ? "Production" : (r.reference_type ?? "Manual")}
                {r.reference_no ? ` · ${r.reference_no}` : ""}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">{r.reason ?? "—"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

/* ---------------- SMALL BITS ---------------- */

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={cn("space-y-1.5", full && "sm:col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
