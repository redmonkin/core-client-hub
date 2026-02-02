import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1, 
  Heading2,
  Undo,
  Redo,
  Quote,
  Minus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { TemplateType } from '@/hooks/useTemplates';

interface PlaceholderItem {
  label: string;
  value: string;
}

const PROPOSAL_PLACEHOLDERS: PlaceholderItem[] = [
  { label: 'Client Name', value: '{{clientName}}' },
  { label: 'Project Name', value: '{{projectName}}' },
  { label: 'Proposed Date', value: '{{proposedDate}}' },
  { label: 'Proposal Expiry Date', value: '{{proposalExpiryDate}}' },
  { label: 'Scope of Work', value: '{{scopeOfWork}}' },
  { label: 'Duration', value: '{{duration}}' },
  { label: 'Costing', value: '{{costing}}' },
];

const CONTRACT_PLACEHOLDERS: PlaceholderItem[] = [
  { label: 'Client Name', value: '{{clientName}}' },
  { label: 'Client Address', value: '{{clientAddress}}' },
  { label: 'Contact Person', value: '{{contactPerson}}' },
  { label: 'Title', value: '{{title}}' },
  { label: 'Email', value: '{{email}}' },
  { label: 'Phone', value: '{{phone}}' },
  { label: 'Effective From', value: '{{effectiveFrom}}' },
  { label: 'Effective For', value: '{{effectiveFor}}' },
];

const PLACEHOLDERS_BY_TYPE: Record<TemplateType, PlaceholderItem[]> = {
  proposal: PROPOSAL_PLACEHOLDERS,
  contract: CONTRACT_PLACEHOLDERS,
};

interface TemplateEditorProps {
  content?: string;
  onChange?: (content: string) => void;
  placeholder?: string;
  templateType?: TemplateType;
}

// Convert markdown to simple HTML for the editor
function markdownToHtml(markdown: string): string {
  if (!markdown) return '';
  
  // If it already looks like HTML, return as-is
  if (markdown.startsWith('<')) return markdown;
  
  return markdown
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive li tags in ul
    .replace(/(<li>.*<\/li>\n?)+/g, (match) => `<ul>${match}</ul>`)
    // Paragraphs for remaining lines
    .split('\n')
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return '<p></p>';
      if (trimmed.startsWith('<')) return trimmed;
      return `<p>${trimmed}</p>`;
    })
    .join('');
}

export function TemplateEditor({ 
  content = '', 
  onChange, 
  placeholder = 'Start writing your template...',
  templateType
}: TemplateEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: markdownToHtml(content),
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[300px] p-4',
      },
    },
  });

  // Update editor content when prop changes (for edit mode)
  useEffect(() => {
    if (editor && content) {
      const htmlContent = markdownToHtml(content);
      // Only update if content is different to avoid cursor jumping
      if (editor.getHTML() !== htmlContent) {
        editor.commands.setContent(htmlContent);
      }
    }
  }, [editor, content]);

  if (!editor) {
    return null;
  }

  const insertPlaceholder = (placeholderValue: string) => {
    editor.chain().focus().insertContent(placeholderValue).run();
  };

  // Get placeholders based on template type, or show all if type not selected
  const availablePlaceholders = templateType 
    ? PLACEHOLDERS_BY_TYPE[templateType] 
    : [...PROPOSAL_PLACEHOLDERS, ...CONTRACT_PLACEHOLDERS];

  return (
    <div className="flex flex-col h-full rounded-lg border border-input bg-background overflow-hidden">
      {/* Toolbar */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-1 p-2 border-b border-border bg-muted/30">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('bold') && 'bg-accent')}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('italic') && 'bg-accent')}
        >
          <Italic className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 1 }) && 'bg-accent')}
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 2 }) && 'bg-accent')}
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('bulletList') && 'bg-accent')}
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('orderedList') && 'bg-accent')}
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('blockquote') && 'bg-accent')}
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0"
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
        >
          <Undo className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="h-8 w-8 p-0"
        >
          <Redo className="h-4 w-4" />
        </Button>
        
        <div className="flex-1" />
        
        {/* Placeholder Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-8 gap-1.5">
              <span className="text-xs font-mono text-primary">{'{{ }}'}</span>
              <span className="text-xs">Insert Placeholder</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 max-h-64 overflow-y-auto">
            {!templateType && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">
                Select a template type to see relevant placeholders
              </p>
            )}
            {availablePlaceholders.map((placeholder) => (
              <DropdownMenuItem
                key={placeholder.value}
                onClick={() => insertPlaceholder(placeholder.value)}
                className="flex items-center justify-between"
              >
                <span className="text-sm">{placeholder.label}</span>
                <span className="text-xs font-mono text-muted-foreground">{placeholder.value}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      
      {/* Editor Content - fills remaining space */}
      <div className="flex-1 overflow-y-auto">
        <EditorContent 
          editor={editor} 
          className="h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-6 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0" 
        />
      </div>
    </div>
  );
}
