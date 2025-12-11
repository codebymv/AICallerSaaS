'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ASSET_CATEGORIES, AssetCategory } from '@/lib/constants';
import { Plus, Trash2, Image as ImageIcon, FileText, Video, File, ExternalLink, X, Loader2 } from 'lucide-react';

// Asset type from API
export interface Asset {
  id: string;
  name: string;
  description: string | null;
  category: AssetCategory;
  url: string;
  mimeType: string | null;
  fileSize: number | null;
  agentId: string | null;
  agent: { id: string; name: string } | null;
  createdAt: string;
}

interface AssetManagerProps {
  // Optional: filter to specific categories
  allowedCategories?: AssetCategory[];
  // Optional: associate assets with a specific agent
  agentId?: string;
  // Optional: callback when an asset is selected
  onAssetSelect?: (asset: Asset) => void;
  // Mode: 'manage' for full CRUD, 'select' for picking assets
  mode?: 'manage' | 'select';
  // Optional: pre-selected asset IDs (for select mode)
  selectedAssetIds?: string[];
  // Optional: callback when selection changes
  onSelectionChange?: (assetIds: string[]) => void;
}

const getCategoryIcon = (category: AssetCategory) => {
  switch (category) {
    case 'IMAGE':
      return <ImageIcon className="h-4 w-4" />;
    case 'DOCUMENT':
      return <FileText className="h-4 w-4" />;
    case 'VIDEO':
      return <Video className="h-4 w-4" />;
    default:
      return <File className="h-4 w-4" />;
  }
};

