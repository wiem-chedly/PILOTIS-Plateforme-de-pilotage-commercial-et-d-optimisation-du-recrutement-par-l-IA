import {
  LayoutDashboard,
  FileText,
  BarChart3,
  Users,
  ClipboardList,
  Settings,
  ScrollText,
  CalendarDays,
  CalendarCheck,
  UserCog,
  UsersRound,
  TrendingUp,
  Wrench,
  UserSearch,
  Linkedin,
  Target,
  Mail,
  Search,
  Download,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Appels d'Offres", url: "/appels-offres", icon: FileText },
  { title: "Candidats", url: "/candidats", icon: UserSearch },
  
  { title: "Matching Offres", url: "/matching", icon: Target },
  { title: "Entretiens", url: "/entretiens", icon: CalendarCheck },
  { title: "Stat. Recrutement", url: "/stats-recrutement", icon: TrendingUp },
  { title: "Interactions LinkedIn", url: "/linkedin-interactions", icon: Linkedin },
  { title: "Performance", url: "/performance", icon: BarChart3 },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Reporting", url: "/reporting", icon: ClipboardList },
];

const bottomNavItems = [
  { title: "Configuration", url: "/config", icon: Settings },
  { title: "Logs Import", url: "/logs", icon: ScrollText },
];

const commercialPilotisItems = [
  { title: "Synthèse Hebdo", url: "/synthese-hebdo", icon: CalendarDays },
  { title: "Détail Sales", url: "/detail-sales/...", icon: UserCog },
  { title: "Intercontrats", url: "/intercontrats", icon: UsersRound },
  { title: "KPI Annuels", url: "/kpi-annuels", icon: TrendingUp },
  { title: "Config Module", url: "/config-module", icon: Wrench },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const { user, hasAccess: authHasAccess } = useAuth();
  const collapsed = state === "collapsed";

  const getPageKey = (url: string) => {
    if (url === '/') return 'dashboard';
    if (url.startsWith('/appels-offres')) return 'appels-offres';
    if (url.startsWith('/candidats') || url.startsWith('/cv-extraction') || url.startsWith('/matching') || url.startsWith('/entretiens')) return 'candidatures';
    if (url.startsWith('/stats-recrutement')) return 'stats-recrutement';
    if (url.startsWith('/linkedin-interactions')) return 'linkedin-interactions';
    if (url.startsWith('/performance')) return 'performance';
    if (url.startsWith('/clients')) return 'clients';
    if (url.startsWith('/reporting')) return 'reporting';
    if (url.startsWith('/config-module')) return 'config-module';
    if (url.startsWith('/config')) return 'configuration';
    if (url.startsWith('/logs')) return 'logs-import';
    if (url.startsWith('/synthese-hebdo')) return 'synthese-hebdo';
    if (url.startsWith('/detail-sales')) return 'detail-sales';
    if (url.startsWith('/intercontrats')) return 'intercontrats';
    if (url.startsWith('/kpi-annuels')) return 'kpi-annuels';
    return url.split('/')[1] || 'dashboard';
  };

  const hasAccess = (itemUrl: string) => {
    return authHasAccess(getPageKey(itemUrl));
  };

  const visibleNavItems = navItems.filter(item => hasAccess(item.url));
  const visibleCommercialItems = commercialPilotisItems.filter(item => hasAccess(item.url));
  const visibleBottomItems = bottomNavItems.filter(item => hasAccess(item.url));

  const renderMenuItems = (visibleItems: typeof navItems) =>
    visibleItems.map((item) => (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild tooltip={item.title}>
          <NavLink
            to={item.url}
            end={item.url === "/"}
            className="hover:bg-sidebar-accent"
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="/logo_pilotis.jpeg"
            alt="PILOTIS"
            className="h-8 w-8 rounded-md object-cover"
          />
          {!collapsed && (
            <span className="text-lg font-bold text-sidebar-foreground tracking-tight">
              PILOTIS
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        {/* Main navigation */}
        {visibleNavItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItems(visibleNavItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {visibleCommercialItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Activité Commerciale</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItems(visibleCommercialItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* System navigation — pushed to bottom */}
        {visibleBottomItems.length > 0 && (
          <SidebarGroup className="mt-auto">
            <SidebarGroupLabel>Système</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {renderMenuItems(visibleBottomItems)}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}
