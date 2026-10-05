import { useState } from "react";
import { Download, FileJson, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceUser } from "@/hooks/useWorkspaceUser";
import { collectWorkspaceData, downloadExcel, downloadJson } from "@/lib/workspace-export";

/** Owner-only download of every record in the workspace (Excel or JSON). */
export function DataExport() {
  const { workspaceUserId, isTeamMember, role } = useWorkspaceUser();
  const [busy, setBusy] = useState<"xlsx" | "json" | null>(null);
  const [progress, setProgress] = useState(0);

  if (isTeamMember || role !== "owner" || !workspaceUserId) return null;

  const run = async (format: "xlsx" | "json") => {
    setBusy(format);
    setProgress(0);
    try {
      const data = await collectWorkspaceData(workspaceUserId, (done, total) => setProgress(Math.round((done / total) * 100)));
      if (format === "xlsx") await downloadExcel(data);
      else downloadJson(data);
      const count = Object.values(data.tables).reduce((sum, rows) => sum + rows.length, 0);
      toast({ title: "Export ready", description: `${count.toLocaleString("en-IN")} records downloaded.` });
    } catch (error) {
      console.error("Export failed:", error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-primary" />
          <CardTitle>Export your data</CardTitle>
        </div>
        <CardDescription>
          Download every record in this workspace: clients, projects, proposals, contracts, invoices, payments,
          expenses, timesheets, templates and settings. Use Excel to browse it, or JSON to move it into another tool.
          Uploaded files (logos, attachments) aren't included.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button onClick={() => run("xlsx")} disabled={busy !== null} className="gap-2">
          {busy === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
          Download Excel (.xlsx)
        </Button>
        <Button variant="outline" onClick={() => run("json")} disabled={busy !== null} className="gap-2">
          {busy === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
          Download JSON
        </Button>
        {busy && (
          <span className="text-sm text-muted-foreground" role="status">
            Collecting records… {progress}%
          </span>
        )}
      </CardContent>
    </Card>
  );
}
