'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ListTodo, Plus, Trash2 } from 'lucide-react';

export function TaskManager() {
  const [tasks, setTasks] = useState<{ name: string; category: string }[]>([]);
  const [supplements, setSupplements] = useState<string[]>([]);
  const [newTask, setNewTask] = useState('');
  const [newCategory, setNewCategory] = useState('');

  useEffect(() => {
    fetch('/api/my-data')
      .then((r) => r.json())
      .then((data) => {
        if (data.protocol) {
          setTasks(data.protocol.dailyTasks || []);
          setSupplements(data.protocol.supplements?.map((s: { name: string }) => s.name) || []);
        }
      });
  }, []);

  const save = async (updatedTasks: { name: string; category: string }[]) => {
    await fetch('/api/save-onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: null, protocol: null, config: { tasks: updatedTasks, supplements } }),
    });
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const updated = [...tasks, { name: newTask.trim(), category: newCategory.trim() || 'general' }];
    setTasks(updated);
    await save(updated);
    setNewTask('');
    setNewCategory('');
  };

  const removeTask = async (index: number) => {
    const updated = tasks.filter((_, i) => i !== index);
    setTasks(updated);
    await save(updated);
  };

  return (
    <Card>
      <div className="flex items-center gap-2 mb-4">
        <ListTodo className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Tasks</h3>
      </div>
      <div className="space-y-2 mb-4">
        {tasks.map((task, i) => (
          <div key={i} className="flex items-center justify-between py-1.5 border-b border-card-border last:border-0">
            <div>
              <p className="text-sm">{task.name}</p>
              <p className="text-[10px] text-muted">{task.category}</p>
            </div>
            <button onClick={() => removeTask(i)} className="p-1.5 text-muted hover:text-danger">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <Input value={newTask} onChange={setNewTask} placeholder="Task nou" className="flex-1" />
        <Input value={newCategory} onChange={setNewCategory} placeholder="Categorie" className="w-24" />
        <Button onClick={addTask} size="sm" disabled={!newTask.trim()}>
          <Plus className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
