import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { emailFrom } from "../_shared/email.ts";
import { proposalExpiryDigest } from "../_shared/emails.ts";

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

      const email = proposalExpiryDigest(
        userProposals.map((proposal) => ({
          title: proposal.title,
          client: clientMap.get(proposal.client_id)?.client_name || "Unknown client",
          value: calculateTotal(proposal.cost_breakdown),
          expires: proposal.validity_date!,
          daysLeft: Math.ceil((new Date(proposal.validity_date!).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
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
