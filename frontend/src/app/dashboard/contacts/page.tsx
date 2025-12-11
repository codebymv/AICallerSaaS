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
  Edit,
  Trash2,
  Loader2,
  User,
  FileText,
  RefreshCw
} from 'lucide-react';
import { ContactModal } from '@/components/ContactModal';
import { DeleteButton } from '@/components/DeleteButton';
import { EmptyState } from '@/components/EmptyState';

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
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [searchDebounce, setSearchDebounce] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearchDebounce(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchContacts = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
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
      setRefreshing(false);
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
    try {
      await api.deleteContact(id);
      toast({
        title: 'Contact deleted',
        description: 'The contact has been removed',
      });
      fetchContacts();
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete contact',
        variant: 'destructive',
      });
      throw error; // Re-throw to keep modal open on error
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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 sm:h-8 sm:w-8 text-slate-600" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-600">Contacts</h1>
            <p className="hidden sm:block text-muted-foreground text-sm">Manage your contact directory</p>
          </div>
        </div>
        {/* Mobile: icon-only buttons */}
        <div className="flex gap-2 sm:hidden">
          <Button
            onClick={() => fetchContacts(true)}
            disabled={refreshing}
            variant="outline"
            size="icon"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
          <Button size="icon" onClick={handleCreate} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {/* Desktop: full buttons */}
        <div className="hidden sm:flex gap-2">
          <Button
            onClick={() => fetchContacts(true)}
            disabled={refreshing}
            variant="outline"
            className="text-teal-600 border-teal-600 hover:bg-teal-50"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleCreate} className="bg-gradient-to-b from-[#0fa693] to-teal-600 hover:from-[#0e9585] hover:to-teal-700">
            <Plus className="h-4 w-4 mr-2" />
            New Contact
          </Button>
        </div>
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
          <CardContent>
            <EmptyState
              icon={Users}
              title={search ? 'No contacts found' : 'No contacts yet'}
              description={search
                ? 'Try adjusting your search terms'
                : 'Add contacts to see them here and throughout call logs'}
              action={!search ? {
                label: 'Add Your First Contact',
                onClick: handleCreate,
              } : undefined}
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <Card key={contact.id} className="hover:bg-slate-50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <User className="h-6 w-6 text-teal-600" />
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
                      className="text-teal-600 hover:text-teal-700"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <DeleteButton
                      onDelete={() => handleDelete(contact.id)}
                      itemName={contact.name}
                      title="Delete Contact"
                    />
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
