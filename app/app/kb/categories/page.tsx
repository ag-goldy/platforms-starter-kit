'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  ArrowLeft, 
  Plus, 
  Folder, 
  FolderOpen, 
  Trash2, 
  Building2,
  ChevronRight,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Globe
} from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';

interface Organization {
  id: string;
  name: string;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  orgId: string;
  parentId: string | null;
  isPublic: boolean;
  sortOrder: number;
  articleCount?: number;
}

export default function CategoriesPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // New category form state
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    parentId: '',
    isPublic: true,
    sortOrder: 0,
  });

  // Load organizations
  useEffect(() => {
    async function loadOrganizations() {
      setIsLoadingOrgs(true);
      try {
        const response = await fetch('/api/organizations');
        if (response.ok) {
          const data = await response.json();
          setOrganizations(data.organizations || []);
          if (data.organizations?.length > 0) {
            setSelectedOrgId(data.organizations[0].id);
          }
        }
      } catch (error) {
        console.error('Failed to load organizations:', error);
      } finally {
        setIsLoadingOrgs(false);
      }
    }
    loadOrganizations();
  }, []);

  // Load categories when org changes
  const loadCategories = useCallback(async () => {
    if (!selectedOrgId) return;
    
    setIsLoading(true);
    try {
      const queryParam = selectedOrgId === 'global' ? '' : `?orgId=${selectedOrgId}&includeInternal=true`;
      const response = await fetch(`/api/kb/categories${queryParam}`);
      if (response.ok) {
        const data = await response.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name.trim() || !selectedOrgId) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/kb/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newCategory,
          orgId: selectedOrgId === 'global' ? null : selectedOrgId,
          parentId: newCategory.parentId && newCategory.parentId !== 'none' ? newCategory.parentId : null,
          isPublic: true, // Global categories are always public
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create category');
      }

      showToast('Category created successfully', 'success');
      setNewCategory({ name: '', description: '', parentId: '', isPublic: true, sortOrder: 0 });
      loadCategories();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to create category', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteCategory = async () => {
    if (!categoryToDelete) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/kb/categories?id=${categoryToDelete.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to delete category');
      }

      showToast('Category deleted successfully', 'success');
      setCategoryToDelete(null);
      loadCategories();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to delete category', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const toggleExpand = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  // Build category tree
  const buildCategoryTree = (parentId: string | null = null, depth = 0): { category: Category; depth: number }[] => {
    const result: { category: Category; depth: number }[] = [];
    const children = categories.filter(c => c.parentId === parentId);
    
    for (const cat of children) {
      result.push({ category: cat, depth });
      if (expandedCategories.has(cat.id)) {
        result.push(...buildCategoryTree(cat.id, depth + 1));
      }
    }
    return result;
  };

  const categoryTree = buildCategoryTree();
  const hasChildren = (categoryId: string) => categories.some(c => c.parentId === categoryId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/app/kb">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to KB
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Category List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Categories & Folders</CardTitle>
            <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="global">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-blue-500" />
                    Global (Public)
                  </div>
                </SelectItem>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      {org.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Folder className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p>No categories yet</p>
                <p className="text-sm">Create your first category using the form</p>
              </div>
            ) : (
              <div className="space-y-1">
                {categoryTree.map(({ category, depth }) => (
                  <div
                    key={category.id}
                    className="flex items-center justify-between p-2 hover:bg-gray-50 rounded group"
                    style={{ paddingLeft: `${depth * 24 + 8}px` }}
                  >
                    <div className="flex items-center gap-2">
                      {hasChildren(category.id) ? (
                        <button
                          onClick={() => toggleExpand(category.id)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          {expandedCategories.has(category.id) ? (
                            <ChevronDown className="h-4 w-4 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-500" />
                          )}
                        </button>
                      ) : (
                        <span className="w-6" />
                      )}
                      <FolderOpen className="h-4 w-4 text-blue-500" />
                      <span className="font-medium">{category.name}</span>
                      {!category.isPublic && (
                        <span className="text-xs bg-gray-200 px-2 py-0.5 rounded">Private</span>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setNewCategory(prev => ({ ...prev, parentId: category.id }));
                            document.getElementById('category-name')?.focus();
                          }}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Subfolder
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setCategoryToDelete(category)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Category Form */}
        <Card>
          <CardHeader>
            <CardTitle>Create New Category</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              {!selectedOrgId && !isLoadingOrgs && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
                  Please select an organization or &quot;Global (Public)&quot; from the dropdown first.
                </div>
              )}
              {selectedOrgId === 'global' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
                  <Globe className="h-4 w-4 inline mr-1" />
                  Creating a <strong>Global</strong> category visible to all organizations.
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="category-name">Name *</Label>
                <Input
                  id="category-name"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., Getting Started"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category-description">Description</Label>
                <Textarea
                  id="category-description"
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({ ...newCategory, description: e.target.value })}
                  placeholder="Brief description of this category"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parent-category">Parent Category</Label>
                <Select 
                  value={newCategory.parentId} 
                  onValueChange={(value) => setNewCategory({ ...newCategory, parentId: value })}
                >
                  <SelectTrigger id="parent-category">
                    <SelectValue placeholder="None (Top Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (Top Level)</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sort-order">Sort Order</Label>
                <Input
                  id="sort-order"
                  type="number"
                  value={newCategory.sortOrder}
                  onChange={(e) => setNewCategory({ ...newCategory, sortOrder: parseInt(e.target.value) || 0 })}
                  placeholder="0"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="visibility">Visibility</Label>
                <Select 
                  value={newCategory.isPublic ? 'public' : 'private'} 
                  onValueChange={(value) => setNewCategory({ ...newCategory, isPublic: value === 'public' })}
                >
                  <SelectTrigger id="visibility">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">Public</SelectItem>
                    <SelectItem value="private">Internal Only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                disabled={isCreating || isLoadingOrgs || !newCategory.name.trim() || !selectedOrgId}
                className="w-full"
                title={selectedOrgId === 'global' ? 'Create global category' : 'Create category'}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Category
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!categoryToDelete} onOpenChange={() => setCategoryToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{categoryToDelete?.name}&quot;? 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryToDelete(null)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteCategory}
              disabled={isDeleting}
            >
              {isDeleting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
