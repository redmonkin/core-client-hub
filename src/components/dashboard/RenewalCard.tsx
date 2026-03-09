import { format, differenceInDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { AlertCircle, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface RenewalCardProps {
  clientName: string;
  projectName: string;
  endDate: Date;
  value: number;
  contractType: string;
}

export function RenewalCard({ clientName, projectName, endDate, value, contractType }: RenewalCardProps) {
  const daysUntilRenewal = differenceInDays(endDate, new Date());
  
  const getUrgencyColor = () => {
    if (daysUntilRenewal <= 30) return 'bg-destructive/10 border-destructive/20';
    if (daysUntilRenewal <= 60) return 'bg-accent border-accent-foreground/20';
    return 'bg-card border-border';
  };

  const getUrgencyBadge = () => {
    if (daysUntilRenewal <= 30) return 'destructive';
    if (daysUntilRenewal <= 60) return 'secondary';
    return 'outline';
  };

  return (
    <Link to="/contracts" className="block">
      <Card className={cn("transition-all hover:shadow-md cursor-pointer", getUrgencyColor())}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-foreground">{clientName}</h4>
                <Badge variant={getUrgencyBadge()} className="text-xs">
                  {daysUntilRenewal} days
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{projectName}</p>
              <div className="flex items-center gap-4 pt-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  <span>{format(endDate, 'MMM dd, yyyy')}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {contractType.toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-foreground">
                ${value.toLocaleString()}
              </p>
              {daysUntilRenewal <= 30 && (
                <AlertCircle className="ml-auto mt-1 h-4 w-4 text-destructive" />
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
