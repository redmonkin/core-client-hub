import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Plus, Pencil, Trash2, Star, StarOff, Mail, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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

interface ClientContact {
  id: string;
  client_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  is_primary: boolean;
  created_at: string;
}

interface ContactFormData {
  name: string;
  email: string;
  phone: string;
  designation: string;
  is_primary: boolean;
}

const emptyForm: ContactFormData = {
  name: '',
  email: '',
  phone: '',
  designation: '',
  is_primary: false,
};

export function ClientContacts({ clientId }: { clientId: string }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<ClientContact | null>(null);
  const [deleteContact, setDeleteContact] = useState<ClientContact | null>(null);
  const [form, setForm] = useState<ContactFormData>(emptyForm);

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('client_contacts')
        .select('*')
        .eq('client_id', clientId)
        .order('is_primary', { ascending: false })
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as ClientContact[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (data: ContactFormData) => {
      if (editingContact) {
        // If setting as primary, unset others first
        if (data.is_primary) {
          await supabase
            .from('client_contacts')
            .update({ is_primary: false })
            .eq('client_id', clientId);
        }

        const { error } = await supabase
          .from('client_contacts')
          .update({
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            designation: data.designation || null,
            is_primary: data.is_primary,
          })
          .eq('id', editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('client_contacts')
          .insert({
            client_id: clientId,
            user_id: user!.id,
            name: data.name,
            email: data.email || null,
            phone: data.phone || null,
            designation: data.designation || null,
            is_primary: data.is_primary,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast.success(editingContact ? 'Contact updated' : 'Contact added');
      closeForm();
    },
    onError: (error: any) => {
      toast.error('Failed to save contact: ' + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_contacts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-contacts', clientId] });
      toast.success('Contact deleted');
      setDeleteContact(null);
    },
    onError: (error: any) => {
      toast.error('Failed to delete contact: ' + error.message);
    },
  });

  const closeForm = () => {
    setIsFormOpen(false);
    setEditingContact(null);
    setForm(emptyForm);
  };

  const openEdit = (contact: ClientContact) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      email: contact.email || '',
      phone: contact.phone || '',
      designation: contact.designation || '',
      is_primary: contact.is_primary,
    });
    setIsFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    saveMutation.mutate(form);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {contacts.length} contact{contacts.length !== 1 ? 's' : ''}
        </p>
        <Button size="sm" onClick={() => { setForm(emptyForm); setEditingContact(null); setIsFormOpen(true); }}>
          <Plus className="mr-1.5 h-3.5 w-3.5" />
          Add Contact
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : contacts.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No additional contacts yet</p>
      ) : (
        contacts.map((contact) => (
          <Card key={contact.id} className="transition-all hover:border-primary/20 hover:shadow-sm">
            <CardContent className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-foreground truncate">{contact.name}</p>
                  {contact.is_primary && (
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                      <Star className="mr-0.5 h-2.5 w-2.5" /> Primary
                    </Badge>
                  )}
                </div>
                {contact.designation && (
                  <p className="text-xs text-muted-foreground">{contact.designation}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  {contact.email && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${contact.email}`} className="text-primary hover:underline">{contact.email}</a>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${contact.phone}`} className="text-primary hover:underline">{contact.phone}</a>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(contact)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteContact(contact)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isFormOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? 'Edit Contact' : 'Add Contact'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Name *</Label>
              <Input id="contact-name" value={form.name} onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))} placeholder="Contact name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email</Label>
              <Input id="contact-email" type="email" value={form.email} onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="contact-phone">Phone</Label>
                <Input id="contact-phone" value={form.phone} onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))} placeholder="+91 98765 43210" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contact-designation">Designation</Label>
                <Input id="contact-designation" value={form.designation} onChange={(e) => setForm(prev => ({ ...prev, designation: e.target.value }))} placeholder="e.g. CTO" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.is_primary ? 'default' : 'outline'}
                size="sm"
                onClick={() => setForm(prev => ({ ...prev, is_primary: !prev.is_primary }))}
              >
                {form.is_primary ? <Star className="mr-1.5 h-3.5 w-3.5" /> : <StarOff className="mr-1.5 h-3.5 w-3.5" />}
                {form.is_primary ? 'Primary Contact' : 'Set as Primary'}
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeForm}>Cancel</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? 'Saving...' : editingContact ? 'Update' : 'Add Contact'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteContact} onOpenChange={(open) => { if (!open) setDeleteContact(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Contact</AlertDialogTitle>
            <AlertDialogDescription>
              Remove "{deleteContact?.name}" from this client's contacts?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteContact && deleteMutation.mutate(deleteContact.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
