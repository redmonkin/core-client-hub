import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FolderKanban,
  FileText,
  FileSignature,
  Receipt,
  FileCode,
  ClipboardList,
  ChevronLeft,
  LogOut,
  Settings,
  ChevronsUpDown,
  User,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import clientraLogoLight from '@/assets/clientra-light.svg';
import clientraLogoDark from '@/assets/clientra-dark.svg';

const menuItems = [
  { title: 'Dashboard', url: '/dashboard', icon: LayoutDashboard },
  { title: 'Briefs', url: '/briefs', icon: ClipboardList },
  { title: 'Clients', url: '/clients', icon: Users },
  { title: 'Projects', url: '/projects', icon: FolderKanban },
  { title: 'Proposals', url: '/proposals', icon: FileText },
  { title: 'Contracts', url: '/contracts', icon: FileSignature },
  { title: 'Invoices', url: '/invoices', icon: Receipt },
  { title: 'Templates', url: '/templates', icon: FileCode },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { role, isTeamMember } = useWorkspaceUser();
  const collapsed = state === 'collapsed';

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  const getUserInitials = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name.charAt(0).toUpperCase();
    }
    if (!user?.email) return 'U';
    return user.email.charAt(0).toUpperCase();
  };

  const getUserName = () => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name;
    }
    return user?.email?.split('@')[0] || 'User';
  };

  const getAvatarUrl = () => {
    return user?.user_metadata?.avatar_url || null;
  };

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border bg-sidebar shadow-sm">
      <SidebarHeader className={cn("border-b border-sidebar-border", collapsed ? "p-2" : "p-4")}>
        <div className={cn("flex items-center", collapsed ? "justify-center" : "justify-between")}>
          {!collapsed && (
            <div className="flex items-center gap-3">
              <img src={clientraLogoDark} alt="Clientra" className="h-9 w-9 dark:hidden" />
              <img src={clientraLogoLight} alt="Clientra" className="h-9 w-9 hidden dark:block" />
              <span className="text-lg font-semibold text-sidebar-foreground">Clientra</span>
            </div>
          )}
          {collapsed ? (
            <SidebarTrigger className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
              <img src={clientraLogoDark} alt="Clientra" className="h-7 w-7 dark:hidden" />
              <img src={clientraLogoLight} alt="Clientra" className="h-7 w-7 hidden dark:block" />
            </SidebarTrigger>
          ) : (
            <SidebarTrigger className="h-8 w-8 text-sidebar-foreground hover:bg-sidebar-accent">
              <ChevronLeft className="h-4 w-4 transition-transform duration-200" />
            </SidebarTrigger>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={cn("py-4", collapsed ? "px-1" : "px-3")}>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              {menuItems.map((item) => {
                const isActive = item.url === '/dashboard' 
                  ? location.pathname === '/dashboard'
                  : location.pathname.startsWith(item.url);
                
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
                          "flex items-center rounded-lg font-medium transition-all duration-200",
                          collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
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

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-3">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-sidebar-accent",
                  collapsed && "justify-center"
                )}
              >
                <Avatar className="h-9 w-9 shrink-0 ring-2 ring-primary/10">
                  <AvatarImage src={getAvatarUrl() || undefined} alt={getUserName()} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm font-semibold">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-sidebar-foreground">
                        {getUserName()}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {user.email}
                      </p>
                    </div>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent 
              align={collapsed ? "center" : "end"} 
              side="top"
              className="w-56"
            >
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium text-foreground">{getUserName()}</p>
                <p className="text-xs text-muted-foreground">{user.email}</p>
                {isTeamMember && (
                  <p className="mt-0.5 text-xs capitalize text-primary">{role} access</p>
                )}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => navigate('/profile')}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="cursor-pointer"
                onClick={() => navigate('/settings')}
              >
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                className="cursor-pointer text-destructive focus:text-destructive"
                onClick={handleSignOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
