import { LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}

export function StatCard({ title, value, icon: Icon, description, className }: StatCardProps) {
  return (
    <Card className={cn(
      "group relative overflow-hidden transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-4xl font-bold tracking-tight text-foreground">{value}</p>
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 transition-transform duration-300 group-hover:scale-110">
            <Icon className="h-7 w-7 text-primary" />
          </div>
        </div>
      </CardContent>
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/50 to-primary opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </Card>
  );
}
