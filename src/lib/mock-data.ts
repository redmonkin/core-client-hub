import { Client, Project, Proposal, Contract, Template } from './types';

export const mockClients: Client[] = [
  {
    id: '1',
    clientName: 'TechStart Inc',
    companyName: 'TechStart Innovations',
    primaryContactName: 'John Smith',
    email: 'john@techstart.com',
    phone: '+1 (555) 123-4567',
    billingAddress: '123 Innovation Way, San Francisco, CA 94102',
    notes: 'Priority client, prefers email communication',
    status: 'active',
    createdAt: new Date('2024-01-15'),
  },
  {
    id: '2',
    clientName: 'GreenLeaf Co',
    companyName: 'GreenLeaf Sustainable Solutions',
    primaryContactName: 'Sarah Johnson',
    email: 'sarah@greenleaf.co',
    phone: '+1 (555) 987-6543',
    billingAddress: '456 Eco Street, Portland, OR 97201',
    notes: 'Sustainability-focused company, quarterly reviews preferred',
    status: 'active',
    createdAt: new Date('2024-02-20'),
  },
  {
    id: '3',
    clientName: 'Urban Dynamics',
    companyName: 'Urban Dynamics Real Estate',
    primaryContactName: 'Michael Chen',
    email: 'mchen@urbandynamics.com',
    phone: '+1 (555) 456-7890',
    billingAddress: '789 Metropolitan Ave, New York, NY 10001',
    notes: 'Multiple ongoing projects, dedicated account manager required',
    status: 'active',
    createdAt: new Date('2024-03-10'),
  },
];

export const mockProjects: Project[] = [
  {
    id: '1',
    clientId: '1',
    projectName: 'Website Redesign',
    projectType: 'one-time',
    startDate: new Date('2024-06-01'),
    endDate: new Date('2024-08-31'),
    status: 'active',
    createdAt: new Date('2024-05-15'),
  },
  {
    id: '2',
    clientId: '1',
    projectName: 'Annual Maintenance',
    projectType: 'amc',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    clientId: '2',
    projectName: 'Brand Identity',
    projectType: 'one-time',
    startDate: new Date('2024-07-01'),
    endDate: new Date('2024-09-30'),
    status: 'planned',
    createdAt: new Date('2024-06-20'),
  },
  {
    id: '4',
    clientId: '3',
    projectName: 'Digital Marketing Retainer',
    projectType: 'retainer',
    startDate: new Date('2024-04-01'),
    endDate: null,
    status: 'active',
    createdAt: new Date('2024-03-25'),
  },
];

export const mockProposals: Proposal[] = [
  {
    id: '1',
    clientId: '1',
    projectId: '1',
    title: 'Website Redesign Proposal',
    scopeOfWork: 'Complete redesign of the company website including UX research, wireframing, visual design, and development.',
    costBreakdown: 'Design: $15,000\nDevelopment: $25,000\nTotal: $40,000',
    validityDate: new Date('2024-06-30'),
    status: 'approved',
    createdAt: new Date('2024-05-10'),
  },
  {
    id: '2',
    clientId: '2',
    projectId: '3',
    title: 'Brand Identity Development',
    scopeOfWork: 'Brand strategy, logo design, color palette, typography, and brand guidelines.',
    costBreakdown: 'Strategy: $5,000\nDesign: $12,000\nGuidelines: $3,000\nTotal: $20,000',
    validityDate: new Date('2024-07-15'),
    status: 'sent',
    createdAt: new Date('2024-06-15'),
  },
  {
    id: '3',
    clientId: '3',
    projectId: '4',
    title: 'Marketing Retainer Agreement',
    scopeOfWork: 'Monthly marketing services including SEO, content creation, and social media management.',
    costBreakdown: 'Monthly Retainer: $5,000/month',
    validityDate: new Date('2024-04-15'),
    status: 'approved',
    createdAt: new Date('2024-03-20'),
  },
];

export const mockContracts: Contract[] = [
  {
    id: '1',
    clientId: '1',
    projectId: '2',
    contractType: 'amc',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-12-31'),
    renewalFrequency: '1-year',
    value: 24000,
    status: 'active',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    clientId: '3',
    projectId: '4',
    contractType: 'retainer',
    startDate: new Date('2024-04-01'),
    endDate: new Date('2025-03-31'),
    renewalFrequency: '1-year',
    value: 60000,
    status: 'active',
    createdAt: new Date('2024-03-25'),
  },
  {
    id: '3',
    clientId: '2',
    projectId: '3',
    contractType: 'fixed',
    startDate: new Date('2024-07-01'),
    endDate: new Date('2025-01-15'),
    renewalFrequency: 'yearly',
    value: 20000,
    status: 'pending-renewal',
    createdAt: new Date('2024-06-25'),
  },
];

export const mockTemplates: Template[] = [
  {
    id: '1',
    name: 'Standard Proposal',
    type: 'proposal',
    content: `# Proposal for {{clientName}}

## Project: {{projectName}}

### Scope of Work
[Describe the scope of work here]

### Deliverables
- Deliverable 1
- Deliverable 2
- Deliverable 3

### Timeline
Start Date: {{startDate}}
End Date: {{endDate}}

### Investment
{{costBreakdown}}

### Terms & Conditions
- Payment terms: 50% upfront, 50% on completion
- Validity: 30 days from proposal date

---
Prepared by: [Your Name]
Date: {{currentDate}}`,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    name: 'AMC Agreement',
    type: 'amc',
    content: `# Annual Maintenance Contract

## Client: {{clientName}}
## Company: {{companyName}}

### Contract Details
- Contract Type: Annual Maintenance Contract
- Start Date: {{startDate}}
- End Date: {{endDate}}
- Contract Value: {{value}}

### Services Included
1. Regular maintenance and updates
2. Bug fixes and technical support
3. Security updates
4. Performance monitoring

### Terms
- Payment: Monthly/Quarterly/Annual
- Renewal: Auto-renewal with 30 days notice

---
Signed: ____________
Date: {{currentDate}}`,
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '3',
    name: 'Service Contract',
    type: 'contract',
    content: `# Service Agreement

## Between: [Your Company] and {{clientName}}

### Project: {{projectName}}

### Contract Terms
- Type: {{contractType}}
- Duration: {{startDate}} to {{endDate}}
- Total Value: {{value}}

### Payment Schedule
[Define payment schedule]

### Deliverables
[List deliverables]

### Signatures
Client: ____________
Provider: ____________
Date: {{currentDate}}`,
    createdAt: new Date('2024-01-01'),
  },
];
