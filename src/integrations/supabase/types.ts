export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      branding_settings: {
        Row: {
          accent_color: string | null
          company_logo_url: string | null
          company_name: string | null
          created_at: string
          id: string
          primary_color: string | null
          slug: string | null
          support_email: string | null
          tagline: string | null
          updated_at: string
          user_id: string
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          primary_color?: string | null
          slug?: string | null
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          user_id: string
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          created_at?: string
          id?: string
          primary_color?: string | null
          slug?: string | null
          support_email?: string | null
          tagline?: string | null
          updated_at?: string
          user_id?: string
          website_url?: string | null
        }
        Relationships: []
      }
      briefs: {
        Row: {
          created_at: string
          date: string
          deferred: string | null
          follow_ups_owed: string | null
          generated_at: string
          has_expiring_proposals: boolean
          has_overdue_items: boolean
          has_unsigned_contracts: boolean
          id: string
          item_count: number
          pre_drafted_replies: string | null
          review_notes: string | null
          reviewed: boolean
          state: string | null
          today_focus: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          deferred?: string | null
          follow_ups_owed?: string | null
          generated_at?: string
          has_expiring_proposals?: boolean
          has_overdue_items?: boolean
          has_unsigned_contracts?: boolean
          id?: string
          item_count?: number
          pre_drafted_replies?: string | null
          review_notes?: string | null
          reviewed?: boolean
          state?: string | null
          today_focus?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          deferred?: string | null
          follow_ups_owed?: string | null
          generated_at?: string
          has_expiring_proposals?: boolean
          has_overdue_items?: boolean
          has_unsigned_contracts?: boolean
          id?: string
          item_count?: number
          pre_drafted_replies?: string | null
          review_notes?: string | null
          reviewed?: boolean
          state?: string | null
          today_focus?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      client_contacts: {
        Row: {
          client_id: string
          created_at: string
          designation: string | null
          email: string | null
          id: string
          is_primary: boolean
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          is_primary?: boolean
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "client_contacts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          billing_address: string | null
          client_name: string
          company_name: string | null
          created_at: string
          designation: string | null
          email: string | null
          id: string
          notes: string | null
          phone: string | null
          primary_contact_name: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_address?: string | null
          client_name: string
          company_name?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_address?: string | null
          client_name?: string
          company_name?: string | null
          created_at?: string
          designation?: string | null
          email?: string | null
          id?: string
          notes?: string | null
          phone?: string | null
          primary_contact_name?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      contract_access_tokens: {
        Row: {
          contract_id: string
          created_at: string
          expires_at: string
          id: string
          password_hash: string | null
          token: string
          viewed_at: string | null
        }
        Insert: {
          contract_id: string
          created_at?: string
          expires_at: string
          id?: string
          password_hash?: string | null
          token: string
          viewed_at?: string | null
        }
        Update: {
          contract_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          password_hash?: string | null
          token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_access_tokens_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contract_status_history: {
        Row: {
          contract_id: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          to_status: string
          user_id: string
        }
        Insert: {
          contract_id: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status: string
          user_id: string
        }
        Update: {
          contract_id?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contract_status_history_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      contracts: {
        Row: {
          client_id: string
          client_signature: string | null
          content: string | null
          contract_type: string
          cost_breakdown: string | null
          created_at: string
          end_date: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          is_external: boolean
          project_id: string | null
          renewal_frequency: string
          scope_of_work: string | null
          start_date: string
          status: string
          template_id: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          client_id: string
          client_signature?: string | null
          content?: string | null
          contract_type: string
          cost_breakdown?: string | null
          created_at?: string
          end_date: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_external?: boolean
          project_id?: string | null
          renewal_frequency: string
          scope_of_work?: string | null
          start_date: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          client_id?: string
          client_signature?: string | null
          content?: string | null
          contract_type?: string
          cost_breakdown?: string | null
          created_at?: string
          end_date?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          is_external?: boolean
          project_id?: string | null
          renewal_frequency?: string
          scope_of_work?: string | null
          start_date?: string
          status?: string
          template_id?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contracts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          invoice_id: string
          password_hash: string | null
          token: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          invoice_id: string
          password_hash?: string | null
          token: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          invoice_id?: string
          password_hash?: string | null
          token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoice_access_tokens_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_amounts: {
        Row: {
          amount_paid: number
          invoice_id: string
          total_amount: number
        }
        Insert: {
          amount_paid?: number
          invoice_id: string
          total_amount?: number
        }
        Update: {
          amount_paid?: number
          invoice_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_amounts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: true
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          client_id: string
          contract_id: string | null
          cost_breakdown: string | null
          created_at: string
          currency: string
          due_date: string | null
          id: string
          invoice_number: string
          issued_date: string
          notes: string | null
          paid_at: string | null
          payment_provider: string | null
          payment_reference: string | null
          project_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          contract_id?: string | null
          cost_breakdown?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number: string
          issued_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          contract_id?: string | null
          cost_breakdown?: string | null
          created_at?: string
          currency?: string
          due_date?: string | null
          id?: string
          invoice_number?: string
          issued_date?: string
          notes?: string | null
          paid_at?: string | null
          payment_provider?: string | null
          payment_reference?: string | null
          project_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_contract_id_fkey"
            columns: ["contract_id"]
            isOneToOne: false
            referencedRelation: "contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          contract_renewal: boolean
          created_at: string
          id: string
          proposal_approved: boolean
          proposal_rejected: boolean
          proposal_viewed: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          contract_renewal?: boolean
          created_at?: string
          id?: string
          proposal_approved?: boolean
          proposal_rejected?: boolean
          proposal_viewed?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          contract_renewal?: boolean
          created_at?: string
          id?: string
          proposal_approved?: boolean
          proposal_rejected?: boolean
          proposal_viewed?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          message: string
          read: boolean
          reference_id: string | null
          reference_type: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          read?: boolean
          reference_id?: string | null
          reference_type?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      project_notes: {
        Row: {
          content: string
          created_at: string
          file_name: string | null
          file_type: string | null
          file_url: string | null
          id: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          file_name?: string | null
          file_type?: string | null
          file_url?: string | null
          id?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_notes_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          client_id: string
          created_at: string
          end_date: string | null
          feature_image_url: string | null
          id: string
          is_featured: boolean
          project_name: string
          project_type: string
          start_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          end_date?: string | null
          feature_image_url?: string | null
          id?: string
          is_featured?: boolean
          project_name: string
          project_type: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          end_date?: string | null
          feature_image_url?: string | null
          id?: string
          is_featured?: boolean
          project_name?: string
          project_type?: string
          start_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_access_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          password_hash: string | null
          proposal_id: string
          token: string
          viewed_at: string | null
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          password_hash?: string | null
          proposal_id: string
          token: string
          viewed_at?: string | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          password_hash?: string | null
          proposal_id?: string
          token?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposal_access_tokens_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposal_status_history: {
        Row: {
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          proposal_id: string
          to_status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          proposal_id: string
          to_status: string
          user_id: string
        }
        Update: {
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          proposal_id?: string
          to_status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "proposal_status_history_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client_id: string
          content: string | null
          cost_breakdown: string | null
          created_at: string
          customer_goals: string | null
          duration: string | null
          id: string
          project_id: string | null
          scope_of_work: string | null
          status: string
          template_id: string | null
          title: string
          updated_at: string
          user_id: string
          validity_date: string | null
        }
        Insert: {
          client_id: string
          content?: string | null
          cost_breakdown?: string | null
          created_at?: string
          customer_goals?: string | null
          duration?: string | null
          id?: string
          project_id?: string | null
          scope_of_work?: string | null
          status?: string
          template_id?: string | null
          title: string
          updated_at?: string
          user_id: string
          validity_date?: string | null
        }
        Update: {
          client_id?: string
          content?: string | null
          cost_breakdown?: string | null
          created_at?: string
          customer_goals?: string | null
          duration?: string | null
          id?: string
          project_id?: string | null
          scope_of_work?: string | null
          status?: string
          template_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          validity_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "templates"
            referencedColumns: ["id"]
          },
        ]
      }
      team_members: {
        Row: {
          can_view_financials: boolean
          created_at: string
          id: string
          invited_email: string
          member_id: string | null
          owner_id: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          can_view_financials?: boolean
          created_at?: string
          id?: string
          invited_email: string
          member_id?: string | null
          owner_id: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          can_view_financials?: boolean
          created_at?: string
          id?: string
          invited_email?: string
          member_id?: string | null
          owner_id?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      templates: {
        Row: {
          content: string
          created_at: string
          creator_name: string | null
          id: string
          is_public: boolean
          name: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          creator_name?: string | null
          id?: string
          is_public?: boolean
          name: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          creator_name?: string | null
          id?: string
          is_public?: boolean
          name?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timesheets: {
        Row: {
          created_at: string
          date: string
          duration: number
          id: string
          notes: string | null
          owner: string
          project_id: string
          status: string
          task: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date?: string
          duration?: number
          id?: string
          notes?: string | null
          owner: string
          project_id: string
          status?: string
          task: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          duration?: number
          id?: string
          notes?: string | null
          owner?: string
          project_id?: string
          status?: string
          task?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timesheets_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reviews: {
        Row: {
          at_risk_next_week: string | null
          created_at: string | null
          generated_at: string | null
          id: string
          patterns_identified: string | null
          recommendation: string | null
          review_notes: string | null
          reviewed: boolean | null
          user_id: string | null
          week_ending_date: string
          what_shipped: string | null
          what_slipped: string | null
        }
        Insert: {
          at_risk_next_week?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          patterns_identified?: string | null
          recommendation?: string | null
          review_notes?: string | null
          reviewed?: boolean | null
          user_id?: string | null
          week_ending_date: string
          what_shipped?: string | null
          what_slipped?: string | null
        }
        Update: {
          at_risk_next_week?: string | null
          created_at?: string | null
          generated_at?: string | null
          id?: string
          patterns_identified?: string | null
          recommendation?: string | null
          review_notes?: string | null
          reviewed?: boolean | null
          user_id?: string | null
          week_ending_date?: string
          what_shipped?: string | null
          what_slipped?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_portfolio_branding: {
        Row: {
          accent_color: string | null
          company_logo_url: string | null
          company_name: string | null
          primary_color: string | null
          slug: string | null
          support_email: string | null
          tagline: string | null
          user_id: string | null
          website_url: string | null
        }
        Insert: {
          accent_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          primary_color?: string | null
          slug?: string | null
          support_email?: string | null
          tagline?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Update: {
          accent_color?: string | null
          company_logo_url?: string | null
          company_name?: string | null
          primary_color?: string | null
          slug?: string | null
          support_email?: string | null
          tagline?: string | null
          user_id?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      public_portfolio_clients: {
        Row: {
          client_name: string | null
          company_name: string | null
          id: string | null
        }
        Insert: {
          client_name?: string | null
          company_name?: string | null
          id?: string | null
        }
        Update: {
          client_name?: string | null
          company_name?: string | null
          id?: string | null
        }
        Relationships: []
      }
      public_portfolio_projects: {
        Row: {
          client_id: string | null
          feature_image_url: string | null
          id: string | null
          is_featured: boolean | null
          project_name: string | null
          project_type: string | null
          status: string | null
          user_id: string | null
        }
        Insert: {
          client_id?: string | null
          feature_image_url?: string | null
          id?: string | null
          is_featured?: boolean | null
          project_name?: string | null
          project_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Update: {
          client_id?: string | null
          feature_image_url?: string | null
          id?: string | null
          is_featured?: boolean | null
          project_name?: string | null
          project_type?: string | null
          status?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "public_portfolio_clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_view_financials: {
        Args: { _owner_id: string; _user_id: string }
        Returns: boolean
      }
      get_accessible_user_ids: { Args: { _user_id: string }; Returns: string[] }
      get_owner_id: { Args: { _user_id: string }; Returns: string }
      get_team_roster: {
        Args: never
        Returns: {
          email: string
          full_name: string
          user_id: string
        }[]
      }
      get_workspace_role: {
        Args: { _owner_id: string; _user_id: string }
        Returns: string
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
