import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Search, Calendar, MoreHorizontal } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

type ProjectStatus = 'planned' | 'active' | 'on-hold' | 'completed' | 'cancelled';
type ProjectType = 'one-time' | 'amc' | 'retainer';

export default function Projects() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newProject, setNewProject] = useState({
    project_name: '',
    client_id: '',
    project_type: 'one-time' as ProjectType,
    start_date: '',
    end_date: '',
    status: 'planned' as ProjectStatus,
  });

  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading: projectsLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .order('client_name');
      if (error) throw error;
      return data;
    },
  });

  const createProject = useMutation({
    mutationFn: async (project: typeof newProject) => {
      const { error } = await supabase.from('projects').insert({
        ...project,
        user_id: user?.id,
        start_date: project.start_date || null,
        end_date: project.end_date || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setDialogOpen(false);
      setNewProject({
        project_name: '',
        client_id: '',
        project_type: 'one-time',
        start_date: '',
        end_date: '',
        status: 'planned',
      });
      toast({ title: 'Project created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Error creating project', description: error.message, variant: 'destructive' });
    },
  });

  const filteredProjects = projects.filter(project => {
    const matchesSearch = project.project_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || project.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getClientName = (clientId: string) => {
    const client = clients.find(c => c.id === clientId);
    return client?.client_name || 'Unknown Client';
  };

  const projectTypeLabels: Record<string, string> = {
    'one-time': 'One-time',
    'amc': 'AMC',
    'retainer': 'Retainer',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.project_name || !newProject.client_id) {
      toast({ title: 'Please fill in required fields', variant: 'destructive' });
      return;
    }
    createProject.mutate(newProject);
  };

  if (projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-8">
      <PageHeader
        title="Projects"
        description="Track and manage all your projects"
        actions={
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="lg">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="project_name">Project Name *</Label>
                  <Input
                    id="project_name"
                    value={newProject.project_name}
                    onChange={(e) => setNewProject({ ...newProject, project_name: e.target.value })}
                    placeholder="Enter project name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="client">Client *</Label>
                  <Select
                    value={newProject.client_id}
                    onValueChange={(v) => setNewProject({ ...newProject, client_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.client_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="project_type">Project Type</Label>
                  <Select
                    value={newProject.project_type}
                    onValueChange={(v) => setNewProject({ ...newProject, project_type: v as ProjectType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one-time">One-time</SelectItem>
                      <SelectItem value="amc">AMC</SelectItem>
                      <SelectItem value="retainer">Retainer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="start_date">Start Date</Label>
                    <Input
                      id="start_date"
                      type="date"
                      value={newProject.start_date}
                      onChange={(e) => setNewProject({ ...newProject, start_date: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="end_date">End Date</Label>
                    <Input
                      id="end_date"
                      type="date"
                      value={newProject.end_date}
                      onChange={(e) => setNewProject({ ...newProject, end_date: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={newProject.status}
                    onValueChange={(v) => setNewProject({ ...newProject, status: v as ProjectStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="planned">Planned</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="on-hold">On Hold</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending ? 'Creating...' : 'Create Project'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
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
                      {project.project_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link 
                      to={`/clients/${project.client_id}`}
                      className="text-muted-foreground hover:text-primary transition-colors"
                    >
                      {getClientName(project.client_id)}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-medium">
                      {projectTypeLabels[project.project_type]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Calendar className="h-3.5 w-3.5" />
                      <span>
                        {project.start_date ? format(new Date(project.start_date), 'MMM dd') : 'No start'}
                        {project.end_date && ` - ${format(new Date(project.end_date), 'MMM dd, yyyy')}`}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={project.status as 'active' | 'planned' | 'on-hold' | 'completed' | 'cancelled'} />
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
          onAction={() => setDialogOpen(true)}
        />
      )}
    </div>
  );
}
