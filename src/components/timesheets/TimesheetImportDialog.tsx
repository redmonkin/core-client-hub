import { useState, useRef } from 'react';
import { Upload, Download, Loader2, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ScrollArea } from '@/components/ui/scroll-area';

const REQUIRED_FIELDS = ['task', 'owner', 'duration'] as const;
const OPTIONAL_FIELDS = ['date', 'notes'] as const;
const ALL_FIELDS = [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS] as const;

type FieldName = typeof ALL_FIELDS[number];

const FIELD_LABELS: Record<FieldName, string> = {
  task: 'Task *',
  owner: 'Owner *',
  duration: 'Duration (hrs) *',
  date: 'Date',
  notes: 'Notes',
};

interface ParsedRow {
  task: string;
  owner: string;
  duration: string;
  date: string;
  notes: string;
}

interface FailedRow {
  rowNumber: number;
  data: Record<string, any>;
  reason: string;
}

type Step = 'upload' | 'mapping' | 'results';

interface TimesheetImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (entries: ParsedRow[]) => Promise<void>;
}

function autoDetectMapping(headers: string[]): Record<string, FieldName | ''> {
  const mapping: Record<string, FieldName | ''> = {};
  const aliases: Record<FieldName, string[]> = {
    task: ['task', 'task name', 'taskname', 'description', 'activity'],
    owner: ['owner', 'assignee', 'assigned to', 'name', 'member', 'resource'],
    duration: ['duration', 'hours', 'time', 'hrs', 'total hours'],
    date: ['date', 'day', 'entry date', 'work date'],
    notes: ['notes', 'note', 'remarks', 'comment', 'comments'],
  };

  const usedFields = new Set<FieldName>();

  headers.forEach(header => {
    const lower = header.toLowerCase().trim();
    for (const [field, names] of Object.entries(aliases) as [FieldName, string[]][]) {
      if (!usedFields.has(field) && names.includes(lower)) {
        mapping[header] = field;
        usedFields.add(field);
        return;
      }
    }
    mapping[header] = '';
  });

  return mapping;
}

