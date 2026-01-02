import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  FileCode,
  ChevronLeft,
  LogOut,
  Settings,
} from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const menuItems = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Clients', url: '/clients', icon: Users },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Proposals', url: '/proposals', icon: FileText },
  { title: 'Contracts', url: '/contracts', icon: FileSignature },
  { title: 'Templates', url: '/templates', icon: FileCode },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const collapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getUserInitials = () => {
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-sm">
                <span className="text-lg font-bold text-primary-foreground">C</span>
              </div>
              <span className="text-lg font-semibold text-sidebar-foreground">Clientra</span>
            </div>
          )}
          <SidebarTrigger className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
            <ChevronLeft className={cn(
              "h-4 w-4 transition-transform duration-200",
              collapsed && "rotate-180"
            )} />
          </SidebarTrigger>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-3 py-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url || 
                  (item.url !== '/' && location.pathname.startsWith(item.url));
                
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={collapsed ? item.title : undefined}
                    >
                      <NavLink
                        to={item.url}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium transition-all duration-200",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/80"
                        )}
                      >
                        <item.icon className={cn(
                          "h-5 w-5 shrink-0",
                          isActive ? "text-primary-foreground" : "text-muted-foreground"
                        )} />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {user && (
          <div className={cn(
            "flex items-center gap-3",
            collapsed ? "justify-center" : "justify-between"
          )}>
            {!collapsed && (
              <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sidebar-foreground">
                    {user.email}
                  </p>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
