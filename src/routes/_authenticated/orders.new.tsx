import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
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
  const [product_id, setProductId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1000);
  const [colors, setColors] = useState<Colors>("4");
  const [sides, setSides] = useState<"1" | "2">("1");
  const [delivery_date, setDeliveryDate] = useState("");
  const [profit_pct, setProfitPct] = useState(25);

  // Auto-select first branch when available.
  useEffect(() => {
    if (!branch_id && branchesQ.data && branchesQ.data.length > 0) setBranchId(branchesQ.data[0].id);
  }, [branchesQ.data, branch_id]);

  const product = useMemo(
    () => ((productsQ.data ?? []) as any[]).find((p) => p.id === product_id) ?? null,
    [productsQ.data, product_id],
  );

  // Match paper from master using product's paper_type + paper_gsm.
  const paper = useMemo(() => {
    if (!product) return null;
    const rows = (papersQ.data ?? []) as any[];
    return (
      rows.find(
        (p) =>
          (product.paper_type ? p.name === product.paper_type : true) &&
          (product.paper_gsm ? Number(p.gsm) === Number(product.paper_gsm) : true),
      ) ?? null
    );
  }, [papersQ.data, product]);

  const machine = useMemo(() => {
    if (!product?.default_machine_id) return null;
    return ((machinesQ.data ?? []) as any[]).find((m) => m.id === product.default_machine_id) ?? null;
  }, [machinesQ.data, product]);

  const totalColors = COLOR_TO_IMPRESSIONS[colors] * (sides === "2" ? 2 : 1);
  const platesNeeded = COLOR_TO_PLATES[colors] * (sides === "2" ? 2 : 1);

  // Sheets: 1 sheet per piece, doubled for 2-side? Sides don't change sheet count — just impressions. Keep sheets = quantity.
  const sheetsNeeded = Math.max(0, Math.ceil(Number(quantity) || 0));

  const paperRate = Number(paper?.purchase_rate ?? 0);
  const paperCost = sheetsNeeded * paperRate;

  const ctpRow = ((ctpQ.data ?? []) as any[])[0] ?? null;
  const ctpRate = Number(ctpRow?.cost ?? 0);
  const ctpCost = platesNeeded * ctpRate;

  const machineCostPerColor = Number(machine?.cost_per_hour ?? 0); // repurposed as cost-per-color per master rename
  const printingCost = machineCostPerColor * totalColors;

  const sumRates = (rows: any[] | undefined) =>
    (rows ?? []).reduce((acc: number, r: any) => acc + Number(r?.rate ?? 0), 0);

  const dieCuttingCost = sumRates(((finishingQ.data ?? []) as any[]).filter((r) => /die.?cut/i.test(String(r?.name ?? ""))));
  const finishingCost = sumRates(((finishingQ.data ?? []) as any[]).filter((r) => !/die.?cut/i.test(String(r?.name ?? ""))));
  const bindingCost = sumRates(bindingQ.data as any[]);
  const labourCost = sumRates(labourQ.data as any[]);
  const transportCost = sumRates(transportQ.data as any[]);

  const totals = useMemo(
    () =>
      computeTotals({
        paper_cost: paperCost,
        ctp_cost: ctpCost,
        printing_cost: printingCost,
        die_cutting_cost: dieCuttingCost,
        finishing_cost: finishingCost,
        binding_cost: bindingCost,
        labour_cost: labourCost,
        transport_cost: transportCost,
        ink_cost: 0,
        misc_cost: 0,
        profit_pct,
      }),
    [paperCost, ctpCost, printingCost, dieCuttingCost, finishingCost, bindingCost, labourCost, transportCost, profit_pct],
  );

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          values: {
            branch_id: branch_id || null,
            customer_id: customer_id || null,
            delivery_date: delivery_date || null,
            priority: "normal",
            status: "new",
            paper_cost: paperCost,
            ctp_cost: ctpCost,
            printing_cost: printingCost,
            die_cutting_cost: dieCuttingCost,
            ink_cost: 0,
            finishing_cost: finishingCost,
            binding_cost: bindingCost,
            labour_cost: labourCost,
            transport_cost: transportCost,
            misc_cost: 0,
            profit_pct,
          },
          items: product_id
            ? [
                {
                  product_id,
                  description: product?.name ?? null,
                  quantity: Number(quantity) || 1,
                  unit: "pcs",
                  specs: {
                    colors,
                    sides,
                    plates: platesNeeded,
                    sheets: sheetsNeeded,
                    paper_type: product?.paper_type ?? null,
                    paper_gsm: product?.paper_gsm ?? null,
                    product_size: product?.product_size ?? null,
                    machine_id: machine?.id ?? null,
                  },
                  line_total: totals.selling_price,
                },
              ]
            : [],
        },
      }),
    onSuccess: (order: any) => {
      toast.success(`Order ${order.order_no} created`);
      navigate({ to: "/orders/$id", params: { id: order.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const canSubmit = !!branch_id && !!customer_id && !!product_id && quantity > 0;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">New Order</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the essentials — everything else auto-loads from Master Data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Order details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <F label="Branch" required>
                <Select value={branch_id} onValueChange={setBranchId}>
                  <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
                  <SelectContent>
                    {(branchesQ.data ?? []).map((b: any) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name} ({b.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Customer" required>
                <Select value={customer_id} onValueChange={setCustomerId}>
                  <SelectTrigger><SelectValue placeholder="Select customer" /></SelectTrigger>
                  <SelectContent>
                    {((customersQ.data as any)?.rows ?? []).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Product" required>
                <Select value={product_id} onValueChange={setProductId}>
                  <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                  <SelectContent>
                    {((productsQ.data ?? []) as any[]).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </F>
              <F label="Quantity" required>
                <Input
                  type="number"
                  min={1}
                  step="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                />
              </F>
              <F label="Printing Colors" required>
                <Select value={colors} onValueChange={(v) => setColors(v as Colors)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 Color</SelectItem>
                    <SelectItem value="2">2 Color</SelectItem>
                    <SelectItem value="4">4 Color</SelectItem>
                    <SelectItem value="4+4">4 + 4 (Both Sides)</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Printing Side" required>
                <Select value={sides} onValueChange={(v) => setSides(v as "1" | "2")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Single Side</SelectItem>
                    <SelectItem value="2">Both Sides</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Delivery date">
                <Input type="date" value={delivery_date} onChange={(e) => setDeliveryDate(e.target.value)} />
              </F>
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Auto-loaded from Master</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Info label="Paper Type" value={product?.paper_type ?? "—"} />
              <Info label="Paper GSM" value={product?.paper_gsm ?? "—"} />
              <Info label="Product Size" value={product?.product_size ?? "—"} />
              <Info label="Default Machine" value={machine?.name ?? "—"} />
              <Info label="Required Paper Sheets" value={sheetsNeeded.toLocaleString()} />
              <Info label="Required CTP Plates" value={platesNeeded.toString()} />
              <Info label="Total Colors" value={totalColors.toString()} />
              <Info label="Machine Cost/Color" value={formatCurrency(machineCostPerColor)} />
            </div>
            {product && !paper && (
              <p className="mt-3 text-xs text-destructive">
                No paper in master matches this product's type / GSM — paper cost will be 0.
              </p>
            )}
            {product && !machine && (
              <p className="mt-1 text-xs text-destructive">
                No default machine set for this product — printing cost will be 0.
              </p>
            )}
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
              <Row label="Total cost" value={formatCurrency(totals.total_cost)} strong />
              <div className="grid grid-cols-2 items-center gap-2 py-2">
                <Label className="text-xs">Profit %</Label>
                <Input
                  type="number"
                  step="any"
                  value={profit_pct}
                  onChange={(e) => setProfitPct(Number(e.target.value))}
                />
              </div>
              <Row label="Selling price" value={formatCurrency(totals.selling_price)} strong />
              <Row
                label="Net profit"
                value={formatCurrency(totals.net_profit)}
                tone={totals.net_profit >= 0 ? "success" : "destructive"}
              />
            </div>
            <Button
              className="mt-6 w-full"
              disabled={!canSubmit || create.isPending}
              onClick={() => create.mutate()}
            >
              {create.isPending ? "Creating…" : "Create order"}
            </Button>
            {!canSubmit && (
              <p className="mt-2 text-center text-[11px] text-muted-foreground">
                Fill customer, product and quantity to continue.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
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
