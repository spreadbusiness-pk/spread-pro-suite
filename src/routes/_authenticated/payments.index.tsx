import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listPayments, createPayment, deletePayment,
  listInvoicesForPayment, getInvoiceForPayment,
} from "@/lib/payments.functions";
import { formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/payments/")({ component: PaymentsPage });

const METHOD_OPTIONS: { value: string; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank_transfer", label: "Bank Transfer" },
  { value: "cheque", label: "Cheque" },
  { value: "jazzcash", label: "JazzCash" },
  { value: "easypaisa", label: "EasyPaisa" },
  { value: "online_transfer", label: "Online Transfer" },
];

function PaymentsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [delId, setDelId] = useState<string | null>(null);

  const fetchList = useServerFn(listPayments);
  const delFn = useServerFn(deletePayment);

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["payments", search, method, from, to, page],
    queryFn: () => fetchList({ data: { search, method, from: from || undefined, to: to || undefined, page, pageSize: 25 } }),
  });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      qc.invalidateQueries({ queryKey: ["ledger"] });
      toast.success("Payment deleted");
      setDelId(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const rows = (data?.rows ?? []) as any[];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 25));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Billing</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Payments</h1>
          <p className="mt-1 text-sm text-muted-foreground">{total} payment{total === 1 ? "" : "s"}. Always linked to an invoice.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="mr-1.5 h-4 w-4" /> Record payment</Button>
          </DialogTrigger>
          <NewPaymentDialog onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); }} />
        </Dialog>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search reference / notes" className="pl-9" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          </div>
          <Select value={method} onValueChange={(v) => { setMethod(v); setPage(1); }}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" className="w-40" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} />
          <Input type="date" className="w-40" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} />
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Invoice</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-display text-lg font-semibold">No payments yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Record your first payment against an invoice.</p>
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="text-xs">{r.payment_date}</TableCell>
                  <TableCell>
                    {r.invoice ? (
                      <Link to="/invoices/$id" params={{ id: r.invoice_id }} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {r.invoice.invoice_no}
                      </Link>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{r.customer?.company_name ?? "—"}</TableCell>
                  <TableCell><span className="text-xs uppercase tracking-wide">{(r.method || "").replace(/_/g, " ")}</span></TableCell>
                  <TableCell className="text-xs">{r.reference_no ?? "—"}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{formatCurrency(Number(r.amount ?? 0))}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => setDelId(r.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
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

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete payment?</AlertDialogTitle>
            <AlertDialogDescription>Only admins can delete. The invoice balance will recalculate automatically.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && del.mutate(delId)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function NewPaymentDialog({ onDone }: { onDone: () => void }) {
  const fetchInvoices = useServerFn(listInvoicesForPayment);
  const fetchInvoice = useServerFn(getInvoiceForPayment);
  const createFn = useServerFn(createPayment);

  const [invoiceId, setInvoiceId] = useState("");
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<string>("cash");
  const [reference, setReference] = useState("");
  const [amount, setAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");

  const invsQ = useQuery({ queryKey: ["pay-invoices"], queryFn: () => fetchInvoices({ data: {} }) });
  const invQ = useQuery({
    queryKey: ["pay-invoice", invoiceId],
    queryFn: () => fetchInvoice({ data: { invoice_id: invoiceId } }),
    enabled: !!invoiceId,
  });

  const inv = invQ.data as any;
  const grand = Number(inv?.grand_total ?? 0);
  const advance = Number(inv?.advance_payment ?? 0);
  const received = Number(inv?.received_amount ?? 0);
  const totalReceived = advance + received + Number(amount || 0);
  const remaining = Math.max(grand - totalReceived, 0);

  useEffect(() => {
    if (inv && amount === 0) {
      setAmount(Math.max(Number(inv.remaining_balance ?? 0), 0));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inv?.id]);

  const save = useMutation({
    mutationFn: () => createFn({
      data: {
        invoice_id: invoiceId,
        payment_date: paymentDate,
        method: method as any,
        reference_no: reference || null,
        amount: Number(amount || 0),
        notes: notes || null,
      },
    }),
    onSuccess: () => { toast.success("Payment recorded"); onDone(); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Invoice" full>
          <Select value={invoiceId} onValueChange={setInvoiceId}>
            <SelectTrigger><SelectValue placeholder="Select invoice…" /></SelectTrigger>
            <SelectContent>
              {(invsQ.data ?? []).map((i: any) => (
                <SelectItem key={i.id} value={i.id}>
                  {i.invoice_no} · {i.order?.customer?.company_name ?? "—"} · {formatCurrency(Number(i.remaining_balance ?? 0))} due
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Payment date"><Input type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} /></Field>
        <Field label="Payment method">
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHOD_OPTIONS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Reference #"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Cheque / txn id" /></Field>
        <Field label="Amount received"><Input type="number" step="any" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
        <Field label="Notes" full>
          <textarea className="min-h-[60px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>

      {inv && (
        <div className="mt-2 rounded-md border bg-muted/30 p-3 text-sm">
          <div className="mb-1 font-medium">{inv.invoice_no} · {inv.order?.customer?.company_name}</div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>Invoice total</div><div className="text-right font-mono">{formatCurrency(grand)}</div>
            <div>Advance received</div><div className="text-right font-mono">{formatCurrency(advance)}</div>
            <div>Previously received</div><div className="text-right font-mono">{formatCurrency(received)}</div>
            <div>Current payment</div><div className="text-right font-mono">{formatCurrency(Number(amount || 0))}</div>
            <div className="font-semibold">Total received</div><div className="text-right font-mono font-semibold">{formatCurrency(totalReceived)}</div>
            <div className="font-semibold">Remaining balance</div><div className="text-right font-mono font-semibold">{formatCurrency(remaining)}</div>
          </div>
        </div>
      )}

      <DialogFooter>
        <Button disabled={!invoiceId || save.isPending || Number(amount) <= 0} onClick={() => save.mutate()}>
          {save.isPending ? "Saving…" : "Save payment"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
