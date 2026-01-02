-- Create clients table
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  company_name TEXT,
  primary_contact_name TEXT,
  email TEXT,
  phone TEXT,
  billing_address TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create projects table
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_name TEXT NOT NULL,
  project_type TEXT NOT NULL CHECK (project_type IN ('one-time', 'amc', 'retainer')),
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'active', 'on-hold', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create proposals table
CREATE TABLE public.proposals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  scope_of_work TEXT,
  cost_breakdown TEXT,
  validity_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create contracts table
CREATE TABLE public.contracts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('amc', 'fixed', 'retainer')),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  renewal_frequency TEXT NOT NULL CHECK (renewal_frequency IN ('monthly', 'quarterly', 'yearly')),
  value DECIMAL(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'pending-renewal')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;

-- RLS policies for clients
CREATE POLICY "Users can view their own clients" ON public.clients FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own clients" ON public.clients FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own clients" ON public.clients FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own clients" ON public.clients FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for projects
CREATE POLICY "Users can view their own projects" ON public.projects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own projects" ON public.projects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own projects" ON public.projects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own projects" ON public.projects FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for proposals
CREATE POLICY "Users can view their own proposals" ON public.proposals FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own proposals" ON public.proposals FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own proposals" ON public.proposals FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own proposals" ON public.proposals FOR DELETE USING (auth.uid() = user_id);

-- RLS policies for contracts
CREATE POLICY "Users can view their own contracts" ON public.contracts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own contracts" ON public.contracts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own contracts" ON public.contracts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own contracts" ON public.contracts FOR DELETE USING (auth.uid() = user_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Add triggers for automatic timestamp updates
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_contracts_updated_at BEFORE UPDATE ON public.contracts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX idx_clients_user_id ON public.clients(user_id);
CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_client_id ON public.projects(client_id);
CREATE INDEX idx_proposals_user_id ON public.proposals(user_id);
CREATE INDEX idx_proposals_client_id ON public.proposals(client_id);
CREATE INDEX idx_contracts_user_id ON public.contracts(user_id);
CREATE INDEX idx_contracts_client_id ON public.contracts(client_id);