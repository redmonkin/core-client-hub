import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailFrom } from "../_shared/email.ts";
import { contractRenewalDigest, formatInr } from "../_shared/emails.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify the request is from an authorized source (cron or service role)
  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    console.log("Starting contract renewal check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get contracts ending within the next 30 days
    const today = new Date();
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

    const { data: contracts, error: contractsError } = await supabase
      .from("contracts")
      .select(`
        id,
        contract_type,
        end_date,
        value,
        renewal_frequency,
        status,
        client_id,
        user_id
      `)
      .eq("status", "active")
      .gte("end_date", today.toISOString().split("T")[0])
      .lte("end_date", thirtyDaysFromNow.toISOString().split("T")[0]);

    if (contractsError) {
      console.error("Error fetching contracts:", contractsError);
      throw contractsError;
    }

    console.log(`Found ${contracts?.length || 0} contracts expiring in the next 30 days`);

    if (!contracts || contracts.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No contracts need renewal reminders", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get unique user IDs
    const userIds = [...new Set(contracts.map((c) => c.user_id))];

    // For each user, get their email from auth.users (via profiles or directly)
    // We'll need to get user emails - for now we'll use a simple approach
    const emailsSent: string[] = [];
    const errors: string[] = [];

    // Group contracts by user
    const contractsByUser = contracts.reduce((acc, contract) => {
      if (!acc[contract.user_id]) {
        acc[contract.user_id] = [];
      }
      acc[contract.user_id].push(contract);
      return acc;
    }, {} as Record<string, typeof contracts>);

    // Get client names for each contract
    const clientIds = [...new Set(contracts.map((c) => c.client_id))];
    const { data: clients } = await supabase
      .from("clients")
      .select("id, client_name, email")
      .in("id", clientIds);

    const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);

    // Get user emails from auth.users
    for (const userId of userIds) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user?.email) {
        console.error(`Could not get email for user ${userId}:`, userError);
        errors.push(`User ${userId}: Could not get email`);
        continue;
      }

      const userEmail = userData.user.email;
      const userContracts = contractsByUser[userId];

      const typeLabels: Record<string, string> = { amc: "Annual maintenance", fixed: "Fixed", retainer: "Retainer" };
      const email = contractRenewalDigest(
        userContracts.map((contract) => ({
          client: clientMap.get(contract.client_id)?.client_name || "Unknown client",
          type: typeLabels[contract.contract_type] || contract.contract_type,
          value: formatInr(Number(contract.value) || 0),
          expires: contract.end_date,
          daysLeft: Math.ceil((new Date(contract.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
        })),
      );

      try {
        const emailResponse = await resend.emails.send({
          from: emailFrom("Clientra"),
          to: [userEmail],
          subject: email.subject,
          html: email.html,
        });

        console.log("Reminder email sent:", emailResponse?.data?.id ?? emailResponse?.error);
        emailsSent.push(userEmail);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${userEmail}:`, emailError);
        errors.push(`${userEmail}: ${emailError.message}`);
      }
    }

    console.log(`Renewal reminders complete. Sent: ${emailsSent.length}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${emailsSent.length} reminder email(s)`,
        sent: emailsSent.length,
        emailsSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error("Error in renewal reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
