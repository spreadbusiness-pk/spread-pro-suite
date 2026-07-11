import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Printer, Download, Share2, Save, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getInvoice, updateInvoice, deleteInvoice } from "@/lib/invoices.functions";
import { formatCurrency } from "@/lib/costing";
import { StatusPill, PayPill } from "./invoices.index";

export const Route = createFileRoute("/_authenticated/invoices/$id")({ component: InvoiceDetailPage });

function InvoiceDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchFn = useServerFn(getInvoice);
  const updFn = useServerFn(updateInvoice);
  const delFn = useServerFn(deleteInvoice);

  const { data, isLoading } = useQuery({ queryKey: ["invoice", id], queryFn: () => fetchFn({ data: { id } }) });

  const [status, setStatus] = useState("draft");
  const [invoiceDate, setInvoiceDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState(0);
  const [advance, setAdvance] = useState(0);
  const [received, setReceived] = useState(0);
  const [terms, setTerms] = useState("");
  const [confirmDel, setConfirmDel] = useState(false);
  const [seeded, setSeeded] = useState(false);

  const inv = data?.invoice as any;
  const order = data?.order as any;
  const items = (data?.items ?? []) as any[];
  const company = data?.company as any;

  useEffect(() => {
    if (inv && !seeded) {
      setSeeded(true);
      setStatus(inv.status ?? "draft");
      setInvoiceDate(inv.invoice_date ?? "");
      setDueDate(inv.due_date ?? "");
      setDiscount(Number(inv.discount ?? 0));
      setAdvance(Number(inv.advance_payment ?? 0));
      setReceived(Number(inv.received_amount ?? 0));
      setTerms(inv.terms ?? "");
    }
  }, [inv, seeded]);

  // Live totals against latest order
  const subtotal = Number(order?.selling_price ?? 0);
  const grand = Math.max(subtotal - Number(discount || 0), 0);
  const paid = Number(advance || 0) + Number(received || 0);
  const remaining = Math.max(grand - paid, 0);
  const current = grand - paid;

  const save = useMutation({
    mutationFn: () => updFn({
      data: {
        id,
        values: {
          status: status as any,
          invoice_date: invoiceDate || undefined,
          due_date: dueDate || null,
          discount: Number(discount || 0),
          advance_payment: Number(advance || 0),
          received_amount: Number(received || 0),
          terms: terms || null,
        },
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["invoice", id] });
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Invoice saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Invoice deleted"); navigate({ to: "/invoices" }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading || !inv) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  const currency = order?.branch?.currency ?? company?.currency ?? "PKR";
  const customer = order?.customer;

  const shareOnWhatsapp = () => {
    const phone = (customer?.whatsapp ?? customer?.mobile ?? "").replace(/[^\d]/g, "");
    const url = typeof window !== "undefined" ? window.location.href : "";
    const text = [
      `Invoice ${inv.invoice_no}`,
      customer?.company_name ? `For: ${customer.company_name}` : null,
      `Order: ${order?.order_no ?? "—"}`,
      `Grand total: ${formatCurrency(grand, currency)}`,
      `Remaining: ${formatCurrency(remaining, currency)}`,
      url,
    ].filter(Boolean).join("\n");
    const link = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(link, "_blank");
  };

  return (
    <>
      <style>{`@media print {
        .no-print { display: none !important; }
        body { background: #fff !important; }
        .invoice-print { padding: 0 !important; box-shadow: none !important; border: none !important; }
        .print-only { display: block !important; }
      }
      .print-only { display: none; }
      `}</style>

      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/invoices"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Order <Link to="/orders/$id" params={{ id: order?.id ?? "" }} className="text-primary hover:underline">{order?.order_no}</Link>
              </div>
              <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">{inv.invoice_no}</h1>
            </div>
            <StatusPill v={inv.status} />
            <PayPill v={inv.payment_status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print</Button>
            <Button variant="outline" onClick={() => window.print()}><Download className="mr-1.5 h-4 w-4" /> Download PDF</Button>
            <Button variant="outline" onClick={shareOnWhatsapp}><Share2 className="mr-1.5 h-4 w-4" /> WhatsApp</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
          </div>
        </div>

        <div className="no-print grid gap-6 lg:grid-cols-3">
          <Card className="p-6 shadow-elevated lg:col-span-2">
            <h2 className="font-display text-lg font-semibold">Invoice details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <F label="Invoice date"><Input type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></F>
              <F label="Due date"><Input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} /></F>
              <F label="Status">
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{["draft","issued","paid","cancelled"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                </Select>
              </F>
              <F label="Terms & conditions" full>
                <textarea className="min-h-[80px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={terms} onChange={(e) => setTerms(e.target.value)} />
              </F>
            </div>

            <h3 className="mt-8 font-display text-base font-semibold">From the sales order (live)</h3>
            <p className="text-xs text-muted-foreground">These values always mirror the latest order — edit them on the order, not here.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
              <Info label="Customer" value={customer?.company_name} sub={customer?.customer_code} />
              <Info label="Order #" value={order?.order_no} />
              <Info label="Order date" value={order?.order_date} />
              <Info label="Delivery date" value={order?.delivery_date ?? "—"} />
            </div>

            <h3 className="mt-8 font-display text-base font-semibold">Products</h3>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b text-left text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2">Product</th>
                    <th>Size</th>
                    <th>Paper</th>
                    <th>Colors</th>
                    <th>Side</th>
                    <th className="text-right">Qty</th>
                    <th className="text-right">Unit</th>
                    <th className="text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const specs = it.specs ?? {};
                    const qty = Number(it.quantity ?? 0);
                    const total = Number(it.line_total ?? 0);
                    const unit = qty ? total / qty : 0;
                    return (
                      <tr key={it.id} className="border-b">
                        <td className="py-2">{it.product?.name ?? it.description ?? "—"}</td>
                        <td>{specs.product_size ?? it.product?.product_size ?? "—"}</td>
                        <td>{(specs.paper_type ?? it.product?.paper_type ?? "—")}{" "}{(specs.paper_gsm ?? it.product?.paper_gsm) ? `${specs.paper_gsm ?? it.product?.paper_gsm}gsm` : ""}</td>
                        <td>{specs.colors ?? "—"}</td>
                        <td>{specs.sides ?? "—"}</td>
                        <td className="text-right">{qty}</td>
                        <td className="text-right font-mono">{formatCurrency(unit, currency)}</td>
                        <td className="text-right font-mono">{formatCurrency(total, currency)}</td>
                      </tr>
                    );
                  })}
                  {items.length === 0 && (
                    <tr><td colSpan={8} className="py-6 text-center text-muted-foreground">No line items on this order.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Payment</h2>
            <div className="mt-4 space-y-3 text-sm">
              <SumRow label="Subtotal" value={formatCurrency(subtotal, currency)} />
              <div className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">Discount</Label>
                <Input type="number" step="any" value={discount} onChange={(e) => setDiscount(Number(e.target.value))} />
              </div>
              <SumRow label="Grand total" value={formatCurrency(grand, currency)} strong />
              <div className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">Advance payment</Label>
                <Input type="number" step="any" value={advance} onChange={(e) => setAdvance(Number(e.target.value))} />
              </div>
              <div className="grid grid-cols-2 items-center gap-2">
                <Label className="text-xs">Received amount</Label>
                <Input type="number" step="any" value={received} onChange={(e) => setReceived(Number(e.target.value))} />
              </div>
              <SumRow label="Remaining balance" value={formatCurrency(remaining, currency)} strong />
              <SumRow label="Current balance" value={formatCurrency(current, currency)} />
            </div>
            <Button className="mt-6 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
              <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Saving…" : "Save invoice"}
            </Button>
          </Card>
        </div>

        {/* PRINT LAYOUT (A4) */}
        <div className="print-only invoice-print">
          <div className="mx-auto max-w-[800px] p-8 text-[13px] text-black">
            <div className="flex items-start justify-between border-b pb-4">
              <div className="flex items-start gap-3">
                {company?.logo_url && <img src={company.logo_url} alt="" className="h-14 w-14 rounded object-contain" />}
                <div>
                  <div className="text-2xl font-bold">{company?.name ?? "Company"}</div>
                  <div className="text-xs">{company?.address ?? ""}</div>
                  <div className="text-xs">
                    {company?.phone && <>Ph: {company.phone} · </>}
                    {company?.email && <>{company.email} · </>}
                    {company?.website && <>{company.website}</>}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold uppercase">Invoice</div>
                <div className="mt-1 font-mono text-sm">{inv.invoice_no}</div>
                <div className="text-xs">Date: {invoiceDate || inv.invoice_date}</div>
                {dueDate && <div className="text-xs">Due: {dueDate}</div>}
                <div className="text-xs">Order: {order?.order_no}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-6">
              <div>
                <div className="text-xs font-semibold uppercase text-neutral-500">Bill to</div>
                <div className="font-semibold">{customer?.company_name ?? "—"}</div>
                <div className="text-xs">{customer?.customer_name ?? ""}</div>
                <div className="text-xs whitespace-pre-line">{customer?.address ?? ""}</div>
                <div className="text-xs">
                  {customer?.mobile && <>Ph: {customer.mobile} · </>}
                  {customer?.email ?? ""}
                </div>
              </div>
              <div className="text-right text-xs">
                <div><span className="text-neutral-500">Status:</span> {inv.status}</div>
                <div><span className="text-neutral-500">Payment:</span> {inv.payment_status?.replace(/_/g, " ")}</div>
              </div>
            </div>

            <table className="mt-6 w-full border-collapse text-[12px]">
              <thead>
                <tr className="border-b-2 border-black text-left">
                  <th className="py-2">Product</th>
                  <th>Size</th>
                  <th>Paper</th>
                  <th>Colors</th>
                  <th>Side</th>
                  <th className="text-right">Qty</th>
                  <th className="text-right">Unit</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it) => {
                  const specs = it.specs ?? {};
                  const qty = Number(it.quantity ?? 0);
                  const total = Number(it.line_total ?? 0);
                  const unit = qty ? total / qty : 0;
                  return (
                    <tr key={it.id} className="border-b">
                      <td className="py-1.5">{it.product?.name ?? it.description ?? "—"}</td>
                      <td>{specs.product_size ?? it.product?.product_size ?? "—"}</td>
                      <td>{(specs.paper_type ?? it.product?.paper_type ?? "—")}{" "}{(specs.paper_gsm ?? it.product?.paper_gsm) ? `${specs.paper_gsm ?? it.product?.paper_gsm}gsm` : ""}</td>
                      <td>{specs.colors ?? "—"}</td>
                      <td>{specs.sides ?? "—"}</td>
                      <td className="text-right">{qty}</td>
                      <td className="text-right">{formatCurrency(unit, currency)}</td>
                      <td className="text-right">{formatCurrency(total, currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="mt-4 flex justify-end">
              <div className="w-72 text-sm">
                <PrintRow label="Subtotal" value={formatCurrency(subtotal, currency)} />
                <PrintRow label="Discount" value={formatCurrency(Number(discount || 0), currency)} />
                <PrintRow label="Grand total" value={formatCurrency(grand, currency)} strong />
                <PrintRow label="Advance" value={formatCurrency(Number(advance || 0), currency)} />
                <PrintRow label="Received" value={formatCurrency(Number(received || 0), currency)} />
                <PrintRow label="Remaining balance" value={formatCurrency(remaining, currency)} strong />
                <PrintRow label="Current balance" value={formatCurrency(current, currency)} />
              </div>
            </div>

            {terms && (
              <div className="mt-6">
                <div className="text-xs font-semibold uppercase text-neutral-500">Terms & conditions</div>
                <div className="whitespace-pre-line text-xs">{terms}</div>
              </div>
            )}

            <div className="mt-16 flex justify-end">
              <div className="w-64 border-t pt-2 text-center text-xs">Authorized signature</div>
            </div>
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete invoice?</AlertDialogTitle>
            <AlertDialogDescription>This removes {inv.invoice_no}. The underlying order is not affected.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function F({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}><Label className="text-xs">{label}</Label>{children}</div>;
}
function Info({ label, value, sub }: { label: string; value?: string | null; sub?: string | null }) {
  return (
    <div className="space-y-0.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-medium">{value ?? "—"}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}
function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${strong ? "border-t pt-2 text-base font-semibold" : "text-muted-foreground"}`}>
      <span>{label}</span><span className="font-mono">{value}</span>
    </div>
  );
}
function PrintRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between py-0.5 ${strong ? "border-t border-black pt-1 font-bold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
