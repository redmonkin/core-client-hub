import { useState } from 'react';
import DOMPurify from 'dompurify';
import { asBlob } from 'html-docx-js-typescript';
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
  /** Wording in the legend; the same dialog previews contracts. */
  documentLabel?: 'proposal' | 'contract';
}

export function ProposalPreviewDialog({
  documentLabel = 'proposal',
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
      const blob = (await asBlob(html)) as Blob;
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
        <DialogHeader className="flex-shrink-0 px-4 py-4 text-left sm:px-6 border-b">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Eye className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0">
                <DialogTitle>{proposalData.title}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1 text-sm text-muted-foreground">
                    Preview using template:{' '}
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                      {template.name}
                    </Badge>
                  </div>
                </DialogDescription>
              </div>
            </div>
            {/* Icon-only export buttons on phones so the row fits. */}
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportWord}
                disabled={isExportingDocx}
                aria-label="Export Word"
              >
                {isExportingDocx ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <FileText className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Export Word</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={isExporting}
                aria-label="Export PDF"
              >
                {isExporting ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:mr-2" />
                ) : (
                  <Download className="h-4 w-4 sm:mr-2" />
                )}
                <span className="hidden sm:inline">Export PDF</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                aria-label="Close preview"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Legend */}
        <div className="flex-shrink-0 mx-3 mt-3 rounded-lg bg-muted/50 p-3 text-sm sm:mx-6 sm:mt-4">
          <p className="text-muted-foreground">
            <span className="bg-primary/20 text-primary px-1 rounded font-medium">Highlighted text</span>
            {' '}shows actual data filled from your {documentLabel} and client details.
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto mx-3 my-3 rounded-lg border bg-card p-4 sm:mx-6 sm:my-4 sm:p-8">
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
