import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { listProductionJobs, PRODUCTION_STATUSES } from "@/lib/production.functions";

export const Route = createFileRoute("/_authenticated/production/")({ component: ProductionListPage });

const PRIORITY_OPTIONS = ["low", "normal", "high", "urgent"];

function ProductionListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [priority, setPriority] = useState("all");
  const [page, setPage] = useState(1);

  useMemo(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchList = useServerFn(listProductionJobs);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["production-jobs", debounced, status, priority, page],
    queryFn: () => fetchList({ data: { search: debounced, status, priority, page, pageSize: 50 } }),
  });
  const rows = (data?.rows ?? []) as any[];
  const total = data?.count ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Shop floor</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Production Queue</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} production job{total === 1 ? "" : "s"}. Jobs are auto-created when an order is approved.</p>
        </div>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search job #, order # or customer" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All stages</SelectItem>
              {PRODUCTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
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
                <TableHead>Job #</TableHead>
                <TableHead>Order #</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden lg:table-cell">Machine</TableHead>
                <TableHead className="hidden md:table-cell">Delivery</TableHead>
                <TableHead className="hidden md:table-cell">Priority</TableHead>
                <TableHead>Stage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-display text-lg font-semibold">No production jobs</p>
                  <p className="mt-1 text-sm text-muted-foreground">Approve a sales order and it will appear here automatically.</p>
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/production/$id", params: { id: r.id } })}>
                  <TableCell><Link to="/production/$id" params={{ id: r.id }} className="font-mono text-xs font-semibold text-primary hover:underline">{r.job_no}</Link></TableCell>
                  <TableCell className="font-mono text-xs">{r.order?.order_no ?? "—"}</TableCell>
                  <TableCell>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{r.order?.customer?.company_name ?? "—"}</div>
                      <div className="truncate text-[11px] text-muted-foreground">{r.order?.customer?.customer_code}</div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">{r.machine?.name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{r.order?.delivery_date ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs capitalize">{r.order?.priority ?? "—"}</TableCell>
                  <TableCell><ProductionBadge status={r.status} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {isFetching && <div className="border-t p-3 text-xs text-muted-foreground">Updating…</div>}
      </Card>
    </div>
  );
}

export function ProductionBadge({ status }: { status: string }) {
  const label = status?.replace(/_/g, " ") ?? "—";
  const color =
    status === "delivered" ? "bg-success/15 text-success"
    : status === "ready_for_delivery" ? "bg-gold/20 text-gold-foreground"
    : status === "pending" ? "bg-muted text-muted-foreground"
    : "bg-primary/10 text-primary";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${color}`}>{label}</span>;
}
