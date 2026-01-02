import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Calendar, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { mockProjects, mockClients } from '@/lib/mock-data';
import { ProjectStatus } from '@/lib/types';

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');

  const filteredProjects = mockProjects.filter(project => {
    const matchesSearch = project.projectName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = mockClients.find(c => c.id === clientId);
    return client?.clientName || 'Unknown Client';
  };

  const projectTypeLabels: Record<string, string> = {
    'one-time': 'One-time',
    'amc': 'AMC',
    'retainer': 'Retainer',
  };

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Projects"
        description="Track and manage all your projects"
        actions={
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-12 pl-11 text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as ProjectStatus | 'all')}>
          <SelectTrigger className="h-12 w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="on-hold">On Hold</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredProjects.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead className="font-semibold">Project</TableHead>
                <TableHead className="font-semibold">Client</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Timeline</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProjects.map(project => (
                <TableRow key={project.id} className="group">
                  <TableCell>
                    <Link 
                      to={`/projects/${project.id}`}
                      className="font-medium text-foreground hover:text-primary transition-colors"
                    >
                      {project.projectName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/clients/${project.clientId}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {getClientName(project.clientId)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {projectTypeLabels[project.projectType]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {format(project.startDate, 'MMM dd')}
                        {project.endDate && ` - ${format(project.endDate, 'MMM dd, yyyy')}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status} />
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link to={`/projects/${project.id}`}>View Details</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem>Edit</DropdownMenuItem>
                        <DropdownMenuItem>Create Proposal</DropdownMenuItem>
                        <DropdownMenuItem>Create Contract</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <EmptyState
          icon={Calendar}
          title="No projects found"
          description={searchQuery || statusFilter !== 'all' 
            ? "Try adjusting your filters" 
            : "Create your first project to get started"}
          actionLabel={!searchQuery && statusFilter === 'all' ? "New Project" : undefined}
          onAction={() => {}}
        />
      )}
    </div>
  );
}
