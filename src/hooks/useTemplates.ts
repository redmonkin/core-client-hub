import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useWorkspaceUser } from './useWorkspaceUser';
import { toast } from 'sonner';

export type TemplateType = 'proposal' | 'contract';

export interface Template {
  id: string;
  user_id: string;
  name: string;
  type: TemplateType;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface CreateTemplateData {
  name: string;
  type: TemplateType;
  content: string;
}

export interface UpdateTemplateData {
  id: string;
  name: string;
  type: TemplateType;
  content: string;
}

export function useTemplates() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const templatesQuery = useQuery({
    queryKey: ['templates', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Template[];
    },
    enabled: !!user,
  });

  const createTemplate = useMutation({
    mutationFn: async (templateData: CreateTemplateData) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: templateData.name,
          type: templateData.type,
          content: templateData.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template created successfully!');
    },
    onError: (error) => {
      console.error('Error creating template:', error);
      toast.error('Failed to create template');
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async (templateData: UpdateTemplateData) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .update({
          name: templateData.name,
          type: templateData.type,
          content: templateData.content,
        })
        .eq('id', templateData.id)
        .select()
        .single();

      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template updated successfully!');
    },
    onError: (error) => {
      console.error('Error updating template:', error);
      toast.error('Failed to update template');
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', templateId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template deleted successfully!');
    },
    onError: (error) => {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (template: Template) => {
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('templates')
        .insert({
          user_id: user.id,
          name: `${template.name} (Copy)`,
          type: template.type,
          content: template.content,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Template;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
      toast.success('Template duplicated successfully!');
    },
    onError: (error) => {
      console.error('Error duplicating template:', error);
      toast.error('Failed to duplicate template');
    },
  });

  return {
    templates: templatesQuery.data ?? [],
    isLoading: templatesQuery.isLoading,
    error: templatesQuery.error,
    createTemplate,
    updateTemplate,
    deleteTemplate,
    duplicateTemplate,
  };
}
