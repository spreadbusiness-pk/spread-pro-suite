import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  FileText,
  Receipt,
  Factory,
  Package,
  BarChart3,
  UserCog,
  Settings,
  Building2,
  Database,
  Wallet,
  BookOpen,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const mainItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Orders", url: "/orders", icon: ShoppingCart },
  { title: "Customers", url: "/customers", icon: Users },
  { title: "Quotations", url: "/quotations", icon: FileText },
  { title: "Invoices", url: "/invoices", icon: Receipt },
  { title: "Payments", url: "/payments", icon: Wallet },
  { title: "Ledger", url: "/ledger", icon: BookOpen },
  { title: "Production", url: "/production", icon: Factory },
  { title: "Inventory", url: "/inventory", icon: Package },
  { title: "Reports", url: "/reports", icon: BarChart3 },
] as const;

const adminItems = [
  { title: "Branches", url: "/branches", icon: Building2 },
  { title: "Masters", url: "/masters", icon: Database },
  { title: "Users", url: "/users", icon: UserCog },
  { title: "Settings", url: "/settings", icon: Settings },
] as const;

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(path + "/");

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader className="border-b border-sidebar-border/60 py-4">
        <Link to="/" className="flex items-center gap-3 px-2">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl gradient-gold shadow-gold">
            <span className="font-display text-lg font-bold text-gold-foreground">S</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="font-display text-sm font-bold leading-tight text-sidebar-foreground">
                Spread Business
              </div>
              <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
                ERP &amp; CRM
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Administration</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)} tooltip={item.title}>
                    <Link to={item.url} className="flex items-center gap-2">
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 p-3">
        {!collapsed && (
          <div className="text-[10px] uppercase tracking-widest text-sidebar-foreground/60">
            Phase 1 · Foundation
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
