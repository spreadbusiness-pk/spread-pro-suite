import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Printer, Download } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getCustomerLedger } from "@/lib/payments.functions";
import { listCustomers } from "@/lib/customers.functions";
import { formatCurrency } from "@/lib/costing";

export const Route = createFileRoute("/_authenticated/ledger/")({ component: LedgerPage });

type Entry = {
  date: string;
  type: "invoice" | "payment";
  ref: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
};

function LedgerPage() {
  const [customerId, setCustomerId] = useState<string>("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [payStatus, setPayStatus] = useState("all");

  const fetchCustomers = useServerFn(listCustomers);
  const fetchLedger = useServerFn(getCustomerLedger);

  const custQ = useQuery({
    queryKey: ["ledger-customers"],
    queryFn: () => fetchCustomers({ data: { pageSize: 500 } }),
  });
  const ledgerQ = useQuery({
    queryKey: ["ledger", customerId, from, to, payStatus],
    queryFn: () => fetchLedger({ data: { customer_id: customerId, from: from || undefined, to: to || undefined, payment_status: payStatus } }),
    enabled: !!customerId,
  });

  const customers = (custQ.data?.rows ?? []) as any[];
  const data = ledgerQ.data as any;
  const customer = data?.customer;
  const invoices = (data?.invoices ?? []) as any[];
  const payments = (data?.payments ?? []) as any[];
  const company = data?.company as any;
  const currency = company?.currency ?? "PKR";

  const { entries, invoiceTotal, paymentTotal, outstanding } = useMemo(() => {
    type Raw = { date: string; type: "invoice" | "payment"; ref: string; description: string; debit: number; credit: number };
    const raw: Raw[] = [];
    for (const inv of invoices) {
      raw.push({
        date: inv.invoice_date,
        type: "invoice",
        ref: inv.invoice_no,
        description: `Invoice — Order ${inv.order?.order_no ?? ""}`,
        debit: Number(inv.grand_total ?? 0),
        credit: 0,
      });
    }
    for (const p of payments) {
      raw.push({
        date: p.payment_date,
        type: "payment",
        ref: p.invoice?.invoice_no ?? "—",
        description: `Payment (${(p.method || "").replace(/_/g, " ")})${p.reference_no ? ` · ${p.reference_no}` : ""}`,
        debit: 0,
        credit: Number(p.amount ?? 0),
      });
    }
    raw.sort((a, b) => (a.date === b.date ? (a.type === "invoice" ? -1 : 1) : a.date < b.date ? -1 : 1));
    let bal = 0;
    const rows: Entry[] = raw.map((r) => {
      bal += r.debit - r.credit;
      return { ...r, balance: bal };
    });
    const invT = invoices.reduce((s, i) => s + Number(i.grand_total ?? 0), 0);
    const payT = payments.reduce((s, p) => s + Number(p.amount ?? 0), 0);
    return { entries: rows, invoiceTotal: invT, paymentTotal: payT, outstanding: invT - payT };
  }, [invoices, payments]);

  return (
    <>
      <style>{`@media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        .ledger-print { padding: 0 !important; box-shadow: none !important; border: none !important; }
        .print-only { display: block !important; }
      }
      .print-only { display: none; }`}</style>

      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Accounts</div>
            <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Customer Ledger</h1>
            <p className="mt-1 text-sm text-muted-foreground">Statement of invoices and payments per customer.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" disabled={!customerId} onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            <Button variant="outline" disabled={!customerId} onClick={() => window.print()}><Download className="mr-1.5 h-4 w-4" /> Download PDF</Button>
          </div>
        </div>

        <Card className="no-print p-4 shadow-elevated">
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger><SelectValue placeholder="Select customer…" /></SelectTrigger>
                <SelectContent>
                  {customers.map((c) => <SelectItem key={c.id} value={c.id}>{c.company_name} · {c.customer_code}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">From</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">To</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Payment status</Label>
              <Select value={payStatus} onValueChange={setPayStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="unpaid">Unpaid</SelectItem>
                  <SelectItem value="partial_paid">Partial paid</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {!customerId ? (
          <Card className="p-12 text-center shadow-elevated">
            <p className="font-display text-lg font-semibold">Select a customer</p>
            <p className="mt-1 text-sm text-muted-foreground">Choose a customer above to load their ledger.</p>
          </Card>
        ) : ledgerQ.isLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : (
          <Card className="p-6 shadow-elevated ledger-print">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
              <div className="flex items-start gap-3">
                {company?.logo_url && <img src={company.logo_url} alt="" className="h-12 w-12 rounded object-contain" />}
                <div>
                  <div className="text-lg font-bold">{company?.name ?? "Company"}</div>
                  <div className="text-xs text-muted-foreground">{company?.address ?? ""}</div>
                  <div className="text-xs text-muted-foreground">
                    {company?.phone && <>Ph: {company.phone} · </>}
                    {company?.email ?? ""}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold uppercase">Customer Statement</div>
                <div className="text-xs text-muted-foreground">
                  {from || "—"} → {to || "—"}
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <div className="text-xs uppercase text-muted-foreground">Customer</div>
                <div className="font-semibold">{customer?.company_name}</div>
                <div className="text-xs">{customer?.customer_code} · {customer?.customer_name}</div>
                <div className="text-xs whitespace-pre-line">{customer?.address ?? ""}</div>
                <div className="text-xs">
                  {customer?.mobile && <>Ph: {customer.mobile} · </>}
                  {customer?.email ?? ""}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm sm:justify-self-end">
                <div className="text-muted-foreground">Opening balance</div><div className="text-right font-mono">{formatCurrency(0, currency)}</div>
                <div className="text-muted-foreground">Invoiced total</div><div className="text-right font-mono">{formatCurrency(invoiceTotal, currency)}</div>
                <div className="text-muted-foreground">Payments received</div><div className="text-right font-mono">{formatCurrency(paymentTotal, currency)}</div>
                <div className="font-semibold">Outstanding balance</div><div className="text-right font-mono font-semibold">{formatCurrency(outstanding, currency)}</div>
              </div>
            </div>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Date</th>
                    <th>Type</th>
                    <th>Reference</th>
                    <th>Description</th>
                    <th className="text-right">Debit</th>
                    <th className="text-right">Credit</th>
                    <th className="text-right">Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/30">
                    <td className="py-1.5 text-xs" colSpan={6}>Opening balance</td>
                    <td className="py-1.5 text-right font-mono">{formatCurrency(0, currency)}</td>
                  </tr>
                  {entries.map((e, i) => (
                    <tr key={i} className="border-b">
                      <td className="py-1.5 text-xs">{e.date}</td>
                      <td className="text-xs uppercase">{e.type}</td>
                      <td className="font-mono text-xs">{e.ref}</td>
                      <td className="text-xs">{e.description}</td>
                      <td className="text-right font-mono text-xs">{e.debit ? formatCurrency(e.debit, currency) : ""}</td>
                      <td className="text-right font-mono text-xs">{e.credit ? formatCurrency(e.credit, currency) : ""}</td>
                      <td className="text-right font-mono text-xs">{formatCurrency(e.balance, currency)}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No transactions in the selected range.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-black/60 font-semibold">
                    <td className="py-2" colSpan={4}>Totals</td>
                    <td className="text-right font-mono">{formatCurrency(invoiceTotal, currency)}</td>
                    <td className="text-right font-mono">{formatCurrency(paymentTotal, currency)}</td>
                    <td className="text-right font-mono">{formatCurrency(outstanding, currency)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            <div className="mt-16 flex justify-end">
              <div className="w-64 border-t pt-2 text-center text-xs">Authorized signature</div>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
