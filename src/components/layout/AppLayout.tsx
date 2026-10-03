import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { NotificationsDropdown } from '@/components/notifications/NotificationsDropdown';
import clientraLogoDark from '@/assets/clientra-dark.svg';

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <SidebarInset className="flex-1">
          {/* Mobile top bar: menu, logo, notifications (desktop has them in the sidebar). */}
          <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur md:hidden">
            <SidebarTrigger className="h-10 w-10" aria-label="Open menu" />
            <div className="flex items-center gap-2">
              <img src={clientraLogoDark} alt="" className="h-7 w-7" />
              <span className="font-semibold text-foreground">Clientra</span>
            </div>
            <div className="ml-auto">
              <NotificationsDropdown />
            </div>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
