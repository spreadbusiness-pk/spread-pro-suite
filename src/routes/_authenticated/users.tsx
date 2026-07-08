import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { listUsers, setUserRole, inviteUser } from "@/lib/users.functions";
import { getMyProfile } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

const ROLES = [
  "super_admin",
  "admin",
  "sales",
  "designer",
  "production",
  "delivery",
  "accountant",
] as const;
type Role = (typeof ROLES)[number];

function UsersPage() {
  const qc = useQueryClient();
  const meFn = useServerFn(getMyProfile);
  const listFn = useServerFn(listUsers);
  const setRoleFn = useServerFn(setUserRole);
  const inviteFn = useServerFn(inviteUser);

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isAdmin = me?.roles?.some((r) => r === "super_admin" || r === "admin") ?? false;

  const { data: users, isLoading } = useQuery({
    queryKey: ["users"],
    queryFn: () => listFn(),
    enabled: isAdmin,
  });

  const roleMutation = useMutation({
    mutationFn: (v: { user_id: string; role: Role }) => setRoleFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("Role updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed"),
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ email: string; full_name: string; role: Role; password: string }>({
    email: "",
    full_name: "",
    role: "sales",
    password: "",
  });

  const invite = useMutation({
    mutationFn: () => inviteFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created");
      setOpen(false);
      setForm({ email: "", full_name: "", role: "sales", password: "" });
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to invite"),
  });

  if (me && !isAdmin) {
    return (
      <div className="grid place-items-center py-24">
        <Card className="max-w-md p-8 text-center shadow-elevated">
          <h2 className="font-display text-xl font-semibold">Admins only</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            You need Admin or Super Admin access to manage users.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 sm:flex sm:items-end sm:justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Access</div>
          <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Users &amp; Roles</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Invite team members and assign the right role.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus className="mr-1.5 h-4 w-4" /> Add user
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add team member</DialogTitle>
              <DialogDescription>
                Creates a confirmed account with a temporary password. Share it privately.
              </DialogDescription>
            </DialogHeader>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                invite.mutate();
              }}
            >
              <div className="space-y-1.5">
                <Label>Full name</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label>Temporary password (min 8)</Label>
                <Input
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => setForm({ ...form, role: v as Role })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {roleLabel(r)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={invite.isPending}>
                  {invite.isPending ? "Creating…" : "Create user"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="overflow-hidden shadow-elevated">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="hidden md:table-cell">Last sign in</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 4 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                (users ?? []).map((u) => {
                  const currentRole = (u.roles?.[0] as Role) ?? "sales";
                  return (
                    <TableRow key={u.id}>
                      <TableCell>
                        <div className="font-medium">{u.profile?.full_name ?? "—"}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-gold/20 text-gold-foreground hover:bg-gold/30">
                            {roleLabel(currentRole)}
                          </Badge>
                          <Select
                            value={currentRole}
                            onValueChange={(v) =>
                              roleMutation.mutate({ user_id: u.id, role: v as Role })
                            }
                          >
                            <SelectTrigger className="h-8 w-36">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {ROLES.map((r) => (
                                <SelectItem key={r} value={r}>
                                  {roleLabel(r)}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                        {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : "Never"}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

function roleLabel(r: Role) {
  return (
    {
      super_admin: "Super Admin",
      admin: "Admin",
      sales: "Sales",
      designer: "Designer",
      production: "Production",
      delivery: "Delivery",
      accountant: "Accountant",
    } as const
  )[r];
}
