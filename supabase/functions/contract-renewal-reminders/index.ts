import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailFrom } from "../_shared/email.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

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

      // Build email content
      const contractsHtml = userContracts
        .map((contract) => {
          const client = clientMap.get(contract.client_id);
          const daysUntilExpiry = Math.ceil(
            (new Date(contract.end_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const urgencyColor = daysUntilExpiry <= 7 ? "#ef4444" : daysUntilExpiry <= 14 ? "#f59e0b" : "#3b82f6";

          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <strong>${escapeHtml(client?.client_name || "Unknown Client")}</strong>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${escapeHtml(contract.contract_type)}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                $${Number(contract.value).toLocaleString()}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${new Date(contract.end_date).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <span style="background: ${urgencyColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                  ${daysUntilExpiry} days
                </span>
              </td>
            </tr>
          `;
        })
        .join("");

      const emailHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Contract Renewal Reminder</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⏰ Contract Renewal Reminder</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin-top: 0;">You have <strong>${userContracts.length} contract${userContracts.length > 1 ? "s" : ""}</strong> expiring in the next 30 days:</p>
              
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Client</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Type</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Value</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Expires</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Time Left</th>
                  </tr>
                </thead>
                <tbody>
                  ${contractsHtml}
                </tbody>
              </table>
              
              <p style="color: #6b7280; font-size: 14px;">
                Review these contracts and take action to renew or close them as needed.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">This is an automated reminder from your contract management system.</p>
            </div>
          </body>
        </html>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: emailFrom("Contract Reminders"),
          to: [userEmail],
          subject: `⏰ ${userContracts.length} Contract${userContracts.length > 1 ? "s" : ""} Expiring Soon`,
          html: emailHtml,
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
