import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Trash2, Plus } from "lucide-react";
import { createOrder } from "@/lib/orders.functions";
import { listBranches } from "@/lib/branches.functions";
import { listCustomers } from "@/lib/customers.functions";
import { listMaster } from "@/lib/masters.functions";
import { computeTotals, formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/orders/new")({ component: NewOrderPage });

type Item = { product_id: string | null; description: string; quantity: number; unit: string; specs: any; line_total: number };
const emptyItem: Item = { product_id: null, description: "", quantity: 1, unit: "pcs", specs: {}, line_total: 0 };

function NewOrderPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createOrder);
  const branchesFn = useServerFn(listBranches);
  const customersFn = useServerFn(listCustomers);
  const mastersFn = useServerFn(listMaster);

  const branchesQ = useQuery({ queryKey: ["branches"], queryFn: () => branchesFn() });
  const customersQ = useQuery({ queryKey: ["customers", "all"], queryFn: () => customersFn({ data: { pageSize: 500 } }) });
  const productsQ = useQuery({ queryKey: ["master", "products"], queryFn: () => mastersFn({ data: { table: "products" } }) });

  const [branch_id, setBranchId] = useState<string>("");
  const [customer_id, setCustomerId] = useState<string>("");
  const [quotation_ref, setQuotRef] = useState("");
  const [order_date, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [delivery_date, setDeliveryDate] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [customer_remarks, setCustRemarks] = useState("");
  const [internal_notes, setInternalNotes] = useState("");
  const [items, setItems] = useState<Item[]>([{ ...emptyItem }]);

  const [paper, setPaper] = useState(0);
  const [ctp, setCtp] = useState(0);
  const [printing, setPrinting] = useState(0);
  const [ink, setInk] = useState(0);
  const [finishing, setFinishing] = useState(0);
  const [binding, setBinding] = useState(0);
  const [labour, setLabour] = useState(0);
  const [transport, setTransport] = useState(0);
  const [misc, setMisc] = useState(0);
  const [profit_pct, setProfitPct] = useState(25);
  const [override_selling, setOverride] = useState<string>("");

  const totals = useMemo(() => computeTotals({
    paper_cost: paper, ctp_cost: ctp, printing_cost: printing, ink_cost: ink,
    finishing_cost: finishing, binding_cost: binding, labour_cost: labour,
    transport_cost: transport, misc_cost: misc, profit_pct,
    override_selling: override_selling ? Number(override_selling) : null,
  }), [paper, ctp, printing, ink, finishing, binding, labour, transport, misc, profit_pct, override_selling]);

  const create = useMutation({
    mutationFn: async () => createFn({
      data: {
        values: {
          branch_id: branch_id || null,
          customer_id: customer_id || null,
          quotation_ref: quotation_ref || null,
          order_date, delivery_date: delivery_date || null,
          priority, status: "new",
          customer_remarks: customer_remarks || null,
          internal_notes: internal_notes || null,
          paper_cost: paper, ctp_cost: ctp, printing_cost: printing, ink_cost: ink,
          finishing_cost: finishing, binding_cost: binding, labour_cost: labour,
          transport_cost: transport, misc_cost: misc, profit_pct,
          override_selling: override_selling ? Number(override_selling) : null,
        },
        items: items.filter((it) => it.description || it.product_id).map((it) => ({
          product_id: it.product_id || null,
          description: it.description || null,
          quantity: Number(it.quantity) || 1,
          unit: it.unit || "pcs",
          specs: it.specs || {},
          line_total: Number(it.line_total) || 0,
        })),
      },
    }),
    onSuccess: (order: any) => { toast.success(`Order ${order.order_no} created`); navigate({ to: "/orders/$id", params: { id: order.id } }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const setItem = (i: number, patch: Partial<Item>) => setItems((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">New Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">Order number is generated automatically once you save.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Order details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <F label="Branch" required>
                <Select value={branch_id} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>{(branchesQ.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Customer" required>
                <Select value={customer_id} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>{((customersQ.data as any)?.rows ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Quotation reference"><Input value={quotation_ref} onChange={(e) => setQuotRef(e.target.value)} /></F>
              <F label="Priority">
                <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["low","normal","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Order date"><Input type="date" value={order_date} onChange={(e) => setOrderDate(e.target.value)} /></F>
              <F label="Delivery date"><Input type="date" value={delivery_date} onChange={(e) => setDeliveryDate(e.target.value)} /></F>
              <F label="Customer remarks" full><textarea className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={customer_remarks} onChange={(e) => setCustRemarks(e.target.value)} /></F>
              <F label="Internal notes" full><textarea className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={internal_notes} onChange={(e) => setInternalNotes(e.target.value)} /></F>
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Line items</h2>
              <Button size="sm" variant="outline" onClick={() => setItems([...items, { ...emptyItem }])}><Plus className="mr-1.5 h-4 w-4" /> Add item</Button>
            </div>
            <div className="mt-4 space-y-3">
              {items.map((it, i) => (
                <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_100px_90px_120px_40px]">
                  <Select value={it.product_id ?? ""} onValueChange={(v) => setItem(i, { product_id: v || null })}>
                    <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
                    <SelectContent>{(productsQ.data ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                  <Input placeholder="Description / specs" value={it.description} onChange={(e) => setItem(i, { description: e.target.value })} />
                  <Input type="number" step="any" placeholder="Qty" value={it.quantity} onChange={(e) => setItem(i, { quantity: Number(e.target.value) })} />
                  <Input placeholder="Unit" value={it.unit} onChange={(e) => setItem(i, { unit: e.target.value })} />
                  <Input type="number" step="any" placeholder="Line total" value={it.line_total} onChange={(e) => setItem(i, { line_total: Number(e.target.value) })} />
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setItems(items.filter((_, idx) => idx !== i))} disabled={items.length === 1}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Costing</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <CostInput label="Paper" value={paper} onChange={setPaper} />
              <CostInput label="CTP" value={ctp} onChange={setCtp} />
              <CostInput label="Printing" value={printing} onChange={setPrinting} />
              <CostInput label="Ink" value={ink} onChange={setInk} />
              <CostInput label="Finishing" value={finishing} onChange={setFinishing} />
              <CostInput label="Binding" value={binding} onChange={setBinding} />
              <CostInput label="Labour" value={labour} onChange={setLabour} />
              <CostInput label="Transport" value={transport} onChange={setTransport} />
              <CostInput label="Miscellaneous" value={misc} onChange={setMisc} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Total cost" value={formatCurrency(totals.total_cost)} strong />
              <div className="grid grid-cols-2 items-center gap-2 py-2">
                <Label className="text-xs">Profit %</Label>
                <Input type="number" step="any" value={profit_pct} onChange={(e) => setProfitPct(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 items-center gap-2 pb-2">
                <Label className="text-xs">Override selling</Label>
                <Input type="number" step="any" value={override_selling} placeholder="Auto" onChange={(e) => setOverride(e.target.value)} />
              </div>
              <Row label="Selling price" value={formatCurrency(totals.selling_price)} strong />
              <Row label="Net profit" value={formatCurrency(totals.net_profit)} tone={totals.net_profit >= 0 ? "success" : "destructive"} />
            </div>
            <Button className="mt-6 w-full" disabled={!branch_id || !customer_id || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create order"}
            </Button>
            {(!branch_id || !customer_id) && <p className="mt-2 text-center text-[11px] text-muted-foreground">Select a branch and customer to continue.</p>}
          </Card>
        </div>
      </div>
    </div>
  );
}

function F({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return <div className={(full ? "sm:col-span-2 " : "") + "space-y-1.5"}><Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>{children}</div>;
}
function CostInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return <div className="space-y-1.5"><Label className="text-xs">{label}</Label><Input type="number" step="any" value={value} onChange={(e) => onChange(Number(e.target.value))} /></div>;
}
function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className={"flex items-center justify-between border-t pt-2 " + (strong ? "text-base" : "text-sm")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-display font-bold " : "font-mono " + (tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "")}>{value}</span>
    </div>
  );
}
