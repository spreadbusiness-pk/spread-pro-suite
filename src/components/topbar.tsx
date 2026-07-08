import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Moon, Sun, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyProfile } from "@/lib/settings.functions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useTheme } from "@/components/theme-provider";
import { Badge } from "@/components/ui/badge";

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  sales: "Sales",
  designer: "Designer",
  production: "Production",
  delivery: "Delivery",
  accountant: "Accountant",
};

export function Topbar() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { theme, toggle } = useTheme();
  const fetchProfile = useServerFn(getMyProfile);
  const { data } = useQuery({ queryKey: ["me"], queryFn: () => fetchProfile() });

  const signOut = useMutation({
    mutationFn: async () => {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
    },
    onSuccess: () => navigate({ to: "/auth", replace: true }),
  });

  const name = data?.profile?.full_name || data?.email || "User";
  const initials = name
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  const primaryRole = data?.roles?.[0];

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur-md sm:px-6">
      <SidebarTrigger />
      <div className="hidden min-w-0 sm:block">
        <div className="font-display text-sm font-semibold leading-none">Welcome back</div>
        <div className="mt-1 truncate text-xs text-muted-foreground">{name}</div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                  {initials || "U"}
                </AvatarFallback>
              </Avatar>
              <div className="hidden text-left sm:block">
                <div className="text-xs font-semibold leading-tight">{name}</div>
                {primaryRole && (
                  <Badge
                    variant="secondary"
                    className="mt-0.5 h-4 border-0 bg-gold/20 px-1.5 py-0 text-[9px] font-medium uppercase tracking-wider text-gold-foreground"
                  >
                    {ROLE_LABEL[primaryRole] ?? primaryRole}
                  </Badge>
                )}
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>My Account</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
              <User className="mr-2 h-4 w-4" /> Profile &amp; Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => signOut.mutate()} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
