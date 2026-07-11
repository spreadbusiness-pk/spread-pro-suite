import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import QRCode from "qrcode";
import { ArrowLeft, Play, Printer, CheckCircle2, Save } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  getProductionJob,
  updateProductionStatus,
  startProductionJob,
  completeProductionJob,
  updateJobDetails,
  PRODUCTION_STATUSES,
} from "@/lib/production.functions";
import { ProductionBadge } from "./production.index";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/production/$id")({ component: ProductionDetailPage });

function ProductionDetailPage() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const fetchJob = useServerFn(getProductionJob);
  const statusFn = useServerFn(updateProductionStatus);
  const startFn = useServerFn(startProductionJob);
  const completeFn = useServerFn(completeProductionJob);
  const detailsFn = useServerFn(updateJobDetails);

  const { data, isLoading } = useQuery({ queryKey: ["production-job", id], queryFn: () => fetchJob({ data: { id } }) });
  const [instructions, setInstructions] = useState("");
  const [machineId, setMachineId] = useState<string>("");
  const [machines, setMachines] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    (supabase as any).from("machines").select("id,name").then(({ data }: any) => setMachines((data ?? []) as any[]));
  }, []);

  useEffect(() => {
    if (data?.job) {
      setInstructions(data.job.special_instructions ?? "");
      setMachineId(data.job.assigned_machine_id ?? "none");
    }
  }, [data?.job?.id]);

  const jobUrl = useMemo(() => (typeof window !== "undefined" ? `${window.location.origin}/production/${id}` : `/production/${id}`), [id]);
  useEffect(() => { QRCode.toDataURL(jobUrl, { width: 220, margin: 1 }).then(setQrDataUrl).catch(() => setQrDataUrl("")); }, [jobUrl]);

  const setStatus = useMutation({
    mutationFn: (s: string) => statusFn({ data: { id, status: s as any } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production-job", id] }); qc.invalidateQueries({ queryKey: ["production-jobs"] }); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const start = useMutation({
    mutationFn: () => startFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production-job", id] }); qc.invalidateQueries({ queryKey: ["production-jobs"] }); toast.success("Production started"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const complete = useMutation({
    mutationFn: () => completeFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production-job", id] }); qc.invalidateQueries({ queryKey: ["production-jobs"] }); toast.success("Job completed"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const saveDetails = useMutation({
    mutationFn: () => detailsFn({ data: { id, assigned_machine_id: machineId && machineId !== "none" ? machineId : null, special_instructions: instructions || null } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["production-job", id] }); toast.success("Job details saved"); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  if (isLoading || !data?.job) {
    return <div className="space-y-4"><Skeleton className="h-10 w-64" /><Skeleton className="h-64 w-full" /></div>;
  }

  const job = data.job as any;
  const order = job.order as any;
  const items = (data.items ?? []) as any[];
  const firstItem = items[0];
  const specs = (firstItem?.specs ?? {}) as any;
  const productName = firstItem?.product?.name ?? firstItem?.description ?? "—";
  const productSize = specs.product_size ?? firstItem?.product?.product_size ?? "—";
  const paperType = specs.paper_type ?? firstItem?.product?.paper_type ?? "—";
  const paperGsm = specs.paper_gsm ?? firstItem?.product?.paper_gsm ?? "—";
  const colors = specs.colors ?? "—";
  const side = specs.sides ?? specs.side ?? "—";
  const quantity = items.reduce((s, it) => s + Number(it.quantity ?? 0), 0);
  const machineName = job.machine?.name ?? "Unassigned";

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .job-card-print { padding: 24px !important; }
        }
      `}</style>

      <div className="space-y-6">
        <div className="no-print flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/production"><ArrowLeft className="h-4 w-4" /></Link></Button>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Production Job</div>
              <h1 className="mt-0.5 font-display text-2xl font-bold sm:text-3xl">{job.job_no}</h1>
            </div>
            <ProductionBadge status={job.status} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={job.status} onValueChange={(v) => setStatus.mutate(v)}>
              <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
              <SelectContent>{PRODUCTION_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
            </Select>
            {job.status === "pending" && (
              <Button onClick={() => start.mutate()}><Play className="mr-1.5 h-4 w-4" /> Start production</Button>
            )}
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-1.5 h-4 w-4" /> Print job card</Button>
            {job.status !== "delivered" && (
              <Button variant="outline" onClick={() => complete.mutate()}><CheckCircle2 className="mr-1.5 h-4 w-4" /> Complete job</Button>
            )}
          </div>
        </div>

        <div className="no-print grid gap-6 lg:grid-cols-3">
          <Card className="p-6 shadow-elevated lg:col-span-2">
            <h2 className="font-display text-lg font-semibold">Job details</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Info label="Order #" value={<Link to="/orders/$id" params={{ id: job.order_id }} className="font-mono text-primary hover:underline">{order?.order_no}</Link>} />
              <Info label="Customer" value={order?.customer?.company_name} sub={order?.customer?.customer_code} />
              <Info label="Product" value={productName} sub={`Size: ${productSize}`} />
              <Info label="Quantity" value={String(quantity)} />
              <Info label="Paper" value={String(paperType)} sub={`${paperGsm} gsm`} />
              <Info label="Printing" value={`${colors} color${String(colors) === "1" ? "" : "s"}`} sub={`Side: ${side}`} />
              <Info label="Delivery date" value={order?.delivery_date ?? "—"} />
              <Info label="Priority" value={<span className="capitalize">{order?.priority ?? "—"}</span>} />
            </div>
          </Card>

          <Card className="p-6 shadow-elevated">
            <h2 className="font-display text-lg font-semibold">Assignment</h2>
            <div className="mt-4 space-y-3">
              <div>
                <Label>Assigned machine</Label>
                <Select value={machineId || "none"} onValueChange={setMachineId}>
                  <SelectTrigger><SelectValue placeholder="Select machine" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {machines.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Special instructions</Label>
                <textarea
                  className="min-h-[110px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Any handling notes for the shop floor…"
                />
              </div>
              <Button className="w-full" onClick={() => saveDetails.mutate()} disabled={saveDetails.isPending}>
                <Save className="mr-1.5 h-4 w-4" /> Save
              </Button>
            </div>
          </Card>
        </div>

        {/* Printable Job Card */}
        <Card className="job-card-print p-8 shadow-elevated">
          <div className="flex items-start justify-between gap-6 border-b pb-4">
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">{order?.branch?.name ?? "Spread Business"}</div>
              <h2 className="mt-1 font-display text-2xl font-bold">Production Job Card</h2>
              <div className="mt-1 font-mono text-sm text-muted-foreground">{job.job_no}</div>
            </div>
            {qrDataUrl && (
              <div className="text-center">
                <img src={qrDataUrl} alt="Job QR code" className="h-24 w-24" />
                <div className="mt-1 text-[10px] text-muted-foreground">Scan for job</div>
              </div>
            )}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <JobField label="Job Number" value={job.job_no} />
            <JobField label="Order Number" value={order?.order_no ?? "—"} />
            <JobField label="Customer Name" value={order?.customer?.company_name ?? "—"} />
            <JobField label="Product Name" value={productName} />
            <JobField label="Product Size" value={String(productSize)} />
            <JobField label="Quantity" value={String(quantity)} />
            <JobField label="Paper Type" value={String(paperType)} />
            <JobField label="Paper GSM" value={String(paperGsm)} />
            <JobField label="Printing Colors" value={String(colors)} />
            <JobField label="Printing Side" value={String(side)} />
            <JobField label="Machine Name" value={machineName} />
            <JobField label="Delivery Date" value={order?.delivery_date ?? "—"} />
          </div>

          <div className="mt-6">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Special Instructions</div>
            <div className="mt-1 min-h-[80px] rounded-md border p-3 text-sm whitespace-pre-wrap">
              {instructions || job.special_instructions || "—"}
            </div>
          </div>

          <div className="mt-8 grid grid-cols-3 gap-6 text-xs">
            <div className="border-t pt-2 text-center text-muted-foreground">Prepared by</div>
            <div className="border-t pt-2 text-center text-muted-foreground">Machine operator</div>
            <div className="border-t pt-2 text-center text-muted-foreground">QC approval</div>
          </div>
        </Card>
      </div>
    </>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium">{value ?? "—"}</div>
      {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function JobField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value || "—"}</div>
    </div>
  );
}
