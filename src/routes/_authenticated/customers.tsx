import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MessageCircle,
  MapPin,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  listCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "@/lib/customers.functions";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type CustomerRow = {
  id: string;
  customer_code: string;
  company_name: string;
  customer_name: string;
  mobile: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  business_type: string | null;
  gst_ntn: string | null;
  notes: string | null;
  status: string;
  created_at: string;
};

type FormState = {
  company_name: string;
  customer_name: string;
  mobile: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  business_type: string;
  gst_ntn: string;
  notes: string;
  status: "active" | "inactive";
};

const empty: FormState = {
  company_name: "",
  customer_name: "",
  mobile: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  business_type: "",
  gst_ntn: "",
  notes: "",
  status: "active",
};

function CustomersPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [debounced, setDebounced] = useState("");
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<CustomerRow | null>(null);

  useMemo(() => {
    const t = setTimeout(() => setDebounced(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchList = useServerFn(listCustomers);
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["customers", debounced, status, page],
    queryFn: () => fetchList({ data: { search: debounced, status, page, pageSize: 20 } }),
  });

  const createFn = useServerFn(createCustomer);
  const updateFn = useServerFn(updateCustomer);
  const deleteFn = useServerFn(deleteCustomer);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editing) return updateFn({ data: { id: editing.id, values: form } });
      return createFn({ data: form });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success(editing ? "Customer updated" : "Customer created");
      setSheetOpen(false);
      setEditing(null);
      setForm(empty);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customers"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("Customer deleted");
      setToDelete(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to delete"),
  });

  const openNew = () => {
    setEditing(null);
    setForm(empty);
    setSheetOpen(true);
  };

  const openEdit = (row: CustomerRow) => {
    setEditing(row);
    setForm({
      company_name: row.company_name ?? "",
      customer_name: row.customer_name ?? "",
      mobile: row.mobile ?? "",
      whatsapp: row.whatsapp ?? "",
      email: row.email ?? "",
      address: row.address ?? "",
      city: row.city ?? "",
      business_type: row.business_type ?? "",
      gst_ntn: row.gst_ntn ?? "",
      notes: row.notes ?? "",
      status: (row.status as "active" | "inactive") ?? "active",
    });
    setSheetOpen(true);
  };

  const rows = (data?.rows ?? []) as CustomerRow[];
  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">CRM</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Customers</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {total} customer{total === 1 ? "" : "s"} in your database
          </p>
        </div>
        <Button onClick={openNew} className="shrink-0">
          <Plus className="mr-1.5 h-4 w-4" /> Add customer
        </Button>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name, company, phone, email, code"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
          </div>
          <Select
            value={status}
            onValueChange={(v) => {
              setStatus(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead className="hidden lg:table-cell">Business</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-16 text-center">
                    <div className="mx-auto max-w-sm">
                      <p className="font-display text-lg font-semibold">No customers found</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Add your first customer to build your CRM.
                      </p>
                      <Button onClick={openNew} className="mt-4">
                        <Plus className="mr-1.5 h-4 w-4" /> Add customer
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {r.customer_code}
                    </TableCell>
                    <TableCell>
                      <div className="min-w-0">
                        <div className="truncate font-medium">{r.company_name}</div>
                        <div className="truncate text-xs text-muted-foreground">
                          {r.customer_name}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 text-xs">
                        {r.mobile && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="h-3 w-3" /> {r.mobile}
                          </div>
                        )}
                        {r.whatsapp && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <MessageCircle className="h-3 w-3" /> {r.whatsapp}
                          </div>
                        )}
                        {r.email && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Mail className="h-3 w-3" /> {r.email}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {r.city && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {r.city}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      {r.business_type ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={r.status === "active" ? "default" : "secondary"}
                        className={
                          r.status === "active"
                            ? "bg-success/15 text-success hover:bg-success/20"
                            : ""
                        }
                      >
                        {r.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setToDelete(r)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t p-3 text-sm">
            <div className="text-muted-foreground">
              Page {page} of {totalPages}
              {isFetching && " · updating…"}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle className="font-display">
              {editing ? "Edit customer" : "New customer"}
            </SheetTitle>
            <SheetDescription>
              {editing ? `Editing ${editing.customer_code}` : "Add a customer to your CRM."}
            </SheetDescription>
          </SheetHeader>
          <form
            className="mt-6 space-y-4 px-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveMutation.mutate();
            }}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Company name" required>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Contact person" required>
                <Input
                  value={form.customer_name}
                  onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
                  required
                />
              </FormField>
              <FormField label="Mobile">
                <Input
                  value={form.mobile}
                  onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                />
              </FormField>
              <FormField label="WhatsApp">
                <Input
                  value={form.whatsapp}
                  onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
                />
              </FormField>
              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </FormField>
              <FormField label="City">
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </FormField>
              <FormField label="Business type">
                <Input
                  value={form.business_type}
                  onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                  placeholder="e.g. Printing, Retail"
                />
              </FormField>
              <FormField label="GST / NTN">
                <Input
                  value={form.gst_ntn}
                  onChange={(e) => setForm({ ...form, gst_ntn: e.target.value })}
                />
              </FormField>
              <FormField label="Status">
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v as "active" | "inactive" })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
            <FormField label="Address">
              <Textarea
                rows={2}
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </FormField>
            <FormField label="Notes">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </FormField>
            <SheetFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSheetOpen(false)}
                disabled={saveMutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Saving…" : editing ? "Save changes" : "Create customer"}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete customer?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes <b>{toDelete?.company_name}</b> ({toDelete?.customer_code}).
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => toDelete && deleteMutation.mutate(toDelete.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {children}
    </div>
  );
}
