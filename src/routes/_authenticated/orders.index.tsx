import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listOrders } from "@/lib/orders.functions";
import { listBranches } from "@/lib/branches.functions";
import { formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/orders/")({ component: OrdersPage });

const STATUS_OPTIONS = [
  "new","artwork_pending","design","customer_approval","approved","plate_making",
  "printing","cutting","lamination","uv","foiling","binding","packing",
  "ready","delivered","cancelled",
];
const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

function OrdersPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [branch, setBranch] = useState<string>("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);

  useMemo(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchList = useServerFn(listOrders);
  const fetchBranches = useServerFn(listBranches);
  const branchesQ = useQuery({ queryKey: ["branches"], queryFn: () => fetchBranches() });
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["orders", debounced, status, branch, priority, page],
    queryFn: () => fetchList({ data: { search: debounced, status, branch_id: branch === "all" ? null : branch, priority, page, pageSize: 20 } }),
  });

  const rows = (data?.rows ?? []) as any[];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Sales</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Orders</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} order{total === 1 ? "" : "s"} across all branches.</p>
        </div>
        <Button asChild><Link to="/orders/new"><Plus className="mr-1.5 h-4 w-4" /> New order</Link></Button>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search by order # or quotation ref" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={branch} onValueChange={(v) => { setBranch(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Branch" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All branches</SelectItem>
              {(branchesQ.data ?? []).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={priority} onValueChange={(v) => { setPriority(v); setPage(1); }}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {PRIORITY_OPTIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Branch</TableHead>
                <TableHead className="hidden lg:table-cell">Delivery</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead className="text-right">Selling</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-display text-lg font-semibold">No orders yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first order — everything else follows.</p>
                  <Button asChild className="mt-4"><Link to="/orders/new"><Plus className="mr-1.5 h-4 w-4" /> New order</Link></Button>
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={(e) => { if ((e.target as HTMLElement).tagName !== "A") window.location.href = `/orders/${r.id}`; }}>
                  <TableCell><Link to="/orders/$id" params={{ id: r.id }} className="font-mono text-xs font-semibold text-primary hover:underline">{r.order_no}</Link></TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.customer?.company_name ?? "—"}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.customer?.customer_code}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.branch?.name ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{r.delivery_date ?? "—"}</TableCell>
                  <TableCell><StatusBadge status={r.status} /></TableCell>
                  <TableCell className="hidden md:table-cell text-xs capitalize">{r.priority}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(Number(r.selling_price ?? 0))}</TableCell>
                  <TableCell className="text-right hidden lg:table-cell font-mono text-xs">{formatCurrency(Number(r.net_profit ?? 0))}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <div className="text-muted-foreground">Page {page} of {totalPages}{isFetching && " · updating…"}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next</Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const label = status?.replace(/_/g, " ") ?? "—";
  const color =
    status === "delivered" ? "bg-success/15 text-success"
    : status === "cancelled" ? "bg-destructive/15 text-destructive"
    : status === "ready" ? "bg-gold/20 text-gold-foreground"
    : "bg-primary/10 text-primary";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}>{label}</span>;
}
