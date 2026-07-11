import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { listInvoices, createInvoice, listInvoiceableOrders } from "@/lib/invoices.functions";
import { formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/invoices/")({ component: InvoicesPage });

const STATUS_OPTIONS = ["draft", "issued", "paid", "cancelled"];
const PAY_OPTIONS = ["unpaid", "partial_paid", "paid"];

function InvoicesPage() {
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [pay, setPay] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState<string>("");
  const navigate = useNavigate();
  const qc = useQueryClient();

  useMemo(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);

  const fetchList = useServerFn(listInvoices);
  const fetchOrders = useServerFn(listInvoiceableOrders);
  const createFn = useServerFn(createInvoice);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["invoices", debounced, status, pay, page],
    queryFn: () => fetchList({ data: { search: debounced, status, payment_status: pay, page, pageSize: 20 } }),
  });
  const ordersQ = useQuery({ queryKey: ["invoiceable-orders"], queryFn: () => fetchOrders(), enabled: open });

  const create = useMutation({
    mutationFn: () => createFn({ data: { order_id: orderId } }),
    onSuccess: (inv: any) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      setOpen(false); setOrderId("");
      toast.success(`Invoice ${inv.invoice_no} created`);
      navigate({ to: "/invoices/$id", params: { id: inv.id } });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (data?.rows ?? []) as any[];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Invoices</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} invoice{total === 1 ? "" : "s"}. Always linked to a sales order.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" /> New invoice</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create invoice from order</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Label>Sales order</Label>
              <Select value={orderId} onValueChange={setOrderId}>
                <SelectTrigger><SelectValue placeholder="Select an order…" /></SelectTrigger>
                <SelectContent>
                  {(ordersQ.data ?? []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.order_no} · {o.customer?.company_name ?? "—"} · {formatCurrency(Number(o.selling_price ?? 0))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Invoice will always reflect the latest order data — no duplication.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button disabled={!orderId || create.isPending} onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search invoice #" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={pay} onValueChange={(v) => { setPay(v); setPage(1); }}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All payments</SelectItem>
              {PAY_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden md:table-cell">Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead className="text-right">Grand total</TableHead>
                <TableHead className="text-right hidden lg:table-cell">Remaining</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 8 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-16 text-center">
                  <p className="font-display text-lg font-semibold">No invoices yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Create your first invoice from a sales order.</p>
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="cursor-pointer hover:bg-muted/40" onClick={() => navigate({ to: "/invoices/$id", params: { id: r.id } })}>
                  <TableCell><Link to="/invoices/$id" params={{ id: r.id }} className="font-mono text-xs font-semibold text-primary hover:underline">{r.invoice_no}</Link></TableCell>
                  <TableCell className="font-mono text-xs">{r.order?.order_no ?? "—"}</TableCell>
                  <TableCell className="text-sm">{r.order?.customer?.company_name ?? "—"}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs">{r.invoice_date}</TableCell>
                  <TableCell><StatusPill v={r.status} /></TableCell>
                  <TableCell><PayPill v={r.payment_status} /></TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(Number(r.grand_total ?? 0))}</TableCell>
                  <TableCell className="text-right hidden lg:table-cell font-mono text-xs">{formatCurrency(Number(r.remaining_balance ?? 0))}</TableCell>
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

export function StatusPill({ v }: { v: string }) {
  const c = v === "paid" ? "bg-success/15 text-success"
    : v === "cancelled" ? "bg-destructive/15 text-destructive"
    : v === "issued" ? "bg-primary/10 text-primary"
    : "bg-muted text-muted-foreground";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${c}`}>{v}</span>;
}
export function PayPill({ v }: { v: string }) {
  const c = v === "paid" ? "bg-success/15 text-success"
    : v === "partial_paid" ? "bg-gold/20 text-gold-foreground"
    : "bg-destructive/10 text-destructive";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${c}`}>{v.replace(/_/g, " ")}</span>;
}
