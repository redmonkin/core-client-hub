import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UpdateProposalRequest {
  token: string;
  action: "approve" | "reject";
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");

    // GET - Retrieve proposal by token
    if (req.method === "GET") {
      if (!token) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Fetching proposal for token: ${token.substring(0, 8)}...`);

      // Find the access token
      const { data: accessToken, error: tokenError } = await supabase
        .from("proposal_access_tokens")
        .select("*")
        .eq("token", token)
        .maybeSingle();

      if (tokenError) {
        console.error("Token lookup error:", tokenError);
        throw tokenError;
      }

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired link" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Check if token is expired
      if (new Date(accessToken.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This link has expired" }),
          { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Get the proposal with client info
      const { data: proposal, error: proposalError } = await supabase
        .from("proposals")
        .select(`
          id,
          title,
          scope_of_work,
          cost_breakdown,
          validity_date,
          status,
          client_id,
          project_id,
          created_at
        `)
        .eq("id", accessToken.proposal_id)
        .single();

      if (proposalError) {
        console.error("Proposal lookup error:", proposalError);
        throw proposalError;
      }

      // Get client name
      const { data: client } = await supabase
        .from("clients")
        .select("client_name, company_name")
        .eq("id", proposal.client_id)
        .single();

      // Get project name if exists
      let projectName = null;
      if (proposal.project_id) {
        const { data: project } = await supabase
          .from("projects")
          .select("project_name")
          .eq("id", proposal.project_id)
          .single();
        projectName = project?.project_name;
      }

      // Update viewed_at if not already viewed
      if (!accessToken.viewed_at) {
        await supabase
          .from("proposal_access_tokens")
          .update({ viewed_at: new Date().toISOString() })
          .eq("id", accessToken.id);
      }

      console.log(`Proposal ${proposal.id} retrieved successfully`);

      return new Response(
        JSON.stringify({
          success: true,
          proposal: {
            ...proposal,
            client_name: client?.client_name,
            company_name: client?.company_name,
            project_name: projectName,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // POST - Update proposal status (approve/reject)
    if (req.method === "POST") {
      const { token: bodyToken, action }: UpdateProposalRequest = await req.json();
      const accessToken = bodyToken || token;

      if (!accessToken) {
        return new Response(
          JSON.stringify({ error: "Token is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (!action || !["approve", "reject"].includes(action)) {
        return new Response(
          JSON.stringify({ error: "Valid action (approve/reject) is required" }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      console.log(`Processing ${action} for token: ${accessToken.substring(0, 8)}...`);

      // Find and validate the access token
      const { data: tokenData, error: tokenError } = await supabase
        .from("proposal_access_tokens")
        .select("*")
        .eq("token", accessToken)
        .maybeSingle();

      if (tokenError) throw tokenError;

      if (!tokenData) {
        return new Response(
          JSON.stringify({ error: "Invalid or expired link" }),
          { status: 404, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      if (new Date(tokenData.expires_at) < new Date()) {
        return new Response(
          JSON.stringify({ error: "This link has expired" }),
          { status: 410, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }

      // Update proposal status
      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error: updateError } = await supabase
        .from("proposals")
        .update({ status: newStatus })
        .eq("id", tokenData.proposal_id);

      if (updateError) throw updateError;

      console.log(`Proposal ${tokenData.proposal_id} status updated to ${newStatus}`);

      return new Response(
        JSON.stringify({ success: true, status: newStatus }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in client-portal:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
