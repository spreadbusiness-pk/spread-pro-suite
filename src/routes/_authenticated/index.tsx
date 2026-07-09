import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, ShoppingCart, Clock, CheckCircle2, TrendingUp, Plus, Package, Truck, AlertTriangle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/customers.functions";
import { getOrderDashboard } from "@/lib/orders.functions";
import { formatCurrency } from "@/lib/costing";
import {
  ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({ component: DashboardPage });

function DashboardPage() {
  const fetchStats = useServerFn(getDashboardStats);
  const fetchOrders = useServerFn(getOrderDashboard);
  const custQ = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchStats() });
  const ordQ = useQuery({ queryKey: ["order-dashboard"], queryFn: () => fetchOrders() });

  const isLoading = custQ.isLoading || ordQ.isLoading;
  const branches = ordQ.data?.branches ?? [];
  const lowStock = ordQ.data?.lowStock ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overview</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Live snapshot of orders, revenue, and branches.</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline"><Link to="/orders">View orders</Link></Button>
          <Button asChild><Link to="/orders/new"><Plus className="mr-1.5 h-4 w-4" /> New order</Link></Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={Users} label="Total Customers" value={isLoading ? null : String(custQ.data?.totalCustomers ?? 0)} hint={`${custQ.data?.activeCustomers ?? 0} active`} accent="primary" />
        <MetricCard icon={ShoppingCart} label="Total Orders" value={isLoading ? null : String(ordQ.data?.totalOrders ?? 0)} />
        <MetricCard icon={Clock} label="Pending Orders" value={isLoading ? null : String(ordQ.data?.pendingOrders ?? 0)} />
        <MetricCard icon={CheckCircle2} label="Today's Orders" value={isLoading ? null : String(ordQ.data?.todayOrders ?? 0)} />
        <MetricCard icon={Truck} label="Delivered Today" value={isLoading ? null : String(ordQ.data?.deliveredToday ?? 0)} />
        <MetricCard icon={TrendingUp} label="Total Revenue" value={isLoading ? null : formatCurrency(branches.reduce((s: number, b: any) => s + b.revenue, 0))} accent="gold" />
        <MetricCard icon={TrendingUp} label="Net Profit" value={isLoading ? null : formatCurrency(branches.reduce((s: number, b: any) => s + b.profit, 0))} accent="gold" />
        <MetricCard icon={AlertTriangle} label="Low Stock Alerts" value={isLoading ? null : String(lowStock.length)} hint={lowStock.length ? "Papers at or below minimum" : "All stock healthy"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Revenue by Branch</h2>
              <p className="text-xs text-muted-foreground">Orders, revenue and profit per branch.</p>
            </div>
          </div>
          <div className="h-72">
            {branches.length === 0 ? (
              <div className="grid h-full place-items-center text-sm text-muted-foreground">Create branches and orders to see revenue here.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={branches}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 12 }} />
                  <Bar dataKey="revenue" fill="var(--primary)" radius={[6, 6, 0, 0]} name="Revenue" />
                  <Bar dataKey="profit" fill="var(--gold)" radius={[6, 6, 0, 0]} name="Profit" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        <Card className="p-6 shadow-elevated">
          <h2 className="font-display text-lg font-semibold">Branches</h2>
          <div className="mt-4 space-y-3">
            {isLoading ? [0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />) : branches.length === 0 ? (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No branches yet. <Link to="/branches" className="text-primary underline">Create one</Link>.</p>
            ) : branches.map((b: any) => (
              <div key={b.code} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-xs font-semibold text-primary-foreground">{b.code?.slice(0, 2)}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{b.name}</div>
                  <div className="truncate text-xs text-muted-foreground">{b.orders} orders · {formatCurrency(b.revenue)}</div>
                </div>
                <Badge variant="secondary" className="text-[10px]">{formatCurrency(b.profit)}</Badge>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-6 shadow-elevated">
          <div className="flex items-center gap-2"><Package className="h-4 w-4 text-gold" /><h2 className="font-display text-lg font-semibold">Low stock alerts</h2></div>
          <div className="mt-4 space-y-2">
            {lowStock.length === 0 ? <p className="text-sm text-muted-foreground">All paper stock is healthy.</p> : lowStock.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                <div className="min-w-0"><div className="truncate font-medium">{p.name}</div><div className="text-xs text-muted-foreground">Min: {p.minimum_stock}</div></div>
                <Badge className="bg-destructive/15 text-destructive">{p.current_stock} left</Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6 shadow-elevated">
          <h2 className="font-display text-lg font-semibold">Recent Customers</h2>
          <div className="mt-4 space-y-3">
            {custQ.isLoading ? [0,1,2].map((i) => <Skeleton key={i} className="h-14 w-full" />) : custQ.data?.recentCustomers.length ? (
              custQ.data.recentCustomers.map((c) => (
                <Link key={c.id} to="/customers" className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-soft">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-xs font-semibold text-primary-foreground">{c.company_name?.[0]?.toUpperCase() ?? "C"}</div>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{c.company_name}</div><div className="truncate text-xs text-muted-foreground">{c.customer_code}</div></div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                </Link>
              ))
            ) : <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">No customers yet.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, hint, accent }: { icon: any; label: string; value: string | null; hint?: string; accent?: "primary" | "gold" }) {
  return (
    <Card className="relative overflow-hidden p-5 shadow-soft transition-all hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-2 font-display text-2xl font-bold sm:text-3xl">{value === null ? <Skeleton className="h-8 w-16" /> : value}</div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={"grid h-10 w-10 shrink-0 place-items-center rounded-xl " + (accent === "gold" ? "gradient-gold shadow-gold text-gold-foreground" : "gradient-primary text-primary-foreground shadow-soft")}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
