import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { createOrder } from "@/lib/orders.functions";
import { listBranches } from "@/lib/branches.functions";
import { listCustomers } from "@/lib/customers.functions";
import { listMaster } from "@/lib/masters.functions";
import { computeTotals, formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/orders/new")({ component: NewOrderPage });

type Colors = "1" | "2" | "4" | "4+4";
const COLOR_TO_PLATES: Record<Colors, number> = { "1": 1, "2": 2, "4": 4, "4+4": 8 };
const COLOR_TO_IMPRESSIONS: Record<Colors, number> = { "1": 1, "2": 2, "4": 4, "4+4": 8 };

function NewOrderPage() {
  const navigate = useNavigate();
  const createFn = useServerFn(createOrder);
  const branchesFn = useServerFn(listBranches);
  const customersFn = useServerFn(listCustomers);
  const mastersFn = useServerFn(listMaster);

  const branchesQ = useQuery({ queryKey: ["branches"], queryFn: () => branchesFn() });
  const customersQ = useQuery({ queryKey: ["customers", "all"], queryFn: () => customersFn({ data: { pageSize: 500 } }) });
  const productsQ = useQuery({ queryKey: ["master", "products"], queryFn: () => mastersFn({ data: { table: "products" } }) });
  const machinesQ = useQuery({ queryKey: ["master", "machines"], queryFn: () => mastersFn({ data: { table: "machines" } }) });
  const papersQ = useQuery({ queryKey: ["master", "papers"], queryFn: () => mastersFn({ data: { table: "papers" } }) });
  const ctpQ = useQuery({ queryKey: ["master", "ctp_plates"], queryFn: () => mastersFn({ data: { table: "ctp_plates" } }) });
  const finishingQ = useQuery({ queryKey: ["master", "finishing_options"], queryFn: () => mastersFn({ data: { table: "finishing_options" } }) });
  const bindingQ = useQuery({ queryKey: ["master", "binding_options"], queryFn: () => mastersFn({ data: { table: "binding_options" } }) });
  const labourQ = useQuery({ queryKey: ["master", "labour_rates"], queryFn: () => mastersFn({ data: { table: "labour_rates" } }) });
  const transportQ = useQuery({ queryKey: ["master", "transport_rates"], queryFn: () => mastersFn({ data: { table: "transport_rates" } }) });

  const [branch_id, setBranchId] = useState<string>("");
  const [customer_id, setCustomerId] = useState<string>("");
  const [delivery_date, setDeliveryDate] = useState("");
  const [profit_pct, setProfitPct] = useState(25);
  const [lines, setLines] = useState<Line[]>([newLine()]);

  useEffect(() => {
    if (!branch_id && branchesQ.data && branchesQ.data.length > 0) setBranchId(branchesQ.data[0].id);
  }, [branchesQ.data, branch_id]);

  const products = (productsQ.data ?? []) as any[];
  const papers = (papersQ.data ?? []) as any[];
  const machines = (machinesQ.data ?? []) as any[];
  const ctpRate = Number((((ctpQ.data ?? []) as any[])[0] ?? {}).cost ?? 0);

  const updateLine = (id: string, patch: Partial<Line>) =>
    setLines((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((ls) => (ls.length > 1 ? ls.filter((l) => l.id !== id) : ls));

  // Per-line direct costs from master data.
  const computed = useMemo(
    () =>
      lines.map((l) => {
        const product = products.find((p) => p.id === l.product_id) ?? null;
        const paper = product
          ? papers.find(
              (p) =>
                (product.paper_type ? p.name === product.paper_type : true) &&
                (product.paper_gsm ? Number(p.gsm) === Number(product.paper_gsm) : true),
            ) ?? null
          : null;
        const machine = product?.default_machine_id ? machines.find((m) => m.id === product.default_machine_id) ?? null : null;
        const sideMul = l.sides === "2" ? 2 : 1;
        const totalColors = COLOR_TO_IMPRESSIONS[l.colors] * sideMul;
        const plates = COLOR_TO_PLATES[l.colors] * sideMul;
        const sheets = Math.max(0, Math.ceil(Number(l.quantity) || 0));
        const paperCost = product ? sheets * Number(paper?.purchase_rate ?? 0) : 0;
        const ctpCost = product ? plates * ctpRate : 0;
        const printingCost = product ? Number(machine?.cost_per_hour ?? 0) * totalColors : 0;
        return { line: l, product, paper, machine, totalColors, plates, sheets, paperCost, ctpCost, printingCost, direct: paperCost + ctpCost + printingCost };
      }),
    [lines, products, papers, machines, ctpRate],
  );

  const sumRates = (rows: any[] | undefined) => (rows ?? []).reduce((acc: number, r: any) => acc + Number(r?.rate ?? 0), 0);
  const finRows = (finishingQ.data ?? []) as any[];
  const dieCuttingCost = sumRates(finRows.filter((r) => /die.?cut/i.test(String(r?.name ?? ""))));
  const finishingCost = sumRates(finRows.filter((r) => !/die.?cut/i.test(String(r?.name ?? ""))));
  const bindingCost = sumRates(bindingQ.data as any[]);
  const labourCost = sumRates(labourQ.data as any[]);
  const transportCost = sumRates(transportQ.data as any[]);

  const valid = computed.filter((c) => c.product && Number(c.line.quantity) > 0);
  const paperCost = valid.reduce((a, c) => a + c.paperCost, 0);
  const ctpCost = valid.reduce((a, c) => a + c.ctpCost, 0);
  const printingCost = valid.reduce((a, c) => a + c.printingCost, 0);

  const totals = useMemo(
    () =>
      computeTotals({
        paper_cost: paperCost, ctp_cost: ctpCost, printing_cost: printingCost, die_cutting_cost: dieCuttingCost,
        finishing_cost: finishingCost, binding_cost: bindingCost, labour_cost: labourCost, transport_cost: transportCost,
        ink_cost: 0, misc_cost: 0, profit_pct,
      }),
    [paperCost, ctpCost, printingCost, dieCuttingCost, finishingCost, bindingCost, labourCost, transportCost, profit_pct],
  );

  // Distribute order-level overheads across lines (by direct cost share) to get each line's selling total.
  const overhead = dieCuttingCost + finishingCost + bindingCost + labourCost + transportCost;
  const directSum = valid.reduce((a, c) => a + c.direct, 0);
  const lineTotal = (c: (typeof computed)[number]) => {
    if (!valid.includes(c)) return 0;
    const share = directSum > 0 ? c.direct / directSum : 1 / valid.length;
    return Math.round((c.direct + overhead * share) * (1 + profit_pct / 100) * 100) / 100;
  };

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          values: {
            branch_id: branch_id || null, customer_id: customer_id || null, delivery_date: delivery_date || null,
            priority: "normal", status: "new",
            paper_cost: paperCost, ctp_cost: ctpCost, printing_cost: printingCost, die_cutting_cost: dieCuttingCost,
            ink_cost: 0, finishing_cost: finishingCost, binding_cost: bindingCost, labour_cost: labourCost,
            transport_cost: transportCost, misc_cost: 0, profit_pct,
          },
          items: valid.map((c) => ({
            product_id: c.line.product_id,
            description: c.product?.name ?? null,
            quantity: Number(c.line.quantity) || 1,
            unit: "pcs",
            specs: {
              colors: c.line.colors, sides: c.line.sides, plates: c.plates, sheets: c.sheets,
              paper_type: c.product?.paper_type ?? null, paper_gsm: c.product?.paper_gsm ?? null,
              product_size: c.product?.product_size ?? null, machine_id: c.machine?.id ?? null,
            },
            line_total: lineTotal(c),
          })),
        },
      }),
    onSuccess: (order: any) => {
      toast.success(`Order ${order.order_no} created`);
      navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const canSubmit = !!branch_id && !!customer_id && valid.length > 0 && valid.length === lines.length;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">New Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add one or more products — everything else auto-loads from Master Data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Order details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <F label="Branch" required>
                <Select value={branch_id} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {(branchesQ.data ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>{b.name} ({b.code})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Customer" required>
                <Select value={customer_id} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {((customersQ.data as any)?.rows ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Delivery date">
                <Input type="date" value={delivery_date} onChange={(e) => setDeliveryDate(e.target.value)} />
              </F>
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold">Products ({lines.length})</h2>
              <Button size="sm" variant="outline" onClick={() => setLines((ls) => [...ls, newLine()])}>
                <Plus className="mr-1 h-4 w-4" /> Add product
              </Button>
            </div>
            <div className="mt-4 space-y-4">
              {computed.map((c, idx) => (
                <div key={c.line.id} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Item {idx + 1}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-semibold">{formatCurrency(lineTotal(c))}</span>
                      <Button size="icon" variant="ghost" disabled={lines.length === 1} onClick={() => removeLine(c.line.id)} aria-label="Remove item">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-4">
                    <F label="Product" required>
                      <Select value={c.line.product_id} onValueChange={(v) => updateLine(c.line.id, { product_id: v })}>
                        <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (<SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>))}
                        </SelectContent>
                      </Select>
                    </F>
                    <F label="Quantity" required>
                      <Input type="number" min={1} step="1" value={c.line.quantity}
                        onChange={(e) => updateLine(c.line.id, { quantity: Number(e.target.value) })} />
                    </F>
                    <F label="Colors" required>
                      <Select value={c.line.colors} onValueChange={(v) => updateLine(c.line.id, { colors: v as Colors })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 Color</SelectItem>
                          <SelectItem value="2">2 Color</SelectItem>
                          <SelectItem value="4">4 Color</SelectItem>
                          <SelectItem value="4+4">4 + 4</SelectItem>
                        </SelectContent>
                      </Select>
                    </F>
                    <F label="Side" required>
                      <Select value={c.line.sides} onValueChange={(v) => updateLine(c.line.id, { sides: v as "1" | "2" })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Single Side</SelectItem>
                          <SelectItem value="2">Both Sides</SelectItem>
                        </SelectContent>
                      </Select>
                    </F>
                  </div>
                  {c.product && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-4">
                      <Info label="Paper" value={`${c.product.paper_type ?? "—"} ${c.product.paper_gsm ? c.product.paper_gsm + "gsm" : ""}`} />
                      <Info label="Size" value={c.product.product_size ?? "—"} />
                      <Info label="Machine" value={c.machine?.name ?? "—"} />
                      <Info label="Sheets / Plates" value={`${c.sheets.toLocaleString()} / ${c.plates}`} />
                    </div>
                  )}
                  {c.product && !c.paper && <p className="mt-2 text-xs text-destructive">No matching paper in master — paper cost 0.</p>}
                  {c.product && !c.machine && <p className="mt-1 text-xs text-destructive">No default machine — printing cost 0.</p>}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Costing</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CostRow label="Paper" value={paperCost} />
              <CostRow label="CTP" value={ctpCost} />
              <CostRow label="Printing" value={printingCost} />
              <CostRow label="Die Cutting" value={dieCuttingCost} />
              <CostRow label="Finishing" value={finishingCost} />
              <CostRow label="Binding" value={bindingCost} />
              <CostRow label="Labour" value={labourCost} />
              <CostRow label="Transport" value={transportCost} />
            </div>
          </Card>
        </div>

        <div className="space-y-4 lg:sticky lg:top-20 self-start">
          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Summary</h2>
            <div className="mt-4 space-y-2 text-sm">
              <Row label="Items" value={String(valid.length)} />
              <Row label="Total cost" value={formatCurrency(totals.total_cost)} strong />
              <div className="grid grid-cols-2 items-center gap-2 py-2">
                <Label className="text-xs">Profit %</Label>
                <Input type="number" step="any" value={profit_pct} onChange={(e) => setProfitPct(Number(e.target.value))} />
              </div>
              <Row label="Selling price" value={formatCurrency(totals.selling_price)} strong />
              <Row label="Net profit" value={formatCurrency(totals.net_profit)} tone={totals.net_profit >= 0 ? "success" : "destructive"} />
            </div>
            <Button className="mt-6 w-full" disabled={!canSubmit || create.isPending} onClick={() => create.mutate()}>
              {create.isPending ? "Creating…" : "Create order"}
            </Button>
            {!canSubmit && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Select customer, and a product + quantity on every item.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

type Line = { id: string; product_id: string; quantity: number; colors: Colors; sides: "1" | "2" };
function newLine(): Line {
  return { id: Math.random().toString(36).slice(2), product_id: "", quantity: 1000, colors: "4", sides: "1" };
}

function F({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={(full ? "sm:col-span-2 " : "") + "space-y-1.5"}>
      <Label className="text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </Label>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-sm font-medium">{value}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-md border px-3 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-mono text-sm">{formatCurrency(value)}</span>
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: "success" | "destructive" }) {
  return (
    <div className={"flex items-center justify-between border-t pt-2 " + (strong ? "text-base" : "text-sm")}>
      <span className="text-muted-foreground">{label}</span>
      <span
        className={
          strong
            ? "font-display font-bold "
            : "font-mono " + (tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "")
        }
      >
        {value}
      </span>
    </div>
  );
}
