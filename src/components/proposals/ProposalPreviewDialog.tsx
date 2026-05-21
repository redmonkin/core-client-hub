import { useState } from 'react';
import DOMPurify from 'dompurify';
// @ts-ignore - html-docx-js has no types
import htmlDocx from 'html-docx-js/dist/html-docx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, X, Download, FileText, Loader2 } from 'lucide-react';
import { Template } from '@/hooks/useTemplates';
import { ProposalData, replacePlaceholders } from '@/lib/proposal-utils';
import { exportToPdf } from '@/lib/pdf-export';
import { toast } from 'sonner';

interface ProposalPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  template: Template | null;
  proposalData: ProposalData;
}

export function ProposalPreviewDialog({
  open,
  onOpenChange,
  template,
  proposalData,
}: ProposalPreviewDialogProps) {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingDocx, setIsExportingDocx] = useState(false);

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

  const handleExportWord = async () => {
    setIsExportingDocx(true);
    const toastId = toast.loading('Generating Word document...');
    try {
      const docContent = replacePlaceholders(template.content, proposalData, false);
      const safe = DOMPurify.sanitize(docContent);
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${proposalData.title}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; font-size: 11pt; color: #1a1a1a; }
  h1,h2,h3,h4 { font-family: Calibri, Arial, sans-serif; color: #0f172a; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #cbd5e1; padding: 6px 10px; }
  th { background: #f1f5f9; text-align: left; }
</style></head><body>${safe}</body></html>`;
      const blob = htmlDocx.asBlob(html);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${proposalData.title.replace(/[^a-z0-9]/gi, '_')}_proposal.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Word document downloaded', { id: toastId });
    } catch (error: any) {
      console.error('Error generating Word doc:', error);
      toast.error('Failed to generate Word document: ' + (error?.message || 'unknown'), { id: toastId });
    } finally {
      setIsExportingDocx(false);
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
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(previewContent) }}
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
