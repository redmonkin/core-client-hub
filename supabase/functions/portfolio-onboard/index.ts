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

    // Input validation
    if (!user_id || typeof user_id !== "string" || user_id.length > 100) {
      return new Response(
        JSON.stringify({ error: "Invalid user_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!name || typeof name !== "string" || name.length > 255) {
      return new Response(
        JSON.stringify({ error: "Invalid name" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!email || typeof email !== "string" || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate user_id is a real portfolio owner (has branding settings)
    const { data: branding, error: brandingError } = await supabase
      .from("branding_settings")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (brandingError || !branding) {
      return new Response(
        JSON.stringify({ error: "Invalid portfolio" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Sanitize optional string fields
    const safeName = name.trim().slice(0, 255);
    const safeEmail = email.trim().slice(0, 255);
    const safePhone = (phone && typeof phone === "string") ? phone.trim().slice(0, 50) : null;
    const safeCompany = (company_name && typeof company_name === "string") ? company_name.trim().slice(0, 255) : null;
    const safeProjectName = (project_name && typeof project_name === "string") ? project_name.trim().slice(0, 255) : `${safeName}'s Project`;
    const safeProjectType = ["one-time", "amc", "retainer"].includes(project_type) ? project_type : "one-time";

    // 1. Check if client already exists (by email + user_id)
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user_id)
      .eq("email", safeEmail)
      .maybeSingle();

    let clientId: string;

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .insert({
          user_id,
          client_name: safeName,
          email: safeEmail,
          phone: safePhone,
          company_name: safeCompany,
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
        project_name: safeProjectName,
        project_type: safeProjectType,
        status: "new-request",
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // 3. Store questionnaire answers as a project note
    if (questionnaire && typeof questionnaire === "object" && Object.keys(questionnaire).length > 0) {
      const noteContent = Object.entries(questionnaire)
        .filter(([, v]) => typeof v === "string" && (v as string).trim())
        .map(([question, answer]) => {
          const q = String(question).slice(0, 500);
          const a = String(answer).slice(0, 2000);
          return `**${q}**\n${a}`;
        })
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
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
