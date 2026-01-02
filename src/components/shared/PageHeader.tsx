import { cn } from '@/lib/utils';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="space-y-1.5">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
        {description && (
          <p className="text-base text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}
