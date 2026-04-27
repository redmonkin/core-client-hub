import { supabase } from "@/integrations/supabase/client";

export type PortalAccessResult = {
  link: string;
  password: string | null;
  isExisting: boolean;
};

function buildLink(origin: string, token: string) {
  return `${origin}/portal?token=${token}`;
}

async function createNewToken(contractId: string, origin: string): Promise<PortalAccessResult> {
  const tokenArray = new Uint8Array(32);
  crypto.getRandomValues(tokenArray);
  const token = Array.from(tokenArray, (byte) => byte.toString(16).padStart(2, "0")).join("");

  const passwordArray = new Uint8Array(4);
  crypto.getRandomValues(passwordArray);
  const password = Array.from(passwordArray, (byte) => byte.toString(36).padStart(2, "0"))
    .join("")
    .substring(0, 6)
    .toUpperCase();

  const passwordHashBuffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password));
  const passwordHash = Array.from(new Uint8Array(passwordHashBuffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 30);

  const { error: insertError } = await supabase.from("contract_access_tokens").insert({
    contract_id: contractId,
    token,
    expires_at: expiresAt.toISOString(),
    password_hash: passwordHash,
  });

  if (insertError) throw insertError;

  return {
    link: buildLink(origin, token),
    password,
    isExisting: false,
  };
}

/**
 * Returns an existing non-expired token if one exists (password is null since it
 * was hashed on creation and cannot be recovered). Otherwise creates a new one.
 */
export async function getOrCreateContractPortalAccess(
  contractId: string,
  origin: string,
): Promise<PortalAccessResult> {
  const { data: existing, error } = await supabase
    .from("contract_access_tokens")
    .select("token, expires_at")
    .eq("contract_id", contractId)
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

  return createNewToken(contractId, origin);
}

/**
 * Always deletes any existing tokens and creates a fresh one. Returns the new
 * link AND the freshly-generated password.
 */
export async function regenerateContractPortalAccess(
  contractId: string,
  origin: string,
): Promise<PortalAccessResult> {
  const { error: deleteError } = await supabase
    .from("contract_access_tokens")
    .delete()
    .eq("contract_id", contractId);

  if (deleteError) throw deleteError;

  return createNewToken(contractId, origin);
}

/**
 * @deprecated Use getOrCreateContractPortalAccess or regenerateContractPortalAccess.
 * Kept for backwards compatibility — currently regenerates.
 */
export async function createContractPortalAccess(contractId: string, origin: string) {
  return regenerateContractPortalAccess(contractId, origin);
}
