import { supabase } from "@/integrations/supabase/client";

export async function createContractPortalAccess(contractId: string, origin: string) {
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

  const { error: deleteError } = await supabase
    .from("contract_access_tokens")
    .delete()
    .eq("contract_id", contractId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await supabase.from("contract_access_tokens").insert({
    contract_id: contractId,
    token,
    expires_at: expiresAt.toISOString(),
    password_hash: passwordHash,
  });

  if (insertError) throw insertError;

  return {
    link: `${origin}/portal?token=${token}`,
    password,
  };
}
