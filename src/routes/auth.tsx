import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
  head: () => ({
    meta: [
      { title: "Sign in · Spread Business ERP" },
      { name: "description", content: "Secure sign in for Spread Business ERP." },
      { property: "og:title", content: "Sign in · Spread Business ERP" },
      { property: "og:description", content: "Secure sign in for Spread Business ERP." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const emailSchema = z.string().trim().email("Enter a valid email").max(200);
const passwordSchema = z.string().min(8, "Min 8 characters").max(200);

function AuthPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<"login" | "signup" | "forgot">("login");

  useEffect(() => {
    const remembered = typeof window !== "undefined" ? localStorage.getItem("sb_email") : null;
    if (remembered) setEmailField(remembered);
  }, []);

  const [email, setEmailField] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : "Invalid input";
      toast.error(msg);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (remember) localStorage.setItem("sb_email", email);
    else localStorage.removeItem("sb_email");
    toast.success("Welcome back");
    navigate({ to: "/" });
  };

  const submitSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
      z.string().trim().min(1).max(200).parse(fullName);
    } catch (err) {
      const msg = err instanceof z.ZodError ? err.issues[0].message : "Invalid input";
      toast.error(msg);
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created — check your email to confirm, then sign in.");
    setTab("login");
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
    } catch {
      return toast.error("Enter a valid email");
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password reset email sent");
    setTab("login");
  };

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden gradient-hero lg:block">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, oklch(0.76 0.13 82 / 0.4), transparent 40%), radial-gradient(circle at 80% 70%, oklch(0.48 0.18 268 / 0.4), transparent 45%)",
          }}
        />
        <div className="relative z-10 flex h-full flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-gold shadow-gold">
              <span className="font-display text-2xl font-bold text-gold-foreground">S</span>
            </div>
            <div>
              <div className="font-display text-lg font-bold leading-tight">Spread Business</div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/60">
                Pvt Limited
              </div>
            </div>
          </div>
          <div className="max-w-md">
            <h1 className="font-display text-5xl font-bold leading-tight">
              Print operations, <span className="text-gradient-gold">refined.</span>
            </h1>
            <p className="mt-6 text-white/70">
              A luxury cloud ERP &amp; CRM built for print. Manage customers, orders, production,
              and reports from one calm, professional command center.
            </p>
          </div>
          <div className="text-xs text-white/50">
            © {new Date().getFullYear()} Spread Business Pvt Limited. All rights reserved.
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-md border-border/60 p-6 shadow-elevated sm:p-8">
          <div className="mb-6 text-center lg:hidden">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl gradient-primary shadow-elevated">
              <span className="font-display text-xl font-bold text-primary-foreground">S</span>
            </div>
            <div className="font-display text-lg font-bold">Spread Business</div>
            <div className="text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
              ERP &amp; CRM
            </div>
          </div>

          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="login">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create</TabsTrigger>
              <TabsTrigger value="forgot">Forgot</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="mt-6">
              <form onSubmit={submitLogin} className="space-y-4">
                <Field id="e1" label="Email" type="email" value={email} onChange={setEmailField} />
                <Field
                  id="p1"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={remember}
                    onCheckedChange={(v) => setRemember(Boolean(v))}
                  />
                  Remember me
                </label>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Sign in
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup" className="mt-6">
              <form onSubmit={submitSignup} className="space-y-4">
                <Field id="n2" label="Full name" value={fullName} onChange={setFullName} />
                <Field id="e2" label="Email" type="email" value={email} onChange={setEmailField} />
                <Field
                  id="p2"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create account
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  The first account created becomes the Super Admin.
                </p>
              </form>
            </TabsContent>

            <TabsContent value="forgot" className="mt-6">
              <form onSubmit={submitForgot} className="space-y-4">
                <Field id="e3" label="Email" type="email" value={email} onChange={setEmailField} />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send reset link
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </Card>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  type = "text",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
        autoComplete={type === "password" ? "current-password" : type === "email" ? "email" : "off"}
      />
    </div>
  );
}
