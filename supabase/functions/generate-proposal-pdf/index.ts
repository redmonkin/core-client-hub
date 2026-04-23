import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface GeneratePdfRequest {
  proposalTitle: string;
  clientName: string;
  projectName: string | null;
  scopeOfWork: string | null;
  costBreakdown: string | null;
  validityDate: string | null;
  status: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      proposalTitle,
      clientName,
      projectName,
      scopeOfWork,
      costBreakdown,
      validityDate,
      status,
    }: GeneratePdfRequest = await req.json();

    console.log(`Generating PDF for proposal: ${proposalTitle}`);

    // Create a new PDF document
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let yPosition = 20;

    // Helper function to add wrapped text
    const addWrappedText = (text: string, x: number, y: number, maxWidth: number, lineHeight: number = 7): number => {
      const lines = doc.splitTextToSize(text, maxWidth);
      doc.text(lines, x, y);
      return y + lines.length * lineHeight;
    };

    // Header with gradient-like effect
    doc.setFillColor(102, 126, 234);
    doc.rect(0, 0, pageWidth, 45, "F");

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont("helvetica", "bold");
    doc.text("PROPOSAL", margin, 25);

    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(proposalTitle, margin, 35);

    yPosition = 60;

    // Reset text color
    doc.setTextColor(51, 51, 51);

    // Client Information Section
    doc.setFillColor(249, 250, 251);
    doc.rect(margin, yPosition - 5, contentWidth, 30, "F");

    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);
    doc.text("PREPARED FOR", margin + 5, yPosition + 3);

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(51, 51, 51);
    doc.text(clientName, margin + 5, yPosition + 12);

    if (projectName) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(107, 114, 128);
      doc.text(`Project: ${projectName}`, margin + 5, yPosition + 20);
    }

    yPosition += 40;

    // Status and Validity
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(107, 114, 128);

    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      draft: [156, 163, 175],
      sent: [59, 130, 246],
      approved: [34, 197, 94],
      rejected: [239, 68, 68],
    };
    const statusColor = statusColors[status] || [156, 163, 175];
    
    doc.setFillColor(...statusColor);
    doc.roundedRect(margin, yPosition, 25, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text(status.toUpperCase(), margin + 3, yPosition + 5.5);

    if (validityDate) {
      doc.setTextColor(107, 114, 128);
      doc.setFontSize(10);
      const formattedDate = new Date(validityDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(`Valid until: ${formattedDate}`, margin + 35, yPosition + 5.5);
    }

    yPosition += 20;

    // Scope of Work Section
    if (scopeOfWork) {
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(102, 126, 234);
      doc.text("Scope of Work", margin, yPosition);
      yPosition += 8;

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, margin + 30, yPosition);
      yPosition += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      yPosition = addWrappedText(scopeOfWork, margin, yPosition, contentWidth, 5);
      yPosition += 15;
    }

    // Cost Breakdown Section
    if (costBreakdown) {
      // Check if we need a new page
      if (yPosition > 230) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(102, 126, 234);
      doc.text("Cost Breakdown", margin, yPosition);
      yPosition += 8;

      doc.setDrawColor(102, 126, 234);
      doc.setLineWidth(0.5);
      doc.line(margin, yPosition, margin + 35, yPosition);
      yPosition += 8;

      doc.setFillColor(249, 250, 251);
      const costLines = doc.splitTextToSize(costBreakdown, contentWidth - 10);
      const costBoxHeight = Math.max(costLines.length * 5 + 10, 20);
      doc.rect(margin, yPosition - 3, contentWidth, costBoxHeight, "F");

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(75, 85, 99);
      doc.text(costLines, margin + 5, yPosition + 4);
      yPosition += costBoxHeight + 15;
    }

    // Footer
    const footerY = doc.internal.pageSize.getHeight() - 15;
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `Generated on ${new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })}`,
      margin,
      footerY
    );
    doc.text("Page 1", pageWidth - margin - 10, footerY);

    // Generate PDF as base64
    const pdfBase64 = doc.output("datauristring").split(",")[1];

    console.log("PDF generated successfully");

    return new Response(
      JSON.stringify({ success: true, pdf: pdfBase64 }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ success: false, error: "An internal error occurred while generating the PDF" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
