import { useEffect, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Bell, Eye, CheckCircle, XCircle, Calendar, Loader2 } from "lucide-react";

interface NotificationPreferences {
  id?: string;
  proposal_viewed: boolean;
  proposal_approved: boolean;
  proposal_rejected: boolean;
  contract_renewal: boolean;
}

const defaultPreferences: NotificationPreferences = {
  proposal_viewed: true,
  proposal_approved: true,
  proposal_rejected: true,
  contract_renewal: true,
};

export default function Settings() {
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setPreferences(data);
      } else {
        // Create default preferences for new users
        const { data: newPrefs, error: insertError } = await supabase
          .from("notification_preferences")
          .insert({ user_id: user.id, ...defaultPreferences })
          .select()
          .single();

        if (insertError) throw insertError;
        if (newPrefs) setPreferences(newPrefs);
      }
    } catch (error) {
      console.error("Error fetching preferences:", error);
      toast({
        title: "Error",
        description: "Failed to load notification preferences",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePreference = async (key: keyof NotificationPreferences, value: boolean) => {
    setSaving(true);
    const newPreferences = { ...preferences, [key]: value };
    setPreferences(newPreferences);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notification_preferences")
        .update({ [key]: value })
        .eq("user_id", user.id);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Notification preference updated",
      });
    } catch (error) {
      console.error("Error updating preference:", error);
      // Revert on error
      setPreferences(preferences);
      toast({
        title: "Error",
        description: "Failed to update preference",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const notificationOptions = [
    {
      key: "proposal_viewed" as const,
      label: "Proposal Viewed",
      description: "Get notified when a client views your proposal",
      icon: Eye,
    },
    {
      key: "proposal_approved" as const,
      label: "Proposal Approved",
      description: "Get notified when a client approves your proposal",
      icon: CheckCircle,
    },
    {
      key: "proposal_rejected" as const,
      label: "Proposal Rejected",
      description: "Get notified when a client rejects your proposal",
      icon: XCircle,
    },
    {
      key: "contract_renewal" as const,
      label: "Contract Renewal",
      description: "Get reminded about upcoming contract renewals",
      icon: Calendar,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Manage your account and notification preferences"
      />

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <CardTitle>Notification Preferences</CardTitle>
          </div>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {notificationOptions.map((option) => (
            <div
              key={option.key}
              className="flex items-center justify-between space-x-4 py-3 border-b border-border last:border-0"
            >
              <div className="flex items-start gap-3">
                <option.icon className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div className="space-y-1">
                  <Label htmlFor={option.key} className="text-base font-medium">
                    {option.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {option.description}
                  </p>
                </div>
              </div>
              <Switch
                id={option.key}
                checked={preferences[option.key]}
                onCheckedChange={(checked) => updatePreference(option.key, checked)}
                disabled={saving}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
