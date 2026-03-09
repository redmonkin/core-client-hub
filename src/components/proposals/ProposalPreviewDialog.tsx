import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, X, Download, Loader2 } from 'lucide-react';
import { Template } from '@/hooks/useTemplates';
import { ProposalData, replacePlaceholders } from '@/lib/proposal-utils';
import { toast } from 'sonner';

interface ProposalPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  proposalData: ProposalData;
}

async function exportToPdf(html: string, filename: string) {
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  // Create an off-screen container with the rendered HTML
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px'; // A4 width at 96 DPI
  container.style.padding = '40px';
  container.style.background = '#ffffff';
  container.style.color = '#1a1a1a';
  container.style.fontFamily = 'system-ui, -apple-system, sans-serif';
  container.style.fontSize = '14px';
  container.style.lineHeight = '1.6';
  container.innerHTML = `<div class="prose prose-sm max-w-none" style="color:#1a1a1a;">${html}</div>`;
  document.body.appendChild(container);

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    const A4_WIDTH_MM = 210;
    const A4_HEIGHT_MM = 297;
    const MARGIN_MM = 10;
    const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;

    const imgWidth = CONTENT_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageContentHeight = A4_HEIGHT_MM - MARGIN_MM * 2;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');

    let heightLeft = imgHeight;
    let position = MARGIN_MM;

    // First page
    pdf.addImage(imgData, 'PNG', MARGIN_MM, position, imgWidth, imgHeight);
    heightLeft -= pageContentHeight;

    // Additional pages
    while (heightLeft > 0) {
      pdf.addPage();
      position = MARGIN_MM - (imgHeight - heightLeft);
      pdf.addImage(imgData, 'PNG', MARGIN_MM, position, imgWidth, imgHeight);
      heightLeft -= pageContentHeight;
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

export function ProposalPreviewDialog({
  open,
  onOpenChange,
  template,
  proposalData,
}: ProposalPreviewDialogProps) {
  const [isExporting, setIsExporting] = useState(false);

  if (!template) return null;

  const previewContent = replacePlaceholders(template.content, proposalData, true);

  const handleExportPdf = async () => {
    setIsExporting(true);
    const toastId = toast.loading('Generating PDF...');
    try {
      const pdfContent = replacePlaceholders(template.content, proposalData, false);
      const filename = `${proposalData.title.replace(/[^a-z0-9]/gi, '_')}_proposal.pdf`;
      await exportToPdf(pdfContent, filename);
      toast.success('PDF downloaded successfully', { id: toastId });
    } catch (error: any) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF: ' + error.message, { id: toastId });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[90vw] w-full h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        {/* Header */}
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Eye className="h-5 w-5 text-primary" />
              <div>
                <DialogTitle>{proposalData.title}</DialogTitle>
                <DialogDescription className="flex items-center gap-2 mt-1">
                  Preview using template:{' '}
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    {template.name}
                  </Badge>
                </DialogDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExporting}
              >
                {isExporting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export PDF
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Legend */}
        <div className="flex-shrink-0 mx-6 mt-4 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="text-muted-foreground">
            <span className="bg-primary/20 text-primary px-1 rounded font-medium">Highlighted text</span>
            {' '}shows actual data filled from your proposal and client details.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mx-6 my-4 rounded-lg border bg-card p-8">
          <div
            className="prose prose-sm max-w-none dark:prose-invert
              prose-headings:text-foreground
              prose-p:text-foreground
              prose-strong:text-foreground
              prose-li:text-foreground"
            dangerouslySetInnerHTML={{ __html: previewContent }}
          />
        </div>

        {/* Actions */}
        <div className="flex-shrink-0 flex justify-end gap-3 px-6 py-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { ProposalData };
