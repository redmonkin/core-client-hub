import { useState, useRef } from 'react';
import { Plus, Trash2, Loader2, Paperclip, FileIcon, Download, StickyNote, X } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface ProjectNotesProps {
  projectId: string;
}

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notes')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleSubmit = async () => {
    if (!content.trim() && !selectedFile) {
      toast.error('Please add a note or attach a file');
      return;
    }

    setIsSubmitting(true);
    try {
      let fileUrl: string | null = null;
      let fileName: string | null = null;
      let fileType: string | null = null;

      if (selectedFile) {
        const ext = selectedFile.name.split('.').pop();
        const path = `${projectId}/${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('project-files')
          .upload(path, selectedFile);
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('project-files')
          .getPublicUrl(path);

        fileUrl = urlData.publicUrl;
        fileName = selectedFile.name;
        fileType = selectedFile.type;
      }

      const { error } = await supabase.from('project_notes').insert({
        project_id: projectId,
        user_id: user?.id,
        content: content.trim() || (fileName ? `Attached: ${fileName}` : ''),
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
      });
      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
      setContent('');
      setSelectedFile(null);
      toast.success('Note added');
    } catch (error: any) {
      toast.error('Failed to add note: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
      setDeleteId(null);
      toast.success('Note deleted');
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
    },
  });

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <FileIcon className="h-4 w-4" />;
    if (fileType.startsWith('image/')) return <FileIcon className="h-4 w-4" />;
    return <FileIcon className="h-4 w-4" />;
  };

  const isImage = (fileType: string | null) => fileType?.startsWith('image/');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Note Form */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <Textarea
            placeholder="Add a note or remark..."
            value={content}
            onChange={e => setContent(e.target.value)}
            className="min-h-[80px] resize-none"
          />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={e => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                size="sm"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="mr-2 h-4 w-4" />
                Attach File
              </Button>
              {selectedFile && (
                <div className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[150px] truncate">{selectedFile.name}</span>
                  <button
                    onClick={() => setSelectedFile(null)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Add Note
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Notes List */}
      {notes.length > 0 ? (
        <div className="space-y-3">
          {notes.map(note => (
            <Card key={note.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <p className="text-sm text-foreground whitespace-pre-wrap">{note.content}</p>

                    {/* File Attachment */}
                    {note.file_url && (
                      <div className="mt-2">
                        {isImage(note.file_type) ? (
                          <a href={note.file_url} target="_blank" rel="noopener noreferrer" className="block">
                            <img
                              src={note.file_url}
                              alt={note.file_name || 'Attachment'}
                              className="max-h-48 rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                            />
                          </a>
                        ) : (
                          <a
                            href={note.file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                          >
                            {getFileIcon(note.file_type)}
                            <span className="max-w-[200px] truncate">{note.file_name}</span>
                            <Download className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), 'MMM dd, yyyy · h:mm a')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <StickyNote className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="mt-4 text-sm font-medium text-foreground">No notes yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add notes, remarks, or attach files to this project
            </p>
          </CardContent>
        </Card>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={open => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Note</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
