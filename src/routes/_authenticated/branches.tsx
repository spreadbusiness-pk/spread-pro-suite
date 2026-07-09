import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Plus, Pencil, Trash2, Power } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { listBranches, createBranch, updateBranch, deleteBranch, toggleBranch } from "@/lib/branches.functions";

export const Route = createFileRoute("/_authenticated/branches")({ component: BranchesPage });

type Row = {
  id: string; code: string; name: string; address: string | null; city: string | null;
  phone: string | null; whatsapp: string | null; email: string | null; currency: string;
  status: string; active: boolean;
};
type Form = Omit<Row, "id" | "active"> & { active: boolean };
const empty: Form = { code: "", name: "", address: "", city: "", phone: "", whatsapp: "", email: "", currency: "PKR", status: "active", active: true };

function BranchesPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listBranches);
  const createFn = useServerFn(createBranch);
  const updateFn = useServerFn(updateBranch);
  const deleteFn = useServerFn(deleteBranch);
  const toggleFn = useServerFn(toggleBranch);

  const { data, isLoading } = useQuery({ queryKey: ["branches"], queryFn: () => fetchList() });
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const save = useMutation({
    mutationFn: async () => editing ? updateFn({ data: { id: editing.id, values: form } }) : createFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["branches"] });
      toast.success(editing ? "Branch updated" : "Branch created");
      setSheet(false); setEditing(null); setForm(empty);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["branches"] }); toast.success("Branch deleted"); setToDelete(null); },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });
  const tog = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => toggleFn({ data: { id, active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branches"] }),
  });

  const openNew = () => { setEditing(null); setForm(empty); setSheet(true); };
  const openEdit = (r: Row) => {
    setEditing(r);
    setForm({ code: r.code, name: r.name, address: r.address ?? "", city: r.city ?? "", phone: r.phone ?? "", whatsapp: r.whatsapp ?? "", email: r.email ?? "", currency: r.currency ?? "PKR", status: r.status ?? "active", active: r.active });
    setSheet(true);
  };

  const rows = (data ?? []) as Row[];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Administration</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Branches</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage every location under Spread Business.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Add branch</Button>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead className="hidden md:table-cell">City</TableHead>
                <TableHead className="hidden lg:table-cell">Contact</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>{Array.from({ length: 7 }).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              )) : rows.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="py-16 text-center">
                  <p className="font-display text-lg font-semibold">No branches yet</p>
                  <p className="mt-1 text-sm text-muted-foreground">Add your first branch to start creating orders.</p>
                  <Button onClick={openNew} className="mt-4"><Plus className="mr-1.5 h-4 w-4" /> Add branch</Button>
                </TableCell></TableRow>
              ) : rows.map((r) => (
                <TableRow key={r.id} className="hover:bg-muted/40">
                  <TableCell className="font-mono text-xs">{r.code}</TableCell>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{r.city ?? "—"}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {r.phone && <div>{r.phone}</div>}
                    {r.email && <div>{r.email}</div>}
                  </TableCell>
                  <TableCell>{r.currency}</TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "default" : "secondary"} className={r.active ? "bg-success/15 text-success hover:bg-success/20" : ""}>
                      {r.active ? "active" : "inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => tog.mutate({ id: r.id, active: !r.active })} title={r.active ? "Deactivate" : "Activate"}>
                        <Power className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setToDelete(r)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Sheet open={sheet} onOpenChange={setSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">{editing ? "Edit branch" : "New branch"}</SheetTitle>
            <SheetDescription>Every order, customer and machine belongs to a branch.</SheetDescription>
          </SheetHeader>
          <form className="mt-6 space-y-4 px-4" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Code" required><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="LHR" required /></Field>
              <Field label="Name" required><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></Field>
              <Field label="City"><Input value={form.city ?? ""} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field>
              <Field label="Currency"><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></Field>
              <Field label="Phone"><Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></Field>
              <Field label="WhatsApp"><Input value={form.whatsapp ?? ""} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} /></Field>
              <Field label="Email"><Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <Field label="Address" full><Input value={form.address ?? ""} onChange={(e) => setForm({ ...form, address: e.target.value })} /></Field>
            </div>
            <SheetFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => setSheet(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>{save.isPending ? "Saving…" : editing ? "Save changes" : "Create branch"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete branch?</AlertDialogTitle>
            <AlertDialogDescription>This will unlink any customer or order attached to <b>{toDelete?.name}</b>. This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => toDelete && del.mutate(toDelete.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Field({ label, required, full, children }: { label: string; required?: boolean; full?: boolean; children: React.ReactNode }) {
  return (
    <div className={full ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
      <Label className="text-xs">{label}{required && <span className="text-destructive"> *</span>}</Label>
      {children}
    </div>
  );
}
