import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { user_id, name, email, phone, company_name, project_name, project_type, questionnaire } = body;

    if (!user_id || !name || !email) {
      return new Response(
        JSON.stringify({ error: "user_id, name, and email are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Check if client already exists (by email + user_id)
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user_id)
      .eq("email", email)
      .maybeSingle();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id,
          client_name: name,
          email,
          phone: phone || null,
          company_name: company_name || null,
          status: "pending-review",
        })
        .select()
        .single();

      if (clientError) throw clientError;
      clientId = client.id;
    }

    // 2. Create project with "new-request" status
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .insert({
        user_id,
        client_id: clientId,
        project_name: project_name || `${name}'s Project`,
        project_type: project_type || "one-time",
        status: "new-request",
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // 3. Store questionnaire answers as a project note
    if (questionnaire && Object.keys(questionnaire).length > 0) {
      const noteContent = Object.entries(questionnaire)
        .filter(([, v]) => (v as string).trim())
        .map(([question, answer]) => `**${question}**\n${answer}`)
        .join("\n\n---\n\n");

      if (noteContent) {
        const { error: noteError } = await supabase
          .from("project_notes")
          .insert({
            project_id: project.id,
            user_id,
            content: `📋 Client Questionnaire Response\n\n${noteContent}`,
          });

        if (noteError) throw noteError;
      }
    }

    return new Response(
      JSON.stringify({ success: true, client_id: clientId, project_id: project.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
