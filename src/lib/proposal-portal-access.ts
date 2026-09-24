import { supabase } from "@/integrations/supabase/client";
import { generatePortalPassword, hashPortalPassword } from "@/lib/portal-password";

export type PortalAccessResult = {
  link: string;
  password: string | null;
  isExisting: boolean;
};

function buildLink(origin: string, token: string) {
  return `${origin}/portal?token=${token}`;
}

async function createNewToken(proposalId: string, origin: string): Promise<PortalAccessResult> {
  const tokenArray = new Uint8Array(32);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray, (b) => b.toString(16).padStart(2, "0")).join("");

  const password = generatePortalPassword();
  const passwordHash = await hashPortalPassword(password);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error } = await supabase.from("proposal_access_tokens").insert({
    proposal_id: proposalId,
    token,
    expires_at: expiresAt.toISOString(),
    password_hash: passwordHash,
  });

  if (error) throw error;

  return { link: buildLink(origin, token), password, isExisting: false };
}

export async function getOrCreateProposalPortalAccess(
  proposalId: string,
  origin: string,
): Promise<PortalAccessResult> {
  const { data: existing, error } = await supabase
    .from("proposal_access_tokens")
    .select("token, expires_at")
    .eq("proposal_id", proposalId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  if (existing) {
    return {
      link: buildLink(origin, existing.token),
      password: null,
      isExisting: true,
    };
  }

  return createNewToken(proposalId, origin);
}

export async function regenerateProposalPortalAccess(
  proposalId: string,
  origin: string,
): Promise<PortalAccessResult> {
  const { error: deleteError } = await supabase
    .from("proposal_access_tokens")
    .delete()
    .eq("proposal_id", proposalId);

  if (deleteError) throw deleteError;

  return createNewToken(proposalId, origin);
}
