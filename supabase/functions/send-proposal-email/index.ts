import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendProposalRequest {
  proposalId: string;
  clientEmail: string;
  clientName: string;
  proposalTitle: string;
  scopeOfWork: string | null;
  costBreakdown: string | null;
  validityDate: string | null;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      proposalId,
      clientEmail,
      clientName,
      proposalTitle,
      scopeOfWork,
      costBreakdown,
      validityDate,
    }: SendProposalRequest = await req.json();

    console.log(`Sending proposal email to ${clientEmail} for proposal: ${proposalTitle}`);

    if (!clientEmail) {
      throw new Error("Client email is required");
    }

    // Format validity date if present
    const formattedValidity = validityDate
      ? new Date(validityDate).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Proposal: ${proposalTitle}</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">New Proposal</h1>
          </div>
          
          <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
            <p style="margin-top: 0;">Dear ${clientName},</p>
            
            <p>We are pleased to present you with the following proposal:</p>
            
            <div style="background: white; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb; margin: 20px 0;">
              <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">${proposalTitle}</h2>
              
              ${scopeOfWork ? `
                <h3 style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Scope of Work</h3>
                <p style="color: #6b7280; margin-bottom: 20px;">${scopeOfWork.replace(/\n/g, '<br>')}</p>
              ` : ''}
              
              ${costBreakdown ? `
                <h3 style="color: #374151; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">Cost Breakdown</h3>
                <p style="color: #6b7280; margin-bottom: 20px;">${costBreakdown.replace(/\n/g, '<br>')}</p>
              ` : ''}
              
              ${formattedValidity ? `
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 0;">
                  <strong>Valid Until:</strong> ${formattedValidity}
                </p>
              ` : ''}
            </div>
            
            <p>If you have any questions or would like to discuss this proposal further, please don't hesitate to reach out.</p>
            
            <p style="margin-bottom: 0;">Best regards,<br>Your Team</p>
          </div>
          
          <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
            <p style="margin: 0;">This proposal was sent via our proposal management system.</p>
          </div>
        </body>
      </html>
    `;

    const emailResponse = await resend.emails.send({
      from: "Proposals <onboarding@resend.dev>",
      to: [clientEmail],
      subject: `Proposal: ${proposalTitle}`,
      html: emailHtml,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error sending proposal email:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
