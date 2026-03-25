import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

// Das Schema gemäß den Global Task Sync Regeln
interface Task {
  id: string;
  title: string;
  status: 'open' | 'in_progress' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate: Timestamp;
}

const APP_ID = 'mozarthaus_new_buchungssystem_mozarthaus_v1';

export function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');

  useEffect(() => {
    // Lese Tasks aus dem korrekten Pfad
    const tasksRef = collection(db, `apps/${APP_ID}/tasks`);
    const q = query(tasksRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData: Task[] = [];
      snapshot.forEach((doc) => {
        taskData.push({ id: doc.id, ...doc.data() } as Task);
      });
      setTasks(taskData);
    });

    return () => unsubscribe();
  }, []);

  const addTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    // Generiere eine lesbare ID (Slug) anstelle einer zufälligen ID
    const taskId = newTaskTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '-' + Date.now();
    const taskRef = doc(db, `apps/${APP_ID}/tasks`, taskId);

    await setDoc(taskRef, {
      title: newTaskTitle,
      status: 'open',
      priority: 'medium',
      dueDate: Timestamp.now() // Platzhalter für Fälligkeitsdatum
    });

    setNewTaskTitle('');
  };

  const toggleStatus = async (task: Task) => {
    const newStatus = task.status === 'done' ? 'open' : 'done';
    const taskRef = doc(db, `apps/${APP_ID}/tasks`, task.id);
    await setDoc(taskRef, { status: newStatus }, { merge: true });
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-heading text-brand-primary mb-6">Aufgaben (Global Sync)</h1>
      
      <form onSubmit={addTask} className="mb-8 flex gap-4">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Neue Aufgabe hinzufügen..."
          className="flex-1 p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
        />
        <button 
          type="submit"
          className="px-6 py-3 bg-brand-primary text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
        >
          Hinzufügen
        </button>
      </form>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {tasks.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Keine Aufgaben vorhanden.</div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {tasks.map((task) => (
              <li key={task.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleStatus(task)} className="text-gray-400 hover:text-brand-primary">
                    {task.status === 'done' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500" />
                    ) : (
                      <Circle className="w-6 h-6" />
                    )}
                  </button>
                  <span className={`font-medium ${task.status === 'done' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {task.title}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-500">
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    {task.priority}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
