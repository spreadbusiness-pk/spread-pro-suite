import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Printer, Download, FileSpreadsheet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getReportData } from "@/lib/reports.functions";
import { listBranches } from "@/lib/branches.functions";
import { listCustomers } from "@/lib/customers.functions";
import { formatCurrency } from "@/lib/costing";
import { CATEGORY_LABEL } from "@/lib/inventory.functions";
import { ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/reports")({
  component: ReportsPage,
  head: () => ({
    meta: [
      { title: "Reports · Spread Business ERP" },
      { name: "description", content: "Sales, receivables, production, profit and inventory reports for Spread Business." },
      { property: "og:title", content: "Reports · Spread Business ERP" },
      { property: "og:description", content: "Sales, receivables, production, profit and inventory reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const num = (v: unknown) => {
  const x = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(x) ? x : 0;
};

function toCsv(rows: (string | number)[][]) {
  return rows
    .map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function downloadCsv(name: string, rows: (string | number)[][]) {
  const blob = new Blob(["\uFEFF" + toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const monthKey = (d?: string) => (d ? String(d).slice(0, 7) : "—");

function ReportsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = `${today.slice(0, 7)}-01`;
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today);
  const [branchId, setBranchId] = useState("all");
  const [customerId, setCustomerId] = useState("all");

  const fetchReport = useServerFn(getReportData);
  const fetchBranches = useServerFn(listBranches);
  const fetchCustomers = useServerFn(listCustomers);

  const branchQ = useQuery({ queryKey: ["report-branches"], queryFn: () => fetchBranches() });
  const custQ = useQuery({ queryKey: ["report-customers"], queryFn: () => fetchCustomers({ data: { pageSize: 500 } }) });
  const reportQ = useQuery({
    queryKey: ["report", from, to, branchId, customerId],
    queryFn: () =>
      fetchReport({
        data: {
          from: from || undefined,
          to: to || undefined,
          branch_id: branchId !== "all" ? branchId : undefined,
          customer_id: customerId !== "all" ? customerId : undefined,
        },
      }),
  });

  const branches = (Array.isArray(branchQ.data) ? branchQ.data : (branchQ.data as any)?.rows ?? []) as any[];
  const customers = ((custQ.data as any)?.rows ?? []) as any[];

  const d = reportQ.data as any;
  const currency = d?.currency ?? "PKR";
  const orders = (d?.orders ?? []) as any[];
  const invoices = (d?.invoices ?? []) as any[];
  const payments = (d?.payments ?? []) as any[];
  const jobs = (d?.jobs ?? []) as any[];
  const inventory = (d?.inventory ?? []) as any[];
  const s = d?.summary ?? { count: 0, revenue: 0, cost: 0, profit: 0, invoiced: 0, received: 0, outstanding: 0, paymentsTotal: 0, jobsTotal: 0 };

  const monthly = useMemo(() => {
    const map: Record<string, { month: string; revenue: number; cost: number; profit: number; orders: number }> = {};
    for (const o of orders) {
      const k = monthKey(o.order_date);
      map[k] = map[k] ?? { month: k, revenue: 0, cost: 0, profit: 0, orders: 0 };
      map[k].revenue += num(o.selling_price);
      map[k].cost += num(o.total_cost);
      map[k].profit += num(o.net_profit);
      map[k].orders += 1;
    }
    return Object.values(map).sort((a, b) => (a.month < b.month ? -1 : 1));
  }, [orders]);

  const byCustomer = useMemo(() => {
    const map: Record<string, { name: string; orders: number; revenue: number; profit: number }> = {};
    for (const o of orders) {
      const name = o.customer?.company_name ?? "—";
      map[name] = map[name] ?? { name, orders: 0, revenue: 0, profit: 0 };
      map[name].orders += 1;
      map[name].revenue += num(o.selling_price);
      map[name].profit += num(o.net_profit);
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const byBranch = useMemo(() => {
    const map: Record<string, { name: string; orders: number; revenue: number; profit: number }> = {};
    for (const o of orders) {
      const name = o.branch?.name ?? "Unassigned";
      map[name] = map[name] ?? { name, orders: 0, revenue: 0, profit: 0 };
      map[name].orders += 1;
      map[name].revenue += num(o.selling_price);
      map[name].profit += num(o.net_profit);
    }
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const costMix = useMemo(() => {
    const keys = [
      ["paper_cost", "Paper"],
      ["ctp_cost", "CTP"],
      ["printing_cost", "Printing"],
      ["die_cutting_cost", "Die Cutting"],
      ["finishing_cost", "Finishing"],
      ["binding_cost", "Binding"],
      ["labour_cost", "Labour"],
      ["transport_cost", "Transport"],
    ] as const;
    return keys.map(([k, label]) => ({ label, value: orders.reduce((t, o) => t + num(o[k]), 0) }));
  }, [orders]);

  const jobsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    for (const j of jobs) map[j.status] = (map[j.status] ?? 0) + 1;
    return Object.entries(map).map(([status, count]) => ({ status, count }));
  }, [jobs]);

  const payByMethod = useMemo(() => {
    const map: Record<string, { method: string; count: number; amount: number }> = {};
    for (const p of payments) {
      const m = p.method ?? "—";
      map[m] = map[m] ?? { method: m, count: 0, amount: 0 };
      map[m].count += 1;
      map[m].amount += num(p.amount);
    }
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [payments]);

  const outstandingInvoices = useMemo(
    () => invoices.filter((i) => num(i.remaining_balance) > 0).sort((a, b) => num(b.remaining_balance) - num(a.remaining_balance)),
    [invoices],
  );

  const inventoryStats = useMemo(() => {
    const value = inventory.reduce((t, i) => t + num(i.current_stock) * num(i.purchase_rate), 0);
    const low = inventory.filter((i) => num(i.current_stock) > 0 && num(i.current_stock) <= num(i.minimum_stock));
    const out = inventory.filter((i) => num(i.current_stock) <= 0);
    return { value, low, out };
  }, [inventory]);

  const loading = reportQ.isLoading;

  return (
    <>
      <style>{`@media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        .report-print { box-shadow: none !important; border: none !important; }
        [role="tabpanel"][hidden] { display: none !important; }
      }`}</style>

      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Analytics</div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Reports</h1>
            <p className="mt-1 text-sm text-muted-foreground">Sales, receivables, production, profit and inventory analytics.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            <Button variant="outline" onClick={() => window.print()}><Download className="mr-1.5 h-4 w-4" /> PDF</Button>
          </div>
        </div>

        <Card className="no-print p-4 shadow-elevated">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Branch</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All customers</SelectItem>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Orders" value={loading ? null : String(s.count)} />
          <Kpi label="Revenue" value={loading ? null : formatCurrency(s.revenue, currency)} accent />
          <Kpi label="Production Cost" value={loading ? null : formatCurrency(s.cost, currency)} />
          <Kpi label="Net Profit" value={loading ? null : formatCurrency(s.profit, currency)} accent />
          <Kpi label="Invoiced" value={loading ? null : formatCurrency(s.invoiced, currency)} />
          <Kpi label="Received" value={loading ? null : formatCurrency(s.received, currency)} />
          <Kpi label="Outstanding" value={loading ? null : formatCurrency(s.outstanding, currency)} />
          <Kpi label="Production Jobs" value={loading ? null : String(s.jobsTotal)} />
        </div>

        {loading ? (
          <Skeleton className="h-96 w-full" />
        ) : (
          <Tabs defaultValue="sales">
            <TabsList className="no-print flex w-full flex-wrap justify-start">
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="orders">Orders</TabsTrigger>
              <TabsTrigger value="outstanding">Outstanding</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="production">Production</TabsTrigger>
              <TabsTrigger value="profit">Profit</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
            </TabsList>

            {/* SALES */}
            <TabsContent value="sales" className="mt-4 space-y-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Monthly sales"
                  subtitle="Revenue, cost and profit per month"
                  onExport={() =>
                    downloadCsv("sales-monthly", [["Month", "Orders", "Revenue", "Cost", "Profit"], ...monthly.map((m) => [m.month, m.orders, m.revenue, m.cost, m.profit])])
                  }
                />
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthly}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: any) => formatCurrency(num(v), currency)} />
                      <Legend />
                      <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="profit" name="Profit" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Sales by customer"
                  onExport={() => downloadCsv("sales-by-customer", [["Customer", "Orders", "Revenue", "Profit"], ...byCustomer.map((c) => [c.name, c.orders, c.revenue, c.profit])])}
                />
                <Table
                  head={["Customer", "Orders", "Revenue", "Profit"]}
                  rows={byCustomer.map((c) => [c.name, String(c.orders), formatCurrency(c.revenue, currency), formatCurrency(c.profit, currency)])}
                  numericFrom={1}
                />
              </Card>

              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Sales by branch"
                  onExport={() => downloadCsv("sales-by-branch", [["Branch", "Orders", "Revenue", "Profit"], ...byBranch.map((c) => [c.name, c.orders, c.revenue, c.profit])])}
                />
                <Table
                  head={["Branch", "Orders", "Revenue", "Profit"]}
                  rows={byBranch.map((c) => [c.name, String(c.orders), formatCurrency(c.revenue, currency), formatCurrency(c.profit, currency)])}
                  numericFrom={1}
                />
              </Card>
            </TabsContent>

            {/* ORDERS */}
            <TabsContent value="orders" className="mt-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Order register"
                  subtitle={`${orders.length} orders in range`}
                  onExport={() =>
                    downloadCsv("orders", [
                      ["Order #", "Date", "Customer", "Branch", "Status", "Cost", "Selling", "Profit"],
                      ...orders.map((o) => [o.order_no, o.order_date, o.customer?.company_name ?? "", o.branch?.name ?? "", o.status, num(o.total_cost), num(o.selling_price), num(o.net_profit)]),
                    ])
                  }
                />
                <Table
                  head={["Order #", "Date", "Customer", "Branch", "Status", "Cost", "Selling", "Profit"]}
                  rows={orders.map((o) => [
                    o.order_no,
                    o.order_date ?? "—",
                    o.customer?.company_name ?? "—",
                    o.branch?.name ?? "—",
                    String(o.status ?? "").replace(/_/g, " "),
                    formatCurrency(num(o.total_cost), currency),
                    formatCurrency(num(o.selling_price), currency),
                    formatCurrency(num(o.net_profit), currency),
                  ])}
                  numericFrom={5}
                />
              </Card>
            </TabsContent>

            {/* OUTSTANDING */}
            <TabsContent value="outstanding" className="mt-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Outstanding receivables"
                  subtitle={`${outstandingInvoices.length} unpaid / partially paid invoices`}
                  onExport={() =>
                    downloadCsv("outstanding", [
                      ["Invoice #", "Date", "Due", "Customer", "Grand total", "Received", "Balance", "Status"],
                      ...outstandingInvoices.map((i) => [i.invoice_no, i.invoice_date, i.due_date ?? "", i.order?.customer?.company_name ?? "", num(i.grand_total), num(i.received_amount), num(i.remaining_balance), i.payment_status]),
                    ])
                  }
                />
                <Table
                  head={["Invoice #", "Date", "Due", "Customer", "Grand total", "Received", "Balance", "Status"]}
                  rows={outstandingInvoices.map((i) => [
                    i.invoice_no,
                    i.invoice_date ?? "—",
                    i.due_date ?? "—",
                    i.order?.customer?.company_name ?? "—",
                    formatCurrency(num(i.grand_total), currency),
                    formatCurrency(num(i.received_amount), currency),
                    formatCurrency(num(i.remaining_balance), currency),
                    String(i.payment_status ?? "").replace(/_/g, " "),
                  ])}
                  numericFrom={4}
                  footer={[
                    "Total",
                    "",
                    "",
                    "",
                    formatCurrency(outstandingInvoices.reduce((t, i) => t + num(i.grand_total), 0), currency),
                    formatCurrency(outstandingInvoices.reduce((t, i) => t + num(i.received_amount), 0), currency),
                    formatCurrency(outstandingInvoices.reduce((t, i) => t + num(i.remaining_balance), 0), currency),
                    "",
                  ]}
                />
              </Card>
            </TabsContent>

            {/* PAYMENTS */}
            <TabsContent value="payments" className="mt-4 space-y-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Collection by method"
                  onExport={() => downloadCsv("payments-by-method", [["Method", "Count", "Amount"], ...payByMethod.map((p) => [p.method, p.count, p.amount])])}
                />
                <Table
                  head={["Method", "Entries", "Amount"]}
                  rows={payByMethod.map((p) => [String(p.method).replace(/_/g, " "), String(p.count), formatCurrency(p.amount, currency)])}
                  numericFrom={1}
                />
              </Card>
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Payment register"
                  subtitle={`${payments.length} payments · ${formatCurrency(s.paymentsTotal, currency)}`}
                  onExport={() =>
                    downloadCsv("payments", [
                      ["Date", "Customer", "Invoice #", "Method", "Reference", "Amount"],
                      ...payments.map((p) => [p.payment_date, p.customer?.company_name ?? "", p.invoice?.invoice_no ?? "", p.method, p.reference_no ?? "", num(p.amount)]),
                    ])
                  }
                />
                <Table
                  head={["Date", "Customer", "Invoice #", "Method", "Reference", "Amount"]}
                  rows={payments.map((p) => [
                    p.payment_date ?? "—",
                    p.customer?.company_name ?? "—",
                    p.invoice?.invoice_no ?? "—",
                    String(p.method ?? "").replace(/_/g, " "),
                    p.reference_no ?? "—",
                    formatCurrency(num(p.amount), currency),
                  ])}
                  numericFrom={5}
                />
              </Card>
            </TabsContent>

            {/* PRODUCTION */}
            <TabsContent value="production" className="mt-4 space-y-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Jobs by stage"
                  onExport={() => downloadCsv("production-by-stage", [["Stage", "Jobs"], ...jobsByStatus.map((j) => [j.status, j.count])])}
                />
                <Table head={["Stage", "Jobs"]} rows={jobsByStatus.map((j) => [String(j.status).replace(/_/g, " "), String(j.count)])} numericFrom={1} />
              </Card>
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Production register"
                  onExport={() =>
                    downloadCsv("production", [
                      ["Job #", "Order #", "Customer", "Machine", "Stage", "Delivery"],
                      ...jobs.map((j) => [j.job_no, j.order?.order_no ?? "", j.order?.customer?.company_name ?? "", j.machine?.name ?? "", j.status, j.order?.delivery_date ?? ""]),
                    ])
                  }
                />
                <Table
                  head={["Job #", "Order #", "Customer", "Machine", "Stage", "Delivery"]}
                  rows={jobs.map((j) => [
                    j.job_no ?? "—",
                    j.order?.order_no ?? "—",
                    j.order?.customer?.company_name ?? "—",
                    j.machine?.name ?? "—",
                    String(j.status ?? "").replace(/_/g, " "),
                    j.order?.delivery_date ?? "—",
                  ])}
                />
              </Card>
            </TabsContent>

            {/* PROFIT */}
            <TabsContent value="profit" className="mt-4 space-y-4">
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Cost breakdown"
                  subtitle="Where production money is spent"
                  onExport={() => downloadCsv("cost-breakdown", [["Head", "Amount"], ...costMix.map((c) => [c.label, c.value])])}
                />
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={costMix}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" fontSize={11} />
                      <YAxis fontSize={11} />
                      <Tooltip formatter={(v: any) => formatCurrency(num(v), currency)} />
                      <Bar dataKey="value" name="Cost" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Order-wise profitability"
                  onExport={() =>
                    downloadCsv("profitability", [
                      ["Order #", "Customer", "Cost", "Selling", "Profit", "Margin %"],
                      ...orders.map((o) => [o.order_no, o.customer?.company_name ?? "", num(o.total_cost), num(o.selling_price), num(o.net_profit), num(o.selling_price) ? ((num(o.net_profit) / num(o.selling_price)) * 100).toFixed(1) : "0"]),
                    ])
                  }
                />
                <Table
                  head={["Order #", "Customer", "Cost", "Selling", "Profit", "Margin %"]}
                  rows={orders.map((o) => [
                    o.order_no,
                    o.customer?.company_name ?? "—",
                    formatCurrency(num(o.total_cost), currency),
                    formatCurrency(num(o.selling_price), currency),
                    formatCurrency(num(o.net_profit), currency),
                    `${num(o.selling_price) ? ((num(o.net_profit) / num(o.selling_price)) * 100).toFixed(1) : "0.0"}%`,
                  ])}
                  numericFrom={2}
                />
              </Card>
            </TabsContent>

            {/* INVENTORY */}
            <TabsContent value="inventory" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Kpi label="Stock value" value={formatCurrency(inventoryStats.value, currency)} accent />
                <Kpi label="Low stock items" value={String(inventoryStats.low.length)} />
                <Kpi label="Out of stock items" value={String(inventoryStats.out.length)} />
              </div>
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Stock valuation"
                  onExport={() =>
                    downloadCsv("stock-valuation", [
                      ["Item", "Category", "Stock", "Unit", "Rate", "Value"],
                      ...inventory.map((i) => [i.name, i.category, num(i.current_stock), i.unit, num(i.purchase_rate), num(i.current_stock) * num(i.purchase_rate)]),
                    ])
                  }
                />
                <Table
                  head={["Item", "Category", "Stock", "Rate", "Value"]}
                  rows={inventory.map((i) => [
                    i.name,
                    (CATEGORY_LABEL as any)[i.category] ?? i.category,
                    `${num(i.current_stock)} ${i.unit ?? ""}`,
                    formatCurrency(num(i.purchase_rate), currency),
                    formatCurrency(num(i.current_stock) * num(i.purchase_rate), currency),
                  ])}
                  numericFrom={2}
                />
              </Card>
              <Card className="report-print p-6 shadow-elevated">
                <SectionHead
                  title="Low & out of stock"
                  onExport={() =>
                    downloadCsv("low-stock", [
                      ["Item", "Category", "Stock", "Minimum", "Supplier"],
                      ...[...inventoryStats.out, ...inventoryStats.low].map((i) => [i.name, i.category, num(i.current_stock), num(i.minimum_stock), i.supplier ?? ""]),
                    ])
                  }
                />
                <Table
                  head={["Item", "Category", "Stock", "Minimum", "Supplier"]}
                  rows={[...inventoryStats.out, ...inventoryStats.low].map((i) => [
                    i.name,
                    (CATEGORY_LABEL as any)[i.category] ?? i.category,
                    String(num(i.current_stock)),
                    String(num(i.minimum_stock)),
                    i.supplier ?? "—",
                  ])}
                  numericFrom={2}
                />
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string | null; accent?: boolean }) {
  return (
    <Card className="p-4 shadow-elevated">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      {value === null ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <div className={`mt-1 font-display text-2xl font-bold ${accent ? "text-primary" : ""}`}>{value}</div>
      )}
    </Card>
  );
}

function SectionHead({ title, subtitle, onExport }: { title: string; subtitle?: string; onExport: () => void }) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <Button className="no-print" variant="outline" size="sm" onClick={onExport}>
        <FileSpreadsheet className="mr-1.5 h-4 w-4" /> Export CSV
      </Button>
    </div>
  );
}

function Table({
  head,
  rows,
  numericFrom,
  footer,
}: {
  head: string[];
  rows: string[][];
  numericFrom?: number;
  footer?: string[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b text-left text-xs uppercase text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} className={`py-2 ${numericFrom != null && i >= numericFrom ? "text-right" : ""}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className="border-b">
              {r.map((c, ci) => (
                <td key={ci} className={`py-1.5 text-xs ${numericFrom != null && ci >= numericFrom ? "text-right font-mono" : ""}`}>{c}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={head.length} className="py-6 text-center text-muted-foreground">No records in the selected range.</td></tr>
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot>
            <tr className="border-t-2 font-semibold">
              {footer.map((c, i) => (
                <td key={i} className={`py-2 text-xs ${numericFrom != null && i >= numericFrom ? "text-right font-mono" : ""}`}>{c}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
