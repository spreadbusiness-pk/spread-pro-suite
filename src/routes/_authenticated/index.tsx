import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users,
  ShoppingCart,
  Clock,
  CheckCircle2,
  Wallet,
  TrendingUp,
  CreditCard,
  Plus,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDashboardStats } from "@/lib/customers.functions";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Area,
  AreaChart,
} from "recharts";

export const Route = createFileRoute("/_authenticated/")({
  component: DashboardPage,
});

const salesSeries = [
  { m: "Jan", v: 0 },
  { m: "Feb", v: 0 },
  { m: "Mar", v: 0 },
  { m: "Apr", v: 0 },
  { m: "May", v: 0 },
  { m: "Jun", v: 0 },
  { m: "Jul", v: 0 },
  { m: "Aug", v: 0 },
  { m: "Sep", v: 0 },
  { m: "Oct", v: 0 },
  { m: "Nov", v: 0 },
  { m: "Dec", v: 0 },
];

function DashboardPage() {
  const fetchStats = useServerFn(getDashboardStats);
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchStats() });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Overview</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Live snapshot of your business. Order and revenue metrics activate in Phase 2.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button asChild variant="outline">
            <Link to="/customers">View customers</Link>
          </Button>
          <Button asChild>
            <Link to="/customers">
              <Plus className="mr-1.5 h-4 w-4" /> New customer
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={Users}
          label="Total Customers"
          value={isLoading ? null : String(data?.totalCustomers ?? 0)}
          hint={`${data?.activeCustomers ?? 0} active`}
          accent="primary"
        />
        <MetricCard icon={ShoppingCart} label="Today's Orders" value="0" hint="Phase 2" />
        <MetricCard icon={Clock} label="Pending Orders" value="0" hint="Phase 2" />
        <MetricCard icon={CheckCircle2} label="Completed Orders" value="0" hint="Phase 2" />
        <MetricCard icon={TrendingUp} label="Monthly Sales" value="—" hint="Phase 2" />
        <MetricCard icon={Wallet} label="Today's Revenue" value="—" hint="Phase 2" />
        <MetricCard icon={CreditCard} label="Pending Payments" value="—" hint="Phase 2" />
        <MetricCard icon={CheckCircle2} label="System Status" value="Online" hint="All services healthy" accent="gold" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2 p-6 shadow-elevated">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-display text-lg font-semibold">Monthly Sales</h2>
              <p className="text-xs text-muted-foreground">Ready to plot once orders begin.</p>
            </div>
            <Badge variant="outline" className="border-gold/40 text-gold-foreground">
              Phase 2
            </Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesSeries}>
                <defs>
                  <linearGradient id="salesG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="var(--primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="m" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip
                  contentStyle={{
                    background: "var(--popover)",
                    border: "1px solid var(--border)",
                    borderRadius: 12,
                  }}
                />
                <Area type="monotone" dataKey="v" stroke="var(--primary)" fill="url(#salesG)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 shadow-elevated">
          <h2 className="font-display text-lg font-semibold">Recent Customers</h2>
          <p className="text-xs text-muted-foreground">Latest additions to your CRM.</p>
          <div className="mt-4 space-y-3">
            {isLoading ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full" />)
            ) : data?.recentCustomers.length ? (
              data.recentCustomers.map((c) => (
                <Link
                  key={c.id}
                  to="/customers"
                  className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-soft"
                >
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg gradient-primary text-xs font-semibold text-primary-foreground">
                    {c.company_name?.[0]?.toUpperCase() ?? "C"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{c.company_name}</div>
                    <div className="truncate text-xs text-muted-foreground">{c.customer_code}</div>
                  </div>
                  <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px]">
                    {c.status}
                  </Badge>
                </Link>
              ))
            ) : (
              <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                No customers yet. Add your first one to get started.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: any;
  label: string;
  value: string | null;
  hint?: string;
  accent?: "primary" | "gold";
}) {
  return (
    <Card className="relative overflow-hidden p-5 shadow-soft transition-all hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          <div className="mt-2 font-display text-3xl font-bold">
            {value === null ? <Skeleton className="h-8 w-16" /> : value}
          </div>
          {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div
          className={
            "grid h-10 w-10 shrink-0 place-items-center rounded-xl " +
            (accent === "gold"
              ? "gradient-gold shadow-gold text-gold-foreground"
              : "gradient-primary text-primary-foreground shadow-soft")
          }
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
