import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const handler = async (req: Request): Promise<Response> => {
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
    console.log("Starting proposal expiry reminder check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date();
    const todayStr = today.toISOString().split("T")[0];

    // Get proposals expiring in exactly 7 days or 1 day
    const sevenDays = new Date(today);
    sevenDays.setDate(sevenDays.getDate() + 7);
    const oneDay = new Date(today);
    oneDay.setDate(oneDay.getDate() + 1);

    const sevenDaysStr = sevenDays.toISOString().split("T")[0];
    const oneDayStr = oneDay.toISOString().split("T")[0];

    // Fetch proposals with validity_date matching 7-day or 1-day window
    const { data: proposals, error: proposalsError } = await supabase
      .from("proposals")
      .select("id, title, client_id, user_id, validity_date, cost_breakdown, customer_goals, status")
      .in("status", ["draft", "sent"])
      .not("validity_date", "is", null)
      .gte("validity_date", todayStr)
      .lte("validity_date", sevenDaysStr);

    if (proposalsError) {
      console.error("Error fetching proposals:", proposalsError);
      throw proposalsError;
    }

    // Filter to only 1-day and 7-day matches
    const relevantProposals = (proposals || []).filter((p) => {
      return p.validity_date === sevenDaysStr || p.validity_date === oneDayStr;
    });

    console.log(`Found ${relevantProposals.length} proposals needing expiry reminders`);

    if (relevantProposals.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No proposals need expiry reminders", sent: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get client details
    const clientIds = [...new Set(relevantProposals.map((p) => p.client_id))];
    const { data: clients } = await supabase
      .from("clients")
      .select("id, client_name, email")
      .in("id", clientIds);
    const clientMap = new Map(clients?.map((c) => [c.id, c]) || []);

    // Group by user
    const userIds = [...new Set(relevantProposals.map((p) => p.user_id))];
    const proposalsByUser = relevantProposals.reduce((acc, p) => {
      if (!acc[p.user_id]) acc[p.user_id] = [];
      acc[p.user_id].push(p);
      return acc;
    }, {} as Record<string, typeof relevantProposals>);

    const emailsSent: string[] = [];
    const errors: string[] = [];

    const calculateTotal = (costBreakdownJson: string | null): string => {
      if (!costBreakdownJson) return "—";
      try {
        const data = JSON.parse(costBreakdownJson);
        if (!data.items || !Array.isArray(data.items)) return "—";
        const subtotal = data.items.reduce((acc: number, item: any) => {
          const lineTotal = item.quantity * item.unitPrice;
          return acc + lineTotal - lineTotal * (item.discount / 100);
        }, 0);
        const discountAmount = subtotal * ((data.additionalDiscount || 0) / 100);
        const afterDiscount = subtotal - discountAmount;
        const taxAmount = afterDiscount * ((data.taxRate || 0) / 100);
        return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(afterDiscount + taxAmount);
      } catch {
        return "—";
      }
    };

    for (const userId of userIds) {
      const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);

      if (userError || !userData?.user?.email) {
        console.error(`Could not get email for user ${userId}:`, userError);
        errors.push(`User ${userId}: Could not get email`);
        continue;
      }

      const userEmail = userData.user.email;
      const userProposals = proposalsByUser[userId];

      const proposalsHtml = userProposals
        .map((proposal) => {
          const client = clientMap.get(proposal.client_id);
          const daysLeft = Math.ceil(
            (new Date(proposal.validity_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
          );
          const urgencyColor = daysLeft <= 1 ? "#ef4444" : "#f59e0b";
          const urgencyLabel = daysLeft <= 1 ? "Expires Tomorrow" : `${daysLeft} days left`;
          const total = calculateTotal(proposal.cost_breakdown);

          return `
            <tr>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <strong>${proposal.title}</strong>
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${client?.client_name || "Unknown Client"}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">${total}</td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                ${new Date(proposal.validity_date!).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })}
              </td>
              <td style="padding: 12px; border-bottom: 1px solid #e5e7eb;">
                <span style="background: ${urgencyColor}; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                  ${urgencyLabel}
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
            <title>Proposal Expiry Reminder</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 700px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 30px; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">⚠️ Proposal Expiry Reminder</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
              <p style="margin-top: 0;">You have <strong>${userProposals.length} proposal${userProposals.length > 1 ? "s" : ""}</strong> expiring soon:</p>
              
              <table style="width: 100%; border-collapse: collapse; background: white; border-radius: 8px; overflow: hidden; margin: 20px 0;">
                <thead>
                  <tr style="background: #f3f4f6;">
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Proposal</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Client</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Value</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Expires</th>
                    <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #6b7280;">Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  ${proposalsHtml}
                </tbody>
              </table>
              
              <p style="color: #6b7280; font-size: 14px;">
                Follow up with your clients or extend the validity date to keep these proposals active.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">This is an automated reminder from Clientra.</p>
            </div>
          </body>
        </html>
      `;

      try {
        const emailResponse = await resend.emails.send({
          from: "Proposal Reminders <onboarding@resend.dev>",
          to: [userEmail],
          subject: `⚠️ ${userProposals.length} Proposal${userProposals.length > 1 ? "s" : ""} Expiring Soon`,
          html: emailHtml,
        });

        console.log(`Email sent to ${userEmail}:`, emailResponse);
        emailsSent.push(userEmail);
      } catch (emailError: any) {
        console.error(`Failed to send email to ${userEmail}:`, emailError);
        errors.push(`${userEmail}: ${emailError.message}`);
      }
    }

    console.log(`Proposal expiry reminders complete. Sent: ${emailsSent.length}, Errors: ${errors.length}`);

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
    console.error("Error in proposal expiry reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
