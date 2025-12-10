'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneNumber } from '@/lib/utils';
import { 
  Users, 
  Search, 
  Plus, 
  Phone, 
  Edit2, 
  Trash2, 
  Loader2,
  User,
  FileText
} from 'lucide-react';
import { ContactModal } from '@/components/ContactModal';

interface Contact {
  id: string;
  name: string;
  phoneNumber: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export default function ContactsPage() {
  const { toast } = useToast();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const response = await api.getContacts({ search: searchDebounce || undefined });
      setContacts(response.data || []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load contacts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContacts();
  }, [searchDebounce]);

  const handleCreate = () => {
    setEditingContact(null);
    setModalOpen(true);
  };

  const handleEdit = (contact: Contact) => {
    setEditingContact(contact);
    setModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.deleteContact(id);
      toast({
        title: 'Contact deleted',
        description: 'The contact has been removed',
      });
      setDeleteConfirm(null);
      fetchContacts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleSave = async (data: { name: string; phoneNumber: string; notes?: string }) => {
    try {
      if (editingContact) {
        await api.updateContact(editingContact.id, data);
        toast({
          title: 'Contact updated',
          description: 'Changes have been saved',
        });
      } else {
        await api.createContact(data);
        toast({
          title: 'Contact created',
          description: 'New contact has been added',
        });
      }
      setModalOpen(false);
      setEditingContact(null);
      fetchContacts();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save contact',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <Users className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Contacts</h1>
          <span className="hidden sm:inline text-slate-400">•</span>
          <p className="text-muted-foreground text-sm sm:text-base w-full sm:w-auto">
            Manage your contact directory
          </p>
        </div>
        <Button onClick={handleCreate} className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700">
          <Plus className="h-4 w-4 mr-2" />
          New Contact
        </Button>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or phone number..."
              className="pl-10"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
        </div>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-slate-600 mb-2">
              {search ? 'No contacts found' : 'No contacts yet'}
            </h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              {search 
                ? 'Try adjusting your search terms'
                : 'Add contacts to see them here and throughout call logs'}
            </p>
            {!search && (
              <Button onClick={handleCreate} className="bg-teal-600 hover:bg-teal-700">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Contact
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className="hover:bg-slate-50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-5 w-5 text-teal-600" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold text-slate-600 truncate">{contact.name}</h3>
                      <p className="text-sm text-muted-foreground font-mono">
                        {formatPhoneNumber(contact.phoneNumber)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(contact)}
                      className="h-8 w-8 text-slate-500 hover:text-teal-600"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    {deleteConfirm === contact.id ? (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(contact.id)}
                          disabled={deleting}
                          className="h-8 text-xs"
                        >
                          {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Delete'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setDeleteConfirm(null)}
                          className="h-8 text-xs"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteConfirm(contact.id)}
                        className="h-8 w-8 text-slate-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
                {contact.notes && (
                  <div className="mt-3 pt-3 border-t">
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-muted-foreground line-clamp-2">{contact.notes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Contact Modal */}
      <ContactModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingContact(null);
        }}
        onSave={handleSave}
        contact={editingContact}
      />
    </div>
  );
}
