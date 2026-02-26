'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Brain, Plus, Trash2, Edit2, CheckCircle2 } from 'lucide-react';
import {
  addOrgAIMemoryAction,
  updateOrgAIMemoryAction,
  deleteOrgAIMemoryAction,
} from '@/app/app/actions/ai-settings';
import type { OrgAIMemory } from '@/db/schema';

interface AIMemoryManagerProps {
  orgId: string;
  initialMemories: OrgAIMemory[];
}

const memoryTypeLabels: Record<string, string> = {
  instruction: 'Instruction',
  fact: 'Fact',
  preference: 'Preference',
  policy: 'Policy',
};

const memoryTypeColors: Record<string, string> = {
  instruction: 'bg-blue-100 text-blue-800',
  fact: 'bg-green-100 text-green-800',
  preference: 'bg-purple-100 text-purple-800',
  policy: 'bg-orange-100 text-orange-800',
};

export function AIMemoryManager({ orgId, initialMemories }: AIMemoryManagerProps) {
  const { success, error } = useToast();
  const [memories, setMemories] = useState(initialMemories);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [newMemory, setNewMemory] = useState({
    memoryType: 'fact' as const,
    content: '',
    priority: 0,
  });

  const handleAdd = async () => {
    if (!newMemory.content.trim()) return;
    
    setIsLoading(true);
    try {
      const memory = await addOrgAIMemoryAction(orgId, newMemory);
      setMemories([memory, ...memories]);
      setNewMemory({ memoryType: 'fact', content: '', priority: 0 });
      setIsAdding(false);
      success('Memory added successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to add memory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (id: string, updates: Partial<OrgAIMemory>) => {
    setIsLoading(true);
    try {
      await updateOrgAIMemoryAction(orgId, id, updates);
      setMemories(memories.map(m => m.id === id ? { ...m, ...updates } : m));
      setEditingId(null);
      success('Memory updated successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to update memory');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this memory?')) return;
    
    setIsLoading(true);
    try {
      await deleteOrgAIMemoryAction(orgId, id);
      setMemories(memories.filter(m => m.id !== id));
      success('Memory deleted successfully');
    } catch (err) {
      error(err instanceof Error ? err.message : 'Failed to delete memory');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-orange-500" />
            <CardTitle>Organization AI Memory</CardTitle>
          </div>
          <Dialog open={isAdding} onOpenChange={setIsAdding}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Memory
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add AI Memory</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Memory Type</Label>
                  <Select
                    value={newMemory.memoryType}
                    onValueChange={(v) => setNewMemory({ ...newMemory, memoryType: v as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="instruction">Instruction - How AI should behave</SelectItem>
                      <SelectItem value="fact">Fact - Known information about the org</SelectItem>
                      <SelectItem value="preference">Preference - Customer preferences</SelectItem>
                      <SelectItem value="policy">Policy - Business rules or policies</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Content</Label>
                  <Textarea
                    value={newMemory.content}
                    onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })}
                    placeholder="e.g., Business hours are 9 AM to 6 PM SGT"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Priority (0-10, higher = more important)</Label>
                  <Input
                    type="number"
                    value={newMemory.priority}
                    onChange={(e) => setNewMemory({ ...newMemory, priority: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={10}
                  />
                </div>
                <Button onClick={handleAdd} disabled={isLoading || !newMemory.content.trim()} className="w-full">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Memory'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <CardDescription>
          Memories help the AI understand your organization better. They are included in every AI conversation.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {memories.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Brain className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No memories yet. Add some to help the AI understand your organization.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {memories
              .sort((a, b) => b.priority - a.priority)
              .map((memory) => (
                <div
                  key={memory.id}
                  className={`p-4 rounded-lg border ${memory.isActive ? 'bg-white' : 'bg-gray-50 opacity-60'}`}
                >
                  {editingId === memory.id ? (
                    <div className="space-y-3">
                      <Textarea
                        value={memory.content}
                        onChange={(e) =>
                          setMemories(memories.map(m =>
                            m.id === memory.id ? { ...m, content: e.target.value } : m
                          ))
                        }
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdate(memory.id, { content: memory.content })}
                          disabled={isLoading}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-2" />
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={memoryTypeColors[memory.memoryType]}>
                            {memoryTypeLabels[memory.memoryType]}
                          </Badge>
                          {memory.priority > 5 && (
                            <Badge variant="outline" className="text-orange-600">
                              High Priority
                            </Badge>
                          )}
                          {!memory.isActive && (
                            <Badge variant="secondary">Inactive</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-700">{memory.content}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleUpdate(memory.id, { isActive: !memory.isActive })}
                          title={memory.isActive ? 'Deactivate' : 'Activate'}
                        >
                          {memory.isActive ? (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 text-gray-300" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => setEditingId(memory.id)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(memory.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
