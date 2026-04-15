import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';

export function useWorkspaceUser() {
  const { user } = useAuth();
  const [workspaceUserId, setWorkspaceUserId] = useState<string | null>(null);
  const [isTeamMember, setIsTeamMember] = useState(false);
  const [ownerEmail, setOwnerEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setWorkspaceUserId(null);
      setIsTeamMember(false);
      setOwnerEmail(null);
      setLoading(false);
      return;
    }

    const fetchWorkspaceUser = async () => {
      try {
        // Get the owner_id using the security definer function
        const { data, error } = await supabase.rpc('get_owner_id', {
          _user_id: user.id,
        });

        if (error) {
          console.error('Error fetching workspace user:', error);
          setWorkspaceUserId(user.id);
          setIsTeamMember(false);
        } else {
          const ownerId = data as string;
          setWorkspaceUserId(ownerId);
          setIsTeamMember(ownerId !== user.id);

          // If team member, fetch the owner's branding/company info
          if (ownerId !== user.id) {
            const { data: branding } = await supabase
              .from('branding_settings')
              .select('company_name, support_email')
              .eq('user_id', ownerId)
              .maybeSingle();
            setOwnerEmail(branding?.support_email || branding?.company_name || null);
          }
        }
      } catch (err) {
        console.error('Error in useWorkspaceUser:', err);
        setWorkspaceUserId(user.id);
        setIsTeamMember(false);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkspaceUser();
  }, [user]);

  return {
    /** The user_id to use for all inserts — owner's ID if team member, own ID if owner */
    workspaceUserId: workspaceUserId || user?.id || null,
    /** Whether the current user is a team member (not the owner) */
    isTeamMember,
    /** Owner's company name or email for display */
    ownerInfo: ownerEmail,
    loading,
  };
}
