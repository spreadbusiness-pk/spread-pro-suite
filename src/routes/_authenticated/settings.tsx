import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getCompanySettings,
  updateCompanySettings,
  getMyProfile,
  updateMyProfile,
} from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Preferences</div>
        <h1 className="mt-1 font-display text-3xl font-bold sm:text-4xl">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Company branding, your profile, and account security.
        </p>
      </div>

      <Tabs defaultValue="company">
        <TabsList>
          <TabsTrigger value="company">Company</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        <TabsContent value="company" className="mt-6">
          <CompanyForm />
        </TabsContent>
        <TabsContent value="profile" className="mt-6">
          <ProfileForm />
        </TabsContent>
        <TabsContent value="security" className="mt-6">
          <SecurityForm />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function CompanyForm() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getCompanySettings);
  const updateFn = useServerFn(updateCompanySettings);
  const { data } = useQuery({ queryKey: ["company-settings"], queryFn: () => fetchFn() });
  const [form, setForm] = useState({
    name: "",
    phone: "",
    whatsapp: "",
    email: "",
    website: "",
    address: "",
    logo_url: "",
    currency: "PKR",
    timezone: "Asia/Karachi",
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        phone: data.phone ?? "",
        whatsapp: data.whatsapp ?? "",
        email: data.email ?? "",
        website: data.website ?? "",
        address: data.address ?? "",
        logo_url: data.logo_url ?? "",
        currency: data.currency ?? "PKR",
        timezone: data.timezone ?? "Asia/Karachi",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: form }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-settings"] });
      toast.success("Company settings saved");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  return (
    <Card className="p-6 shadow-elevated">
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <Field label="Company name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
        <Field label="Website" value={form.website} onChange={(v) => setForm({ ...form, website: v })} />
        <Field label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
        <Field
          label="WhatsApp"
          value={form.whatsapp}
          onChange={(v) => setForm({ ...form, whatsapp: v })}
        />
        <Field
          label="Email"
          type="email"
          value={form.email}
          onChange={(v) => setForm({ ...form, email: v })}
        />
        <Field
          label="Logo URL"
          value={form.logo_url}
          onChange={(v) => setForm({ ...form, logo_url: v })}
        />
        <Field
          label="Currency"
          value={form.currency}
          onChange={(v) => setForm({ ...form, currency: v })}
        />
        <Field
          label="Timezone"
          value={form.timezone}
          onChange={(v) => setForm({ ...form, timezone: v })}
        />
        <div className="sm:col-span-2 space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Address
          </Label>
          <Textarea
            rows={3}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ProfileForm() {
  const qc = useQueryClient();
  const fetchFn = useServerFn(getMyProfile);
  const updateFn = useServerFn(updateMyProfile);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchFn() });
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (data?.profile) {
      setName(data.profile.full_name ?? "");
      setPhone(data.profile.phone ?? "");
    }
  }, [data]);

  const save = useMutation({
    mutationFn: () => updateFn({ data: { full_name: name, phone } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Profile updated");
    },
    onError: (e: any) => toast.error(e?.message ?? "Failed to save"),
  });

  return (
    <Card className="p-6 shadow-elevated">
      <form
        className="grid max-w-xl gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Email
          </Label>
          <Input value={data?.email ?? ""} disabled />
        </div>
        <Field label="Full name" value={name} onChange={setName} />
        <Field label="Phone" value={phone} onChange={setPhone} />
        <div className="flex justify-end">
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save profile"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SecurityForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error("New password must be at least 8 characters");
    setBusy(true);
    // sanity check current password by re-auth
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user?.email) {
      setBusy(false);
      return toast.error("No session");
    }
    const { error: authErr } = await supabase.auth.signInWithPassword({
      email: userData.user.email,
      password: current,
    });
    if (authErr) {
      setBusy(false);
      return toast.error("Current password is incorrect");
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setBusy(false);
    if (error) return toast.error(error.message);
    setCurrent("");
    setNext("");
    toast.success("Password changed");
  };

  return (
    <Card className="p-6 shadow-elevated">
      <form className="grid max-w-xl gap-4" onSubmit={submit}>
        <Field label="Current password" type="password" value={current} onChange={setCurrent} />
        <Field label="New password" type="password" value={next} onChange={setNext} />
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Updating…" : "Change password"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