function downloadTemplate() {
  const csvContent = 'Task,Owner,Duration,Date,Notes\nHomepage Design,John Doe,2.5,2026-04-16,Initial wireframes\nAPI Integration,Jane Smith,4,2026-04-16,REST endpoints';
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'timesheet-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export function TimesheetImportDialog({ open, onOpenChange, onImport }: TimesheetImportDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>('upload');
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldName | ''>>({});
  const [failedRows, setFailedRows] = useState<FailedRow[]>([]);
  const [successCount, setSuccessCount] = useState(0);

  const reset = () => {
    setStep('upload');
    setFileName('');
    setHeaders([]);
    setRawRows([]);
    setMapping({});
    setFailedRows([]);
    setSuccessCount(0);
    setIsProcessing(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = (open: boolean) => {
    if (!open) reset();
    onOpenChange(open);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const XLSX = await import('xlsx');
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

      if (rows.length === 0) {
        toast.error('No data found in file');
        return;
      }

      const fileHeaders = Object.keys(rows[0]);
      setFileName(file.name);
      setHeaders(fileHeaders);
      setRawRows(rows);
      setMapping(autoDetectMapping(fileHeaders));
      setStep('mapping');
    } catch (error: any) {
      toast.error('Failed to parse file: ' + error.message);
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    // Validate required fields are mapped
    const mappedFields = new Set(Object.values(mapping).filter(Boolean));
    for (const field of REQUIRED_FIELDS) {
      if (!mappedFields.has(field)) {
        toast.error(`Please map a column to "${FIELD_LABELS[field]}"`);
        return;
      }
    }

    setIsProcessing(true);
    const reverseMap: Partial<Record<FieldName, string>> = {};
    for (const [header, field] of Object.entries(mapping)) {
      if (field) reverseMap[field] = header;
    }

    const validEntries: ParsedRow[] = [];
    const failed: FailedRow[] = [];

    rawRows.forEach((row, idx) => {
      const task = reverseMap.task ? String(row[reverseMap.task] ?? '').trim() : '';
      const owner = reverseMap.owner ? String(row[reverseMap.owner] ?? '').trim() : '';
      const durationRaw = reverseMap.duration ? String(row[reverseMap.duration] ?? '').trim() : '';
      const dateRaw = reverseMap.date ? String(row[reverseMap.date] ?? '').trim() : '';
      const notes = reverseMap.notes ? String(row[reverseMap.notes] ?? '').trim() : '';

      const reasons: string[] = [];
      if (!task) reasons.push('Missing task');
      if (!owner) reasons.push('Missing owner');

      const duration = parseFloat(durationRaw);
      if (isNaN(duration) || duration <= 0) reasons.push('Invalid duration');

      if (reasons.length > 0) {
        failed.push({ rowNumber: idx + 2, data: row, reason: reasons.join(', ') });
        return;
      }

      // Parse date
      let date = new Date().toISOString().split('T')[0];
      if (dateRaw) {
        const num = Number(dateRaw);
        if (!isNaN(num) && num > 30000) {
          const d = new Date((num - 25569) * 86400 * 1000);
          date = d.toISOString().split('T')[0];
        } else {
          const parsed = new Date(dateRaw);
          if (!isNaN(parsed.getTime())) {
            date = parsed.toISOString().split('T')[0];
          }
        }
      }

      validEntries.push({ task, owner, duration: String(duration), date, notes });
    });

    if (validEntries.length === 0) {
      setFailedRows(failed);
      setSuccessCount(0);
      setStep('results');
      setIsProcessing(false);
      return;
    }

    try {
      await onImport(validEntries);
      setSuccessCount(validEntries.length);
      setFailedRows(failed);
      setStep('results');
    } catch (error: any) {
      toast.error('Import failed: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const getMappedFieldsForHeader = (currentHeader: string) => {
    const usedFields = new Set(
      Object.entries(mapping)
        .filter(([h, f]) => h !== currentHeader && f)
        .map(([, f]) => f)
    );
    return ALL_FIELDS.filter(f => !usedFields.has(f));
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'upload' && 'Import Timesheet'}
            {step === 'mapping' && 'Map Columns'}
            {step === 'results' && 'Import Results'}
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a CSV or Excel file to import timesheet entries.'}
            {step === 'mapping' && `Map your file columns to timesheet fields. File: ${fileName}`}
            {step === 'results' && 'Review the import results below.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'upload' && (
          <div className="space-y-6 py-2">
            {/* Template download */}
            <div className="rounded-lg border border-dashed border-border p-4 text-center space-y-3">
              <p className="text-sm text-muted-foreground">
                Download the template to see the expected format
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Download Template
              </Button>
            </div>

            {/* File upload */}
            <div className="space-y-2">
              <Label>Select File</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileSelect}
              />
              <Button
                variant="outline"
                className="w-full h-20 border-dashed"
                onClick={() => fileInputRef.current?.click()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-5 w-5" />
                )}
                {isProcessing ? 'Reading file...' : 'Click to upload CSV or Excel'}
              </Button>
            </div>
          </div>
        )}

        {step === 'mapping' && (
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              {rawRows.length} rows found. Map each file column to a timesheet field.
            </p>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-3">
                {headers.map(header => (
                  <div key={header} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        e.g. {String(rawRows[0]?.[header] ?? '—')}
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    <Select
                      value={mapping[header] || '_skip'}
                      onValueChange={val =>
                        setMapping(prev => ({ ...prev, [header]: val === '_skip' ? '' : val as FieldName }))
                      }
                    >
                      <SelectTrigger className="w-[160px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_skip">Skip column</SelectItem>
                        {getMappedFieldsForHeader(header).map(field => (
                          <SelectItem key={field} value={field}>
                            {FIELD_LABELS[field]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={handleImport} disabled={isProcessing}>
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {rawRows.length} Rows
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === 'results' && (
          <div className="space-y-4 py-2">
            {successCount > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-green-500/10 p-3 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <p className="text-sm font-medium">{successCount} entries imported successfully</p>
              </div>
            )}

            {failedRows.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-5 w-5 shrink-0" />
                  <p className="text-sm font-medium">{failedRows.length} rows failed</p>
                </div>
                <ScrollArea className="max-h-[250px]">
                  <div className="rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/40 hover:bg-muted/40">
                          <TableHead className="font-semibold w-16">Row</TableHead>
                          <TableHead className="font-semibold">Data</TableHead>
                          <TableHead className="font-semibold">Reason</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {failedRows.map((row, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-mono text-xs">{row.rowNumber}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">
                              {Object.values(row.data).join(', ')}
                            </TableCell>
                            <TableCell className="text-xs text-destructive">{row.reason}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </div>
            )}

            {successCount === 0 && failedRows.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No rows were processed.</p>
            )}

            <DialogFooter>
              <Button onClick={() => handleClose(false)}>Done</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
