'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, X } from 'lucide-react';
import {
  createCustomField,
  updateCustomField,
  deleteCustomField,
  getFieldTypeLabel,
  type CustomFieldInput,
} from '@/app/app/actions/custom-fields';
import type { customFields } from '@/db/schema';

type Field = typeof customFields.$inferSelect;

interface CustomFieldsBuilderProps {
  orgId: string;
  initialFields: Field[];
}

const ENTITY_TYPE_LABELS: Record<string, string> = {
  ticket: 'Tickets',
  asset: 'Assets',
  user: 'Users',
  organization: 'Organization',
};

export function CustomFieldsBuilder({ orgId, initialFields }: CustomFieldsBuilderProps) {
  const router = useRouter();
  const [fields, setFields] = useState<Field[]>(initialFields);
  const [isOpen, setIsOpen] = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [formData, setFormData] = useState<CustomFieldInput>({
    name: '',
    label: '',
    description: '',
    entityType: 'ticket',
    fieldType: 'text',
    isRequired: false,
    options: [],
    sortOrder: 0,
    isActive: true,
  });

  const [newOption, setNewOption] = useState({ label: '', value: '' });

  const resetForm = () => {
    setFormData({
      name: '',
      label: '',
      description: '',
      entityType: 'ticket',
      fieldType: 'text',
      isRequired: false,
      options: [],
      sortOrder: 0,
      isActive: true,
    });
    setNewOption({ label: '', value: '' });
    setEditingField(null);
  };

  const handleSubmit = async () => {
    setIsLoading(true);
    try {
      if (editingField) {
        await updateCustomField(orgId, editingField.id, formData);
      } else {
        await createCustomField(orgId, formData);
      }
      router.refresh();
      setIsOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to save field:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (fieldId: string) => {
    if (!confirm('Are you sure you want to delete this field?')) return;
    
    try {
      await deleteCustomField(orgId, fieldId);
      router.refresh();
    } catch (error) {
      console.error('Failed to delete field:', error);
    }
  };

  const openEdit = (field: Field) => {
    setEditingField(field);
    setFormData({
      name: field.name,
      label: field.label,
      description: field.description || '',
      entityType: field.entityType as CustomFieldInput['entityType'],
      fieldType: field.fieldType as CustomFieldInput['fieldType'],
      isRequired: field.isRequired,
      options: (field.options as CustomFieldInput['options']) || [],
      validationRegex: field.validationRegex || undefined,
      validationMessage: field.validationMessage || undefined,
      minValue: field.minValue || undefined,
      maxValue: field.maxValue || undefined,
      minLength: field.minLength || undefined,
      maxLength: field.maxLength || undefined,
      placeholder: field.placeholder || undefined,
      defaultValue: field.defaultValue || undefined,
      sortOrder: field.sortOrder || 0,
      isActive: field.isActive,
    });
    setIsOpen(true);
  };

  const addOption = () => {
    if (!newOption.label || !newOption.value) return;
    setFormData({
      ...formData,
      options: [...(formData.options || []), newOption],
    });
    setNewOption({ label: '', value: '' });
  };

  const removeOption = (index: number) => {
    setFormData({
      ...formData,
      options: formData.options?.filter((_, i) => i !== index),
    });
  };

  const needsOptions = ['select', 'multi_select'].includes(formData.fieldType);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Custom Fields</h2>
          <p className="text-sm text-gray-600">
            Add custom fields to tickets, assets, users, and organizations
          </p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingField ? 'Edit Custom Field' : 'Create Custom Field'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Field Name (Internal)</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., department_code"
                    disabled={!!editingField}
                  />
                  <p className="text-xs text-gray-500">Lowercase with underscores</p>
                </div>

                <div className="space-y-2">
                  <Label>Display Label</Label>
                  <Input
                    value={formData.label}
                    onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                    placeholder="e.g., Department Code"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Help text shown to users"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Applies To</Label>
                  <Select
                    value={formData.entityType}
                    onValueChange={(v) => setFormData({ ...formData, entityType: v as CustomFieldInput['entityType'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ticket">Tickets</SelectItem>
                      <SelectItem value="asset">Assets</SelectItem>
                      <SelectItem value="user">Users</SelectItem>
                      <SelectItem value="organization">Organization</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Field Type</Label>
                  <Select
                    value={formData.fieldType}
                    onValueChange={(v) => setFormData({ ...formData, fieldType: v as CustomFieldInput['fieldType'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Text</SelectItem>
                      <SelectItem value="number">Number</SelectItem>
                      <SelectItem value="date">Date</SelectItem>
                      <SelectItem value="select">Single Select</SelectItem>
                      <SelectItem value="multi_select">Multi Select</SelectItem>
                      <SelectItem value="checkbox">Checkbox</SelectItem>
                      <SelectItem value="url">URL</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {needsOptions && (
                <div className="space-y-2">
                  <Label>Options</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Label"
                      value={newOption.label}
                      onChange={(e) => setNewOption({ ...newOption, label: e.target.value })}
                    />
                    <Input
                      placeholder="Value"
                      value={newOption.value}
                      onChange={(e) => setNewOption({ ...newOption, value: e.target.value })}
                    />
                    <Button type="button" onClick={addOption}>
                      Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.options?.map((opt, idx) => (
                      <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                        {opt.label}
                        <X
                          className="h-3 w-3 cursor-pointer"
                          onClick={() => removeOption(idx)}
                        />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Placeholder</Label>
                <Input
                  value={formData.placeholder}
                  onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
                  placeholder="Shown when field is empty"
                />
              </div>

              <div className="space-y-2">
                <Label>Default Value</Label>
                <Input
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                  placeholder="Default value for new records"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                {formData.fieldType === 'text' && (
                  <>
                    <div className="space-y-2">
                      <Label>Min Length</Label>
                      <Input
                        type="number"
                        value={formData.minLength || ''}
                        onChange={(e) => setFormData({ ...formData, minLength: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Length</Label>
                      <Input
                        type="number"
                        value={formData.maxLength || ''}
                        onChange={(e) => setFormData({ ...formData, maxLength: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                  </>
                )}

                {formData.fieldType === 'number' && (
                  <>
                    <div className="space-y-2">
                      <Label>Min Value</Label>
                      <Input
                        type="number"
                        value={formData.minValue || ''}
                        onChange={(e) => setFormData({ ...formData, minValue: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Max Value</Label>
                      <Input
                        type="number"
                        value={formData.maxValue || ''}
                        onChange={(e) => setFormData({ ...formData, maxValue: parseInt(e.target.value) || undefined })}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.isRequired}
                  onCheckedChange={(v) => setFormData({ ...formData, isRequired: v })}
                />
                <Label>Required Field</Label>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingField ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        {fields.map((field) => (
          <Card key={field.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-medium">{field.label}</div>
                  {field.description && (
                    <div className="text-sm text-gray-500">{field.description}</div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <code className="text-xs bg-gray-100 px-2 py-1 rounded">{field.name}</code>
                    <span>•</span>
                    <span>{getFieldTypeLabel(field.fieldType)}</span>
                    <span>•</span>
                    <span>{ENTITY_TYPE_LABELS[field.entityType]}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {field.isRequired ? (
                    <Badge>Required</Badge>
                  ) : (
                    <span className="text-gray-400 text-sm">Optional</span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(field)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(field.id)}
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {fields.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-gray-500">
              No custom fields configured
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