export function AssetManager({
  allowedCategories,
  agentId,
  onAssetSelect,
  mode = 'manage',
  selectedAssetIds = [],
  onSelectionChange,
}: AssetManagerProps) {
  const { toast } = useToast();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>(selectedAssetIds);
  
  // Form state for adding new asset
  const [newAsset, setNewAsset] = useState({
    name: '',
    description: '',
    category: 'OTHER' as AssetCategory,
    url: '',
  });

  // Fetch assets
  useEffect(() => {
    fetchAssets();
  }, [allowedCategories, agentId]);

  const fetchAssets = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (agentId) params.agentId = agentId;
      // Note: API currently doesn't support multiple category filter, 
      // we'll filter client-side if needed
      
      const response = await api.getAssets(params);
      let fetchedAssets = (response.data || response) as Asset[];
      
      // Client-side filter by allowed categories if specified
      if (allowedCategories && allowedCategories.length > 0) {
        fetchedAssets = fetchedAssets.filter(a => allowedCategories.includes(a.category));
      }
      
      setAssets(fetchedAssets);
    } catch (error) {
      console.error('Failed to fetch assets:', error);
      toast({
        title: 'Error',
        description: 'Failed to load assets',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsset = async () => {
    if (!newAsset.name.trim() || !newAsset.url.trim()) {
      toast({
        title: 'Validation Error',
        description: 'Name and URL are required',
        variant: 'destructive',
      });
      return;
    }

    // Basic URL validation
    try {
      new URL(newAsset.url);
    } catch {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid URL',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await api.createAsset({
        name: newAsset.name.trim(),
        description: newAsset.description.trim() || undefined,
        category: newAsset.category,
        url: newAsset.url.trim(),
        agentId: agentId || undefined,
      });
      
      const created = (response.data || response) as Asset;
      setAssets(prev => [created, ...prev]);
      setNewAsset({ name: '', description: '', category: 'OTHER', url: '' });
      setShowAddForm(false);
      
      toast({
        title: 'Asset Added',
        description: `${newAsset.name} has been added`,
      });
    } catch (error) {
      console.error('Failed to create asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to create asset',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;
    
    try {
      await api.deleteAsset(assetId);
      setAssets(prev => prev.filter(a => a.id !== assetId));
      // Also remove from selection if selected
      setSelectedIds(prev => prev.filter(id => id !== assetId));
      
      toast({
        title: 'Asset Deleted',
        description: 'The asset has been removed',
      });
    } catch (error) {
      console.error('Failed to delete asset:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete asset',
        variant: 'destructive',
      });
    }
  };

  const handleSelect = (asset: Asset) => {
    if (mode === 'select') {
      const newSelectedIds = selectedIds.includes(asset.id)
        ? selectedIds.filter(id => id !== asset.id)
        : [...selectedIds, asset.id];
      
      setSelectedIds(newSelectedIds);
      onSelectionChange?.(newSelectedIds);
    }
    onAssetSelect?.(asset);
  };

  // Available categories for the dropdown
  const availableCategories = allowedCategories || (['IMAGE', 'DOCUMENT', 'VIDEO', 'OTHER'] as AssetCategory[]);

  return (
    <div className="space-y-4">
      {/* Header with Add button */}
      {mode === 'manage' && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-slate-700">Media Assets</h3>
            <p className="text-xs text-muted-foreground">
              Pre-upload files your agent can send in messages
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowAddForm(true)}
            className="text-teal-600 border-teal-200 hover:bg-teal-50"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Asset
          </Button>
        </div>
      )}

      {/* Add Asset Form */}
      {showAddForm && (
        <Card className="border-teal-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">Add New Asset</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              Enter a publicly accessible URL. For S3/cloud storage, ensure the URL is public.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="asset-name" className="text-xs text-muted-foreground">Name *</label>
                <Input
                  id="asset-name"
                  placeholder="e.g., Product Brochure"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, name: e.target.value }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="asset-category" className="text-xs text-muted-foreground">Category</label>
                <select
                  id="asset-category"
                  value={newAsset.category}
                  onChange={(e) => setNewAsset(prev => ({ ...prev, category: e.target.value as AssetCategory }))}
                  className="flex h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {availableCategories.map(cat => (
                    <option key={cat} value={cat}>
                      {ASSET_CATEGORIES[cat].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="asset-url" className="text-xs text-muted-foreground">URL *</label>
              <Input
                id="asset-url"
                type="url"
                placeholder="https://example.com/file.pdf"
                value={newAsset.url}
                onChange={(e) => setNewAsset(prev => ({ ...prev, url: e.target.value }))}
                className="h-8 text-sm"
              />
            </div>
            
            <div className="space-y-1.5">
              <label htmlFor="asset-description" className="text-xs text-muted-foreground">
                Description (helps agent know when to use it)
              </label>
              <textarea
                id="asset-description"
                placeholder="e.g., Send this when customers ask about pricing"
                value={newAsset.description}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewAsset(prev => ({ ...prev, description: e.target.value }))}
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            
            <div className="flex justify-end gap-2 pt-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddForm(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddAsset}
                disabled={submitting || !newAsset.name.trim() || !newAsset.url.trim()}
                className="bg-teal-600 hover:bg-teal-700"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    Adding...
                  </>
                ) : (
                  'Add Asset'
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Assets List */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-teal-600" />
        </div>
      ) : assets.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <File className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No assets yet</p>
          {mode === 'manage' && (
            <p className="text-xs mt-1">Add your first asset to get started</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {assets.map(asset => (
            <div
              key={asset.id}
              onClick={() => handleSelect(asset)}
              className={`
                flex items-center gap-3 p-3 rounded-lg border transition-colors
                ${mode === 'select' ? 'cursor-pointer hover:border-teal-300' : ''}
                ${selectedIds.includes(asset.id) ? 'border-teal-500 bg-teal-50' : 'border-slate-200'}
              `}
            >
              {/* Selection checkbox in select mode */}
              {mode === 'select' && (
                <input
                  type="checkbox"
                  checked={selectedIds.includes(asset.id)}
                  onChange={() => handleSelect(asset)}
                  className="h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
              )}
              
              {/* Category icon */}
              <div className={`p-2 rounded-md ${ASSET_CATEGORIES[asset.category].color}`}>
                {getCategoryIcon(asset.category)}
              </div>
              
              {/* Asset info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-slate-700 truncate">
                    {asset.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${ASSET_CATEGORIES[asset.category].color}`}>
                    {ASSET_CATEGORIES[asset.category].label}
                  </span>
                </div>
                {asset.description && (
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {asset.description}
                  </p>
                )}
              </div>
              
              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(asset.url, '_blank');
                  }}
                  className="h-7 w-7 p-0"
                  title="Open URL"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
                {mode === 'manage' && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteAsset(asset.id);
                    }}
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {/* TODO: Future file upload section */}
      {/* 
        When S3 is configured, add a drag-and-drop file upload zone here:
        1. Accept files based on allowedCategories (images, PDFs, videos)
        2. Upload to S3 via /api/assets/upload endpoint
        3. Auto-detect category from MIME type
        4. Show upload progress
        5. Generate thumbnail previews for images
      */}
    </div>
  );
}

export default AssetManager;
