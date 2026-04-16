'use client';

import { Card } from '@/components/ui/Card';
import { Toggle } from '@/components/ui/Toggle';
import { Task } from '@/lib/types';
import { ListTodo } from 'lucide-react';

export function TaskList({ tasks, onToggle }: { tasks: Task[]; onToggle: (id: string) => void }) {
  const categories = [...new Set(tasks.map((t) => t.category))];

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <ListTodo className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-medium">Tasks</h3>
        <span className="text-xs text-muted-foreground ml-auto">
          {tasks.filter((t) => t.done).length}/{tasks.length}
        </span>
      </div>
      <div className="space-y-4">
        {categories.map((cat) => (
          <div key={cat}>
            <p className="text-xs text-muted uppercase tracking-wider mb-1">{cat}</p>
            {tasks
              .filter((t) => t.category === cat)
              .map((task) => (
                <Toggle
                  key={task.id}
                  checked={task.done}
                  onChange={() => onToggle(task.id)}
                  label={task.name}
                />
              ))}
          </div>
        ))}
      </div>
    </Card>
  );
}
