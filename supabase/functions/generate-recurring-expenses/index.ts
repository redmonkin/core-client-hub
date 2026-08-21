import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// -- Next-run-date advancement, ported from generate-recurring-invoices --
function advanceRunDate(current: string, frequency: string, dayOfMonth: number): string {
  const d = new Date(current + "T00:00:00Z");
  const monthsToAdd = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  const targetMonthIndex = d.getUTCFullYear() * 12 + d.getUTCMonth() + monthsToAdd;
  const targetYear = Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDayOfTargetMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(dayOfMonth, lastDayOfTargetMonth);
  return new Date(Date.UTC(targetYear, targetMonth, day)).toISOString().split("T")[0];
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    console.log("Starting recurring expense generation...");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey);
    const today = new Date().toISOString().split("T")[0];

    const { data: schedules, error: schedulesError } = await supabase
      .from("recurring_expenses")
      .select("*, recurring_expense_projects(project_id)")
      .eq("is_active", true)
      .lte("next_run_date", today);

    if (schedulesError) throw schedulesError;

    console.log(`Found ${schedules?.length || 0} recurring expense schedule(s) due`);

    const generated: string[] = [];
    const errors: string[] = [];

    for (const schedule of schedules || []) {
      try {
        const { data: expenseRow, error: expenseError } = await supabase
          .from("expenses")
          .insert({
            user_id: schedule.user_id,
            expense_date: today,
            category: schedule.category,
            vendor: schedule.vendor,
            description: schedule.description,
            amount: schedule.amount,
            notes: schedule.notes,
          })
          .select("id")
          .single();
        if (expenseError) throw expenseError;

        const projectIds: string[] = (schedule.recurring_expense_projects || []).map((p: { project_id: string }) => p.project_id);
        if (projectIds.length > 0) {
          const { error: linkError } = await supabase
            .from("expense_projects")
            .insert(projectIds.map((projectId) => ({ expense_id: expenseRow.id, project_id: projectId })));
          if (linkError) throw linkError;
        }

        generated.push(expenseRow.id);

        const nextRunDate = advanceRunDate(schedule.next_run_date, schedule.frequency, schedule.day_of_month);
        const shouldDeactivate = !!schedule.end_date && nextRunDate > schedule.end_date;
        const { error: updateError } = await supabase
          .from("recurring_expenses")
          .update({
            next_run_date: nextRunDate,
            last_generated_expense_id: expenseRow.id,
            is_active: shouldDeactivate ? false : schedule.is_active,
          })
          .eq("id", schedule.id);
        if (updateError) throw updateError;
      } catch (scheduleError: any) {
        console.error(`Error processing recurring expense schedule ${schedule.id}:`, scheduleError);
        errors.push(`Schedule ${schedule.id}: ${scheduleError.message}`);
      }
    }

    console.log(`Recurring expense generation complete. Generated: ${generated.length}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        generated: generated.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  } catch (error: any) {
    console.error("Error in recurring expense generation:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred" }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
