import { useEffect, useCallback, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';

import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Image from '@tiptap/extension-image';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  List, 
  ListOrdered, 
  Heading1, 
  Heading2,
  Undo,
  Redo,
  Quote,
  Minus,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Table as TableIcon,
  ImageIcon,
  TableCellsMerge,
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
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
  { label: 'Name', value: '{{name}}' },
  { label: 'Designation', value: '{{designation}}' },
  { label: 'Email Address', value: '{{emailAddress}}' },
  { label: 'Phone Number', value: '{{phoneNumber}}' },
  { label: 'Company Name', value: '{{companyName}}' },
  { label: 'Company Address', value: '{{companyAddress}}' },
  { label: 'Project Name', value: '{{projectName}}' },
  { label: 'Project Website', value: '{{projectWebsite}}' },
  { label: 'Start Date', value: '{{startDate}}' },
  { label: 'End Date', value: '{{endDate}}' },
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
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: true,
        allowBase64: true,
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

  const fileInputRef = useRef<HTMLInputElement>(null);

  const addImageFromUrl = useCallback(() => {
    const url = window.prompt('Enter image URL:');
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  }, [editor]);

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && editor) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        editor.chain().focus().setImage({ src: base64 }).run();
      };
      reader.readAsDataURL(file);
    }
    // Reset input so the same file can be uploaded again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [editor]);

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
        {/* Text formatting */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('bold') && 'bg-accent')}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('italic') && 'bg-accent')}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('underline') && 'bg-accent')}
          title="Underline"
        >
          <UnderlineIcon className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        {/* Headings */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 1 }) && 'bg-accent')}
          title="Heading 1"
        >
          <Heading1 className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={cn('h-8 w-8 p-0', editor.isActive('heading', { level: 2 }) && 'bg-accent')}
          title="Heading 2"
        >
          <Heading2 className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        {/* Text alignment */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
          className={cn('h-8 w-8 p-0', editor.isActive({ textAlign: 'left' }) && 'bg-accent')}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
          className={cn('h-8 w-8 p-0', editor.isActive({ textAlign: 'center' }) && 'bg-accent')}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
          className={cn('h-8 w-8 p-0', editor.isActive({ textAlign: 'right' }) && 'bg-accent')}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        {/* Lists */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('bulletList') && 'bg-accent')}
          title="Bullet List"
        >
          <List className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('orderedList') && 'bg-accent')}
          title="Numbered List"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={cn('h-8 w-8 p-0', editor.isActive('blockquote') && 'bg-accent')}
          title="Quote"
        >
          <Quote className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="h-8 w-8 p-0"
          title="Horizontal Rule"
        >
          <Minus className="h-4 w-4" />
        </Button>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        {/* Table dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn('h-8 w-8 p-0', editor.isActive('table') && 'bg-accent')}
              title="Table"
            >
              <TableIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Insert Table (3x3)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().insertTable({ rows: 5, cols: 4, withHeaderRow: true }).run()}
            >
              <TableIcon className="mr-2 h-4 w-4" />
              Insert Table (5x4)
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().addColumnAfter().run()}
              disabled={!editor.can().addColumnAfter()}
            >
              Add Column After
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().addRowAfter().run()}
              disabled={!editor.can().addRowAfter()}
            >
              Add Row After
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().deleteColumn().run()}
              disabled={!editor.can().deleteColumn()}
            >
              Delete Column
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().deleteRow().run()}
              disabled={!editor.can().deleteRow()}
            >
              Delete Row
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().mergeCells().run()}
              disabled={!editor.can().mergeCells()}
            >
              <TableCellsMerge className="mr-2 h-4 w-4" />
              Merge Cells
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().splitCell().run()}
              disabled={!editor.can().splitCell()}
            >
              Split Cell
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => editor.chain().focus().deleteTable().run()}
              disabled={!editor.can().deleteTable()}
              className="text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Table
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        {/* Image dropdown */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              title="Insert Image"
            >
              <ImageIcon className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
              Upload Image
            </DropdownMenuItem>
            <DropdownMenuItem onClick={addImageFromUrl}>
              Insert from URL
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        
        <Separator orientation="vertical" className="mx-1 h-6" />
        
        {/* Undo/Redo */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="h-8 w-8 p-0"
          title="Undo"
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
          title="Redo"
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
          className="h-full [&_.ProseMirror]:min-h-full [&_.ProseMirror]:p-6 [&_.ProseMirror]:focus:outline-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-muted-foreground [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_table]:border-collapse [&_.ProseMirror_table]:w-full [&_.ProseMirror_table]:my-4 [&_.ProseMirror_td]:border [&_.ProseMirror_td]:border-border [&_.ProseMirror_td]:p-2 [&_.ProseMirror_td]:min-w-[100px] [&_.ProseMirror_th]:border [&_.ProseMirror_th]:border-border [&_.ProseMirror_th]:p-2 [&_.ProseMirror_th]:bg-muted [&_.ProseMirror_th]:font-semibold [&_.ProseMirror_img]:max-w-full [&_.ProseMirror_img]:h-auto [&_.ProseMirror_img]:rounded-md" 
        />
      </div>
    </div>
  );
}
