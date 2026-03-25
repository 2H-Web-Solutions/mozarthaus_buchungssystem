import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

interface CopyableFieldProps {
  label: string;
  value: string;
}

export function CopyableField({ label, value }: CopyableFieldProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative bg-gray-50 p-4 rounded-lg border border-gray-200">
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <code className="block text-sm text-gray-800 break-all">{value}</code>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-brand-primary hover:bg-gray-100 rounded-md transition-colors"
        title="In die Zwischenablage kopieren"
      >
        {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  );
}
