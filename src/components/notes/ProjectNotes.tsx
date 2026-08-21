import { useState, useEffect } from 'react';
import { Plus, Trash2, Loader2, Paperclip, FileIcon, Download, StickyNote, X } from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
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

interface NoteAttachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string | null;
}

interface ProjectNote {
  id: string;
  content: string;
  created_at: string;
  file_url: string | null;
  file_name: string | null;
  file_type: string | null;
  attachments: NoteAttachment[];
}

// Every attachment shown for a note: its own rows, plus (for notes created
// before attachments moved to their own table) the legacy single file_url.
const attachmentsForNote = (note: ProjectNote): NoteAttachment[] => {
  if (note.attachments && note.attachments.length > 0) return note.attachments;
  if (note.file_url) {
    return [{ id: note.id, file_url: note.file_url, file_name: note.file_name || 'attachment', file_type: note.file_type }];
  }
  return [];
};

export function ProjectNotes({ projectId }: ProjectNotesProps) {
  const { user } = useAuth();
  const { workspaceUserId } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ['project-notes', projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_notes')
        .select('*, attachments:project_note_attachments(*)')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProjectNote[];
    },
  });

  const addSelectedFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    // Snapshot into a plain array now — `files` is a live FileList tied to the
    // input element, and the caller resets input.value right after this call,
    // which would empty it out from under a lazy setState updater.
    const newFiles = Array.from(files);
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!content.trim() && selectedFiles.length === 0) {
      toast.error('Please add a note or attach a file');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: note, error } = await supabase
        .from('project_notes')
        .insert({
          project_id: projectId,
          user_id: workspaceUserId,
          content: content.trim() || (selectedFiles.length > 0 ? `Attached: ${selectedFiles.map((f) => f.name).join(', ')}` : ''),
        })
        .select('id')
        .single();
      if (error) throw error;

      if (selectedFiles.length > 0) {
        const uploads = await Promise.all(selectedFiles.map(async (file) => {
          const ext = file.name.split('.').pop();
          // Path must start with the workspace owner's user id to satisfy RLS folder check
          const path = `${workspaceUserId}/${projectId}/${crypto.randomUUID()}.${ext}`;
          const { error: uploadError } = await supabase.storage
            .from('project-attachments')
            .upload(path, file);
          if (uploadError) throw uploadError;
          return { note_id: note.id, file_url: path, file_name: file.name, file_type: file.type };
        }));

        const { error: attachError } = await supabase.from('project_note_attachments').insert(uploads);
        if (attachError) throw attachError;
      }

      queryClient.invalidateQueries({ queryKey: ['project-notes', projectId] });
      setContent('');
      setSelectedFiles([]);
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

  // Generate signed URLs for file attachments
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const paths = notes
      .flatMap(attachmentsForNote)
      .filter(a => a.file_url && !a.file_url.startsWith('http'))
      .map(a => a.file_url);
    if (paths.length === 0) return;
    supabase.storage
      .from('project-attachments')
      .createSignedUrls(paths, 3600)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach(item => {
          if (item.signedUrl) map[item.path] = item.signedUrl;
        });
        setSignedUrls(map);
      });
  }, [notes]);

  const getFileUrl = (fileUrl: string) => {
    // Legacy entries store full public URLs; new entries store paths
    if (fileUrl.startsWith('http')) return fileUrl;
    return signedUrls[fileUrl] || '';
  };

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
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" type="button" asChild>
                <label className="cursor-pointer">
                  <Paperclip className="mr-2 h-4 w-4" />
                  Attach Files
                  <input
                    type="file"
                    multiple
                    className="sr-only"
                    onChange={e => {
                      addSelectedFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
              </Button>
              {selectedFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center gap-1.5 rounded-md bg-muted px-2.5 py-1 text-xs text-foreground">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button
                    onClick={() => removeSelectedFile(index)}
                    className="ml-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
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

                    {/* File Attachments */}
                    {attachmentsForNote(note).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {attachmentsForNote(note).map((attachment) => {
                          const url = getFileUrl(attachment.file_url);
                          if (!url) return null;
                          return isImage(attachment.file_type) ? (
                            <a key={attachment.id} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              <img
                                src={url}
                                alt={attachment.file_name}
                                className="h-32 max-w-[220px] rounded-lg border border-border object-cover hover:opacity-90 transition-opacity"
                              />
                            </a>
                          ) : (
                            <a
                              key={attachment.id}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                              {getFileIcon(attachment.file_type)}
                              <span className="max-w-[200px] truncate">{attachment.file_name}</span>
                              <Download className="h-3.5 w-3.5 text-muted-foreground" />
                            </a>
                          );
                        })}
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
