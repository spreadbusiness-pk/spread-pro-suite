import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { listMaster, upsertMaster, deleteMaster } from "@/lib/masters.functions";
import { listBranches } from "@/lib/branches.functions";

export const Route = createFileRoute("/_authenticated/masters")({ component: MastersPage });

type FieldDef = { key: string; label: string; type?: "text" | "number" | "textarea" | "select" | "branch" | "category" | "paperType" | "paperGsm" | "machine"; options?: string[]; required?: boolean };
type MasterSpec = {
  table: "products" | "product_categories" | "machines" | "papers" | "ctp_plates" | "finishing_options" | "binding_options" | "labour_rates" | "transport_rates";
  label: string;
  cols: string[];
  fields: FieldDef[];
};

const SPECS: MasterSpec[] = [
  {
    table: "products", label: "Products",
    cols: ["name", "product_size", "paper_type", "paper_gsm", "active"],
    fields: [
      { key: "category_id", label: "Category", type: "category" },
      { key: "name", label: "Name", required: true },
      { key: "product_size", label: "Product Size" },
      { key: "paper_type", label: "Paper Type", type: "paperType" },
      { key: "paper_gsm", label: "Paper GSM", type: "paperGsm" },
      { key: "default_machine_id", label: "Default Machine", type: "machine" },
    ],
  },
  {
    table: "machines", label: "Machines",
    cols: ["name", "machine_type", "model", "colors", "cost_per_hour"],
    fields: [
      { key: "name", label: "Machine Name", required: true },
      { key: "machine_type", label: "Machine Type" },
      { key: "model", label: "Model" },
      { key: "colors", label: "Colors", type: "number" },
      { key: "max_sheet_size", label: "Max sheet size" },
      { key: "min_sheet_size", label: "Min sheet size" },
      { key: "cost_per_hour", label: "Cost Per Color", type: "number" },
    ],
  },
  {
    table: "papers", label: "Paper",
    cols: ["name", "brand", "gsm", "sheet_size", "purchase_rate"],
    fields: [
      { key: "name", label: "Paper Name", required: true },
      { key: "brand", label: "Brand" },
      { key: "gsm", label: "GSM", type: "number" },
      { key: "sheet_size", label: "Sheet size" },
      { key: "purchase_rate", label: "Purchase rate", type: "number" },
    ],
  },
  {
    table: "ctp_plates", label: "CTP Plates",
    cols: ["name", "plate_size", "cost"],
    fields: [
      { key: "name", label: "Plate name", required: true },
      { key: "plate_size", label: "Plate size" },
      { key: "cost", label: "Cost", type: "number" },
      { key: "supplier", label: "Supplier" },
    ],
  },
  {
    table: "finishing_options", label: "Finishing",
    cols: ["name", "rate", "unit"],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    table: "binding_options", label: "Binding",
    cols: ["name", "rate", "unit"],
    fields: [
      { key: "name", label: "Name", required: true },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    table: "labour_rates", label: "Labour",
    cols: ["labour_type", "rate", "unit"],
    fields: [
      { key: "labour_type", label: "Labour type", required: true },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    table: "transport_rates", label: "Transport",
    cols: ["transport_type", "rate", "unit"],
    fields: [
      { key: "transport_type", label: "Transport type", required: true },
      { key: "rate", label: "Rate", type: "number" },
      { key: "unit", label: "Unit" },
    ],
  },
  {
    table: "product_categories", label: "Categories",
    cols: ["name"],
    fields: [{ key: "name", label: "Name", required: true }],
  },
];

function MastersPage() {
  const [tab, setTab] = useState<MasterSpec["table"]>("products");
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administration</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Master Data</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage products, machines, paper and rate tables that power order costing.</p>
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="flex-wrap h-auto">
          {SPECS.map((s) => <TabsTrigger key={s.table} value={s.table}>{s.label}</TabsTrigger>)}
        </TabsList>
        {SPECS.map((s) => (
          <TabsContent key={s.table} value={s.table} className="mt-4">
            <MasterTable spec={s} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function MasterTable({ spec }: { spec: MasterSpec }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listMaster);
  const upsertFn = useServerFn(upsertMaster);
  const deleteFn = useServerFn(deleteMaster);
  const branchListFn = useServerFn(listBranches);

  const { data, isLoading } = useQuery({ queryKey: ["master", spec.table], queryFn: () => listFn({ data: { table: spec.table } }) });
  const branchesQ = useQuery({ queryKey: ["branches"], queryFn: () => branchListFn() });
  const catsQ = useQuery({
    queryKey: ["master", "product_categories"],
    queryFn: () => listFn({ data: { table: "product_categories" } }),
    enabled: spec.fields.some((f) => f.type === "category"),
  });
  const papersQ = useQuery({
    queryKey: ["master", "papers"],
    queryFn: () => listFn({ data: { table: "papers" } }),
    enabled: spec.fields.some((f) => f.type === "paperType" || f.type === "paperGsm"),
  });
  const machinesQ = useQuery({
    queryKey: ["master", "machines"],
    queryFn: () => listFn({ data: { table: "machines" } }),
    enabled: spec.fields.some((f) => f.type === "machine"),
  });

  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [toDelete, setToDelete] = useState<any>(null);

  const openNew = () => { setEditing(null); setForm({}); setSheet(true); };
  const openEdit = (row: any) => { setEditing(row); setForm({ ...row }); setSheet(true); };

  const save = useMutation({
    mutationFn: async () => {
      const clean: Record<string, any> = {};
      for (const f of spec.fields) {
        const v = form[f.key];
        if (v === undefined || v === "") { clean[f.key] = null; continue; }
        clean[f.key] = (f.type === "number" || f.type === "paperGsm") ? Number(v) : v;
      }
      return upsertFn({ data: { table: spec.table, id: editing?.id ?? null, values: clean } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master", spec.table] }); toast.success("Saved"); setSheet(false); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { table: spec.table, id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["master", spec.table] }); toast.success("Deleted"); setToDelete(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (data ?? []) as any[];

  return (
    <Card className="overflow-hidden shadow-elevated">
      <div className="flex items-center justify-between border-b p-4">
        <div className="text-sm text-muted-foreground">{rows.length} record{rows.length === 1 ? "" : "s"}</div>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add {spec.label.slice(0, -1)}</Button>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {spec.cols.map((c) => <TableHead key={c}>{c.replace(/_/g, " ")}</TableHead>)}
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? Array.from({ length: 4 }).map((_, i) => (
              <TableRow key={i}>{Array.from({ length: spec.cols.length + 1 }).map((__, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
            )) : rows.length === 0 ? (
              <TableRow><TableCell colSpan={spec.cols.length + 1} className="py-12 text-center text-sm text-muted-foreground">Nothing here yet. Click "Add" to create your first record.</TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.id} className="hover:bg-muted/40">
                {spec.cols.map((c) => <TableCell key={c} className="text-sm">{formatCell(r[c])}</TableCell>)}
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">{editing ? `Edit ${spec.label}` : `New ${spec.label}`}</SheetTitle>
            <SheetDescription>All fields are optional unless marked.</SheetDescription>
          </SheetHeader>
          <form className="mt-6 space-y-4 px-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              {spec.fields.map((f) => (
                <div key={f.key} className={(f.type === "textarea" ? "sm:col-span-2 " : "") + "space-y-1.5"}>
                  <Label className="text-xs">{f.label}{f.required && <span className="text-destructive"> *</span>}</Label>
                  {f.type === "branch" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                      <SelectContent>{(branchesQ.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : f.type === "category" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>{(catsQ.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : f.type === "paperType" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select paper type" /></SelectTrigger>
                      <SelectContent>{Array.from(new Set(((papersQ.data ?? []) as any[]).map((p) => p.name).filter(Boolean))).map((n) => <SelectItem key={n as string} value={n as string}>{n as string}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : f.type === "paperGsm" ? (
                    <Select value={form[f.key] != null ? String(form[f.key]) : ""} onValueChange={(v) => setForm({ ...form, [f.key]: Number(v) })}>
                      <SelectTrigger><SelectValue placeholder="Select GSM" /></SelectTrigger>
                      <SelectContent>{Array.from(new Set(((papersQ.data ?? []) as any[]).map((p) => p.gsm).filter((g) => g != null))).sort((a: any, b: any) => a - b).map((g) => <SelectItem key={String(g)} value={String(g)}>{String(g)}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : f.type === "machine" ? (
                    <Select value={form[f.key] ?? ""} onValueChange={(v) => setForm({ ...form, [f.key]: v })}>
                      <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                      <SelectContent>{((machinesQ.data ?? []) as any[]).map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                    </Select>
                  ) : f.type === "textarea" ? (
                    <textarea className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
                  ) : (
                    <Input type={f.type === "number" ? "number" : "text"} step="any" value={form[f.key] ?? ""} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} required={f.required} />
                  )}
                </div>
              ))}
            </div>
            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setSheet(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete record?</AlertDialogTitle>
            <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

function formatCell(v: any) {
  if (v === null || v === undefined || v === "") return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString();
  return String(v);
}
