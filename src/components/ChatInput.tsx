import { useState, KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  placeholder?: string;
}

export function ChatInput({ onSend, placeholder = "Nachricht eingeben... (Ctrl+Enter zum Senden)" }: ChatInputProps) {
  const [text, setText] = useState('');

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      if (text.trim()) {
        onSend(text);
        setText('');
      }
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[100px] p-4 pr-12 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-y"
      />
      <button
        onClick={() => {
          if (text.trim()) {
            onSend(text);
            setText('');
          }
        }}
        className="absolute bottom-4 right-4 p-2 bg-brand-primary text-white rounded-md hover:bg-red-700 transition-colors"
      >
        <Send className="w-4 h-4" />
      </button>
    </div>
  );
}
