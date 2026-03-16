export type ClientStatus = 'active' | 'archived';

export interface Client {
  id: string;
  clientName: string;
  companyName: string;
  primaryContactName: string;
  email: string;
  phone: string;
  billingAddress: string;
  notes: string;
  status: ClientStatus;
  createdAt: Date;
}

export type ProjectType = 'one-time' | 'amc' | 'retainer';
export type ProjectStatus = 'proposal' | 'planned' | 'active' | 'on-hold' | 'completed' | 'cancelled' | 'maintenance';

export interface Project {
  id: string;
  clientId: string;
  projectName: string;
  projectType: ProjectType;
  startDate: Date;
  endDate: Date | null;
  status: ProjectStatus;
  createdAt: Date;
}

export type ProposalStatus = 'draft' | 'sent' | 'approved' | 'rejected';

export interface Proposal {
  id: string;
  clientId: string;
  projectId: string;
  title: string;
  scopeOfWork: string;
  costBreakdown: string;
  validityDate: Date;
  status: ProposalStatus;
  createdAt: Date;
}

export type ContractType = 'amc' | 'fixed' | 'retainer';
export type ContractStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'change_requested' | 'active' | 'expired' | 'pending-renewal';
export type RenewalFrequency = '1-month' | '3-months' | '6-months' | '1-year' | '3-years';

export interface Contract {
  id: string;
  clientId: string;
  projectId: string;
  contractType: ContractType;
  startDate: Date;
  endDate: Date;
  renewalFrequency: RenewalFrequency;
  value: number;
  status: ContractStatus;
  createdAt: Date;
}

export type TemplateType = 'proposal' | 'contract' | 'amc';

export interface Template {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
  createdAt: Date;
}
