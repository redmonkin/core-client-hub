import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { MessageSquare, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useWorkspaceUser } from '@/hooks/useWorkspaceUser';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export interface DocumentComment {
  id: string;
  author_type: string;
  author_name: string;
  content: string;
  created_at: string;
}

interface CommentThreadProps {
  documentType: 'proposal' | 'contract' | 'invoice';
  documentId: string;
  workspaceUserId: string;
  comments: DocumentComment[];
  queryKeyToInvalidate: unknown[];
}

/** Owner/team-side comment thread — posts go through a direct authenticated insert (RLS-gated, viewer-blocked). */
export function CommentThread({ documentType, documentId, workspaceUserId, comments, queryKeyToInvalidate }: CommentThreadProps) {
  const { role } = useWorkspaceUser();
  const queryClient = useQueryClient();
  const [content, setContent] = useState('');
  const canComment = role !== 'viewer';

  const postMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('document_comments').insert({
        user_id: workspaceUserId,
        document_type: documentType,
        document_id: documentId,
        author_type: 'team',
        author_name: 'You',
        content: content.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setContent('');
      queryClient.invalidateQueries({ queryKey: queryKeyToInvalidate });
    },
    onError: (error: Error) => toast.error('Failed to post comment: ' + error.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Comments {comments.length > 0 && `(${comments.length})`}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {comment.author_name}
                    {comment.author_type === 'client' && (
                      <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Client</span>
                    )}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                  </span>
                </div>
                {/* Comments are always rendered as plain text, never HTML — no legitimate need for markup. */}
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{comment.content}</p>
              </div>
            ))}
          </div>
        )}

        {canComment && (
          <div className="flex gap-2">
            <Textarea
              placeholder="Add an internal comment..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="min-h-[60px]"
            />
            <Button
              size="icon"
              onClick={() => postMutation.mutate()}
              disabled={!content.trim() || postMutation.isPending}
              className="self-end"
            >
              {postMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
