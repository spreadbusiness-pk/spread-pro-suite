import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Copy, Printer, Trash2, Upload, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getOrder, updateOrder, updateOrderStatus, deleteOrder, duplicateOrder,
  signOrderFile, recordOrderFile, deleteOrderFile,
} from "@/lib/orders.functions";
import { computeTotals, formatCurrency } from "@/lib/costing";
import { supabase } from "@/integrations/supabase/client";
import { StatusBadge } from "./orders.index";

export const Route = createFileRoute("/_authenticated/orders/$id")({ component: OrderDetailPage });

const STATUSES = [
  "new","artwork_pending","design","customer_approval","plate_making",
  "printing","cutting","lamination","uv","foiling","binding","packing",
  "ready","delivered","cancelled",
];

function OrderDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const fetchOrder = useServerFn(getOrder);
  const updateFn = useServerFn(updateOrder);
  const statusFn = useServerFn(updateOrderStatus);
  const delFn = useServerFn(deleteOrder);
  const dupFn = useServerFn(duplicateOrder);
  const signFn = useServerFn(signOrderFile);
  const recordFn = useServerFn(recordOrderFile);
  const deleteFileFn = useServerFn(deleteOrderFile);

  const { data, isLoading } = useQuery({ queryKey: ["order", id], queryFn: () => fetchOrder({ data: { id } }) });
  const [confirmDel, setConfirmDel] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const order = data?.order as any;
  const items = (data?.items ?? []) as any[];
  const files = (data?.files ?? []) as any[];
  const timeline = (data?.timeline ?? []) as any[];

  // Editable costing state seeded from the loaded order
  const [edit, setEdit] = useState<Record<string, number>>({});
  const [profitPct, setProfitPct] = useState<number>(25);
  const [override, setOverride] = useState<string>("");
  const [deliveryDate, setDeliveryDate] = useState<string>("");
  const [priority, setPriority] = useState<string>("normal");
  const [internal, setInternal] = useState("");
  const [remarks, setRemarks] = useState("");

  const seeded = useRef(false);
  useMemo(() => {
    if (order && !seeded.current) {
      seeded.current = true;
      setEdit({
        paper_cost: Number(order.paper_cost), ctp_cost: Number(order.ctp_cost),
        printing_cost: Number(order.printing_cost), ink_cost: Number(order.ink_cost),
        finishing_cost: Number(order.finishing_cost), binding_cost: Number(order.binding_cost),
        labour_cost: Number(order.labour_cost), transport_cost: Number(order.transport_cost),
        misc_cost: Number(order.misc_cost),
      });
      setProfitPct(Number(order.profit_pct ?? 25));
      setDeliveryDate(order.delivery_date ?? "");
      setPriority(order.priority ?? "normal");
      setInternal(order.internal_notes ?? "");
      setRemarks(order.customer_remarks ?? "");
    }
  }, [order]);

  const totals = useMemo(() => computeTotals({ ...edit, profit_pct: profitPct, override_selling: override ? Number(override) : null }), [edit, profitPct, override]);

  const save = useMutation({
    mutationFn: async () => updateFn({
      data: {
        id,
        values: {
          branch_id: order.branch_id, customer_id: order.customer_id,
          quotation_ref: order.quotation_ref, order_date: order.order_date,
          delivery_date: deliveryDate || null, priority: priority as any,
          status: order.status, customer_remarks: remarks || null, internal_notes: internal || null,
          ...edit, profit_pct: profitPct, override_selling: override ? Number(override) : null,
        },
      },
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", id] }); qc.invalidateQueries({ queryKey: ["orders"] }); toast.success("Order updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const setStatus = useMutation({
    mutationFn: (newStatus: string) => statusFn({ data: { id, status: newStatus } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", id] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Order deleted"); navigate({ to: "/orders" }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const dup = useMutation({
    mutationFn: () => dupFn({ data: { id } }),
    onSuccess: (o: any) => { toast.success(`Duplicated to ${o.order_no}`); navigate({ to: "/orders/$id", params: { id: o.id } }); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const upload = useMutation({
    mutationFn: async (file: File) => {
      const path = `${id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage.from("order-files").upload(path, file);
      if (error) throw new Error(error.message);
      await recordFn({ data: { order_id: id, path, filename: file.name, mime: file.type, size: file.size } });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", id] }); toast.success("File uploaded"); },
    onError: (e: any) => toast.error(e?.message ?? "Upload failed"),
  });

  const openFile = async (path: string) => {
    const { url } = await signFn({ data: { path } });
    if (url) window.open(url, "_blank");
  };

  const removeFile = useMutation({
    mutationFn: (f: any) => deleteFileFn({ data: { id: f.id, path: f.path } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["order", id] }); toast.success("File removed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading || !order) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  const currency = order.branch?.currency ?? "PKR";

  return (
    <>
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff !important; } .job-card { padding: 0 !important; } }`}</style>

      <div className="space-y-6">
        <div className="no-print flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/orders"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{order.branch?.name ?? "No branch"}</div>
              <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">{order.order_no}</h1>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={order.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Job card</Button>
            <Button variant="outline" onClick={() => dup.mutate()}><Copy className="mr-1.5 h-4 w-4" /> Duplicate</Button>
            <Button variant="outline" className="text-destructive" onClick={() => setConfirmDel(true)}><Trash2 className="mr-1.5 h-4 w-4" /> Delete</Button>
          </div>
        </div>

        <Tabs defaultValue="details" className="no-print">
          <TabsList>
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="costing">Costing</TabsTrigger>
            <TabsTrigger value="items">Items ({items.length})</TabsTrigger>
            <TabsTrigger value="files">Files ({files.length})</TabsTrigger>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="mt-4">
            <Card className="p-6 shadow-elevated">
              <div className="grid gap-4 sm:grid-cols-2">
                <Info label="Customer" value={order.customer?.company_name} sub={order.customer?.customer_code} />
                <Info label="Order date" value={order.order_date} />
                <F label="Delivery date"><Input type="date" value={deliveryDate ?? ""} onChange={(e) => setDeliveryDate(e.target.value)} /></F>
                <F label="Priority">
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["low","normal","high","urgent"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </F>
                <F label="Customer remarks" full><textarea className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={remarks} onChange={(e) => setRemarks(e.target.value)} /></F>
                <F label="Internal notes" full><textarea className="min-h-[70px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={internal} onChange={(e) => setInternal(e.target.value)} /></F>
              </div>
              <div className="mt-6 flex justify-end"><Button onClick={() => save.mutate()} disabled={save.isPending}><Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Saving…" : "Save changes"}</Button></div>
            </Card>
          </TabsContent>

          <TabsContent value="costing" className="mt-4">
            <div className="grid gap-6 lg:grid-cols-3">
              <Card className="p-6 shadow-elevated lg:col-span-2">
                <h2 className="font-display text-lg font-semibold">Cost breakdown</h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  {(["paper_cost","ctp_cost","printing_cost","ink_cost","finishing_cost","binding_cost","labour_cost","transport_cost","misc_cost"] as const).map((k) => (
                    <div key={k} className="space-y-1.5">
                      <Label className="text-xs capitalize">{k.replace(/_/g, " ").replace(" cost", "")}</Label>
                      <Input type="number" step="any" value={edit[k] ?? 0} onChange={(e) => setEdit({ ...edit, [k]: Number(e.target.value) })} />
                    </div>
                  ))}
                </div>
              </Card>
              <Card className="p-6 shadow-elevated">
                <h2 className="font-display text-lg font-semibold">Summary</h2>
                <div className="mt-4 space-y-2 text-sm">
                  <SumRow label="Total cost" value={formatCurrency(totals.total_cost, currency)} strong />
                  <div className="grid grid-cols-2 items-center gap-2 py-2">
                    <Label className="text-xs">Profit %</Label>
                    <Input type="number" step="any" value={profitPct} onChange={(e) => setProfitPct(Number(e.target.value))} />
                  </div>
                  <div className="grid grid-cols-2 items-center gap-2 pb-2">
                    <Label className="text-xs">Override selling</Label>
                    <Input type="number" step="any" value={override} placeholder="Auto" onChange={(e) => setOverride(e.target.value)} />
                  </div>
                  <SumRow label="Selling price" value={formatCurrency(totals.selling_price, currency)} strong />
                  <SumRow label="Net profit" value={formatCurrency(totals.net_profit, currency)} />
                </div>
                <Button className="mt-6 w-full" onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save costing"}</Button>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="items" className="mt-4">
            <Card className="p-6 shadow-elevated">
              {items.length === 0 ? <p className="text-sm text-muted-foreground">No line items on this order.</p> : (
                <div className="space-y-2">
                  {items.map((it) => (
                    <div key={it.id} className="grid grid-cols-[minmax(0,2fr)_120px_120px_120px] items-center gap-3 rounded-lg border p-3 text-sm">
                      <div>
                        <div className="font-medium">{it.product?.name ?? it.description ?? "Item"}</div>
                        {it.description && it.product && <div className="text-xs text-muted-foreground">{it.description}</div>}
                      </div>
                      <div className="text-muted-foreground">{Number(it.quantity)} {it.unit}</div>
                      <div className="text-right font-mono">{formatCurrency(Number(it.line_total), currency)}</div>
                      <div />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <Card className="p-6 shadow-elevated">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-display text-lg font-semibold">Artwork &amp; files</h2>
                  <p className="text-xs text-muted-foreground">PDF, AI, CDR, PSD, EPS, JPG, PNG, ZIP · up to 25MB each</p>
                </div>
                <input ref={fileInput} type="file" className="hidden" accept=".pdf,.ai,.cdr,.psd,.eps,.jpg,.jpeg,.png,.zip" onChange={async (e) => {
                  const f = e.target.files?.[0]; if (!f) return;
                  if (f.size > 25 * 1024 * 1024) { toast.error("Max 25MB"); return; }
                  upload.mutate(f); e.target.value = "";
                }} />
                <Button onClick={() => fileInput.current?.click()} disabled={upload.isPending}><Upload className="mr-1.5 h-4 w-4" /> {upload.isPending ? "Uploading…" : "Upload file"}</Button>
              </div>
              <div className="mt-4 space-y-2">
                {files.length === 0 ? <p className="text-sm text-muted-foreground">No files yet.</p> : files.map((f) => (
                  <div key={f.id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <button type="button" onClick={() => openFile(f.path)} className="min-w-0 flex-1 truncate text-left text-primary hover:underline">{f.filename}</button>
                    <span className="mx-3 text-xs text-muted-foreground">{formatSize(f.size)}</span>
                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => removeFile.mutate(f)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <Card className="p-6 shadow-elevated">
              <ol className="relative space-y-4 border-l pl-6">
                {timeline.map((t) => (
                  <li key={t.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-primary" />
                    <div className="flex items-center gap-2 text-sm"><StatusBadge status={t.status ?? ""} /><span className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</span></div>
                    {t.note && <div className="mt-1 text-sm">{t.note}</div>}
                  </li>
                ))}
                {timeline.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
              </ol>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Print / Job Card layout */}
        <div className="job-card hidden print:block">
          <div className="border-b pb-4">
            <h1 className="text-3xl font-bold">Job Card — {order.order_no}</h1>
            <p className="mt-1 text-sm">Branch: {order.branch?.name} ({order.branch?.code}) · Priority: {order.priority}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="font-semibold">Customer</div>
              <div>{order.customer?.company_name}</div>
              <div className="text-xs">{order.customer?.customer_code} · {order.customer?.mobile ?? ""}</div>
            </div>
            <div>
              <div className="font-semibold">Dates</div>
              <div>Order: {order.order_date}</div>
              <div>Delivery: {order.delivery_date ?? "—"}</div>
            </div>
          </div>
          {items.length > 0 && (
            <div className="mt-6">
              <div className="font-semibold">Items</div>
              <table className="mt-2 w-full text-sm">
                <thead><tr className="border-b text-left"><th className="py-1">Item</th><th>Qty</th><th>Unit</th></tr></thead>
                <tbody>{items.map((it) => (<tr key={it.id} className="border-b"><td className="py-1">{it.product?.name ?? it.description}</td><td>{Number(it.quantity)}</td><td>{it.unit}</td></tr>))}</tbody>
              </table>
            </div>
          )}
          <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
            <div>
              <div className="font-semibold">Customer remarks</div>
              <div className="whitespace-pre-wrap">{order.customer_remarks ?? "—"}</div>
            </div>
            <div>
              <div className="font-semibold">Costing</div>
              <div>Total: {formatCurrency(Number(order.total_cost), currency)}</div>
              <div>Selling: {formatCurrency(Number(order.selling_price), currency)}</div>
            </div>
          </div>
        </div>

        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete order {order.order_no}?</AlertDialogTitle>
              <AlertDialogDescription>All items, files and timeline entries will be deleted. This action cannot be undone.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </>
  );
}

function F({ label, full, children }: { label: string; full?: boolean; children: React.ReactNode }) {
  return <div className={(full ? "sm:col-span-2 " : "") + "space-y-1.5"}><Label className="text-xs">{label}</Label>{children}</div>;
}
function Info({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return <div className="rounded-lg border bg-muted/30 p-3"><div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div><div className="mt-1 text-sm font-medium">{value ?? "—"}</div>{sub && <div className="text-xs text-muted-foreground">{sub}</div>}</div>;
}
function SumRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return <div className={"flex items-center justify-between border-t pt-2 " + (strong ? "text-base" : "text-sm")}><span className="text-muted-foreground">{label}</span><span className={strong ? "font-display font-bold" : "font-mono"}>{value}</span></div>;
}
function formatSize(bytes?: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
