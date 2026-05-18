"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Plus, Trash2, Pencil } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";

type Org = { id: string; subdomain: string; name: string; slug: string };
type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parentId: string | null;
  sortOrder: number;
};

export default function PortalKBCategoriesAdminPage() {
  const params = useParams();
  const subdomain = params?.subdomain as string;
  const { success, error: showError } = useToast();

  const [org, setOrg] = useState<Org | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [newCategory, setNewCategory] = useState({
    name: "",
    description: "",
    parentId: "none",
    sortOrder: 0,
  });

  const [editCategory, setEditCategory] = useState({
    name: "",
    description: "",
    parentId: "none",
    sortOrder: 0,
  });

  const isAdmin = role === "CUSTOMER_ADMIN";

  const loadCategories = useCallback(async (orgId: string) => {
    const res = await fetch(
      `/api/kb/categories?orgId=${orgId}&includeInternal=true`,
    );
    if (!res.ok) {
      setCategories([]);
      return;
    }
    const data = await res.json();
    setCategories((data.categories || []) as Category[]);
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const orgRes = await fetch(`/api/org/${subdomain}`);
        if (!orgRes.ok) throw new Error("Org not found");
        const orgData = (await orgRes.json()) as Org;
        setOrg(orgData);

        const membershipRes = await fetch(`/api/user/membership/${orgData.id}`);
        if (membershipRes.ok) {
          const membershipData = await membershipRes.json();
          setRole(membershipData.role || null);
        } else {
          setRole(null);
        }

        await loadCategories(orgData.id);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [subdomain, loadCategories]);

  const canCreate = useMemo(() => {
    return !!org && isAdmin && newCategory.name.trim().length > 1 && !saving;
  }, [org, isAdmin, newCategory.name, saving]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!org) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kb/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: org.id,
          name: newCategory.name,
          description: newCategory.description || null,
          parentId:
            newCategory.parentId === "none" ? null : newCategory.parentId,
          isPublic: true,
          sortOrder: Number.isFinite(newCategory.sortOrder)
            ? newCategory.sortOrder
            : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to create category");
      }

      success("Category created");
      setNewCategory({
        name: "",
        description: "",
        parentId: "none",
        sortOrder: 0,
      });
      await loadCategories(org.id);
    } catch (e2) {
      showError(e2 instanceof Error ? e2.message : "Failed to create category");
    } finally {
      setSaving(false);
    }
  }

  function startEdit(category: Category) {
    setEditingId(category.id);
    setEditCategory({
      name: category.name,
      description: category.description || "",
      parentId: category.parentId || "none",
      sortOrder: category.sortOrder || 0,
    });
  }

  async function handleUpdate(categoryId: string) {
    if (!org) return;
    setSaving(true);
    try {
      const res = await fetch("/api/kb/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: categoryId,
          name: editCategory.name,
          description: editCategory.description || null,
          parentId:
            editCategory.parentId === "none" ? null : editCategory.parentId,
          sortOrder: Number.isFinite(editCategory.sortOrder)
            ? editCategory.sortOrder
            : 0,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to update category");
      }

      success("Category updated");
      setEditingId(null);
      await loadCategories(org.id);
    } catch (e2) {
      showError(e2 instanceof Error ? e2.message : "Failed to update category");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(categoryId: string) {
    if (!org) return;
    setDeletingId(categoryId);
    try {
      const res = await fetch(`/api/kb/categories?id=${categoryId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to delete category");
      }
      success("Category deleted");
      await loadCategories(org.id);
    } catch (e2) {
      showError(e2 instanceof Error ? e2.message : "Failed to delete category");
    } finally {
      setDeletingId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
      </div>
    );
  }

  if (!org || !isAdmin) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>KB Categories</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-stone-600">
          Admin access required.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href={`/s/${subdomain}/kb/admin`}>
            <Button variant="ghost">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </Link>
          <h1 className="text-2xl font-bold text-stone-900">Categories</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Add Category</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                value={newCategory.name}
                onChange={(e) =>
                  setNewCategory({ ...newCategory, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={newCategory.description}
                onChange={(e) =>
                  setNewCategory({
                    ...newCategory,
                    description: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Parent</Label>
                <Select
                  value={newCategory.parentId}
                  onValueChange={(v) =>
                    setNewCategory({ ...newCategory, parentId: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No parent</SelectItem>
                    {categories.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={newCategory.sortOrder}
                  onChange={(e) =>
                    setNewCategory({
                      ...newCategory,
                      sortOrder: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <Button type="submit" disabled={!canCreate}>
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Create
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Existing Categories</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.length === 0 ? (
            <div className="text-sm text-stone-600">No categories yet.</div>
          ) : (
            categories.map((c) => {
              const isEditing = editingId === c.id;
              return (
                <div
                  key={c.id}
                  className="rounded-lg border border-stone-200 bg-white p-4 space-y-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium text-stone-900 truncate">
                        {c.name}
                      </div>
                      <div className="text-xs text-stone-500 truncate">
                        {c.slug}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <Button
                          onClick={() => handleUpdate(c.id)}
                          disabled={saving}
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : null}
                          Save
                        </Button>
                      ) : (
                        <Button variant="outline" onClick={() => startEdit(c)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete
                      </Button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input
                          value={editCategory.name}
                          onChange={(e) =>
                            setEditCategory({
                              ...editCategory,
                              name: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Textarea
                          value={editCategory.description}
                          onChange={(e) =>
                            setEditCategory({
                              ...editCategory,
                              description: e.target.value,
                            })
                          }
                        />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Parent</Label>
                          <Select
                            value={editCategory.parentId}
                            onValueChange={(v) =>
                              setEditCategory({ ...editCategory, parentId: v })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No parent</SelectItem>
                              {categories
                                .filter((x) => x.id !== c.id)
                                .map((x) => (
                                  <SelectItem key={x.id} value={x.id}>
                                    {x.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Sort Order</Label>
                          <Input
                            type="number"
                            value={editCategory.sortOrder}
                            onChange={(e) =>
                              setEditCategory({
                                ...editCategory,
                                sortOrder: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
