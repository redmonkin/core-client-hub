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
