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

  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const MARGIN_MM = 10;
  const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
  const CONTENT_HEIGHT_MM = A4_HEIGHT_MM - MARGIN_MM * 2;
  const SECTION_GAP_MM = 3;

  // Create an off-screen container with fully inlined styles
  const container = document.createElement('div');
  container.style.position = 'absolute';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '794px';
  container.style.background = '#ffffff';
  document.body.appendChild(container);

  container.innerHTML = `
    <style>
      .pdf-content {
        font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        font-size: 14px;
        line-height: 1.7;
        color: #1a1a1a;
        padding: 50px 55px;
        max-width: 100%;
        word-wrap: break-word;
      }
      .pdf-content h1 { font-size: 26px; font-weight: 700; margin: 28px 0 12px; color: #111827; line-height: 1.3; }
      .pdf-content h2 { font-size: 21px; font-weight: 700; margin: 24px 0 10px; color: #111827; line-height: 1.3; }
      .pdf-content h3 { font-size: 17px; font-weight: 600; margin: 20px 0 8px; color: #111827; line-height: 1.4; }
      .pdf-content p { margin: 0 0 12px; color: #374151; }
      .pdf-content strong, .pdf-content b { font-weight: 700; color: #111827; }
      .pdf-content em, .pdf-content i { font-style: italic; }
      .pdf-content ul { list-style-type: disc; margin: 8px 0 12px; padding-left: 24px; }
      .pdf-content ol { list-style-type: decimal; margin: 8px 0 12px; padding-left: 24px; }
      .pdf-content li { margin: 4px 0; padding-left: 4px; color: #374151; }
      .pdf-content li > ul, .pdf-content li > ol { margin: 4px 0; }
      .pdf-content blockquote { border-left: 3px solid #d1d5db; margin: 12px 0; padding: 8px 16px; color: #6b7280; font-style: italic; }
      .pdf-content hr { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
      .pdf-content table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
      .pdf-content table th { background: #f3f4f6; border-bottom: 2px solid #e5e7eb; padding: 8px 12px; text-align: left; font-weight: 600; color: #374151; }
      .pdf-content table td { padding: 8px 12px; border-bottom: 1px solid #e5e7eb; color: #374151; }
      .pdf-content table tfoot td { font-weight: 600; }
      .pdf-content img { max-width: 100%; height: auto; }
      [data-pdf-section] { break-inside: avoid; page-break-inside: avoid; }
    </style>
    <div class="pdf-content">${html}</div>
  `;

  try {
    const content = container.querySelector('.pdf-content') as HTMLElement | null;
    if (!content) throw new Error('Unable to prepare PDF content');

    // Build logical sections to improve page breaks (heading + related content)
    const originalNodes = Array.from(content.childNodes);
    content.innerHTML = '';

    const createSection = () => {
      const section = document.createElement('section');
      section.setAttribute('data-pdf-section', 'true');
      return section;
    };

    let currentSection = createSection();

    for (const node of originalNodes) {
      const isWhitespaceText = node.nodeType === Node.TEXT_NODE && !node.textContent?.trim();
      if (isWhitespaceText) continue;

      const element = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : null;
      const isHeading = !!element?.matches('h1, h2, h3');

      if (isHeading && currentSection.childNodes.length > 0) {
        content.appendChild(currentSection);
        currentSection = createSection();
      }

      currentSection.appendChild(node);
    }

    if (currentSection.childNodes.length > 0) {
      content.appendChild(currentSection);
    }

    const sections = Array.from(content.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
    if (sections.length === 0) throw new Error('No PDF sections found');

    const pdf = new jsPDF('p', 'mm', 'a4');
    let currentY = MARGIN_MM;

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const sectionHeightMm = (canvas.height * CONTENT_WIDTH_MM) / canvas.width;

      // If section fits, keep it together on one page
      if (sectionHeightMm <= CONTENT_HEIGHT_MM) {
        if (currentY + sectionHeightMm > A4_HEIGHT_MM - MARGIN_MM && currentY > MARGIN_MM) {
          pdf.addPage();
          currentY = MARGIN_MM;
        }

        pdf.addImage(
          canvas.toDataURL('image/png'),
          'PNG',
          MARGIN_MM,
          currentY,
          CONTENT_WIDTH_MM,
          sectionHeightMm
        );

        currentY += sectionHeightMm + SECTION_GAP_MM;
        continue;
      }

      // Fallback for very tall sections: split only this section into slices
      const pxPerMm = canvas.width / CONTENT_WIDTH_MM;
      const maxSlicePx = Math.floor(CONTENT_HEIGHT_MM * pxPerMm);
      let offsetPx = 0;

      while (offsetPx < canvas.height) {
        if (currentY > MARGIN_MM + 0.1) {
          pdf.addPage();
          currentY = MARGIN_MM;
        }

        const sliceHeightPx = Math.min(maxSlicePx, canvas.height - offsetPx);
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceHeightPx;

        const ctx = sliceCanvas.getContext('2d');
        if (!ctx) throw new Error('Failed to create canvas context for PDF slice');

        ctx.drawImage(
          canvas,
          0,
          offsetPx,
          canvas.width,
          sliceHeightPx,
          0,
          0,
          canvas.width,
          sliceHeightPx
        );

        const sliceHeightMm = sliceHeightPx / pxPerMm;
        pdf.addImage(
          sliceCanvas.toDataURL('image/png'),
          'PNG',
          MARGIN_MM,
          currentY,
          CONTENT_WIDTH_MM,
          sliceHeightMm
        );

        offsetPx += sliceHeightPx;
      }

      currentY = MARGIN_MM + SECTION_GAP_MM;
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
                <DialogDescription asChild>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    Preview using template:{' '}
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      {template.name}
                    </Badge>
                  </div>
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
