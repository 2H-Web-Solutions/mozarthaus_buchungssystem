import { ReactNode } from 'react';
import { AlertCircle } from 'lucide-react';

const REQUIRED_ENVS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_N8N_WEBHOOK_URL'
];

export function EnvValidator({ children }: { children: ReactNode }) {
  const missingEnvs = REQUIRED_ENVS.filter(
    (key) => !import.meta.env[key]
  );

  if (missingEnvs.length > 0) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center p-4 font-sans animate-in fade-in">
        <div className="bg-black/20 backdrop-blur-xl border border-white/20 p-8 rounded-3xl max-w-lg w-full text-white shadow-2xl">
          <div className="flex items-center gap-3 mb-6 text-red-100">
            <AlertCircle className="w-10 h-10 animate-pulse text-red-300" />
            <h1 className="text-3xl font-bold font-heading">Deployment Halt</h1>
          </div>
          <p className="mb-6 text-red-50 text-lg leading-relaxed">
            Das Buchungssystem kann nicht sicher gestartet werden. Folgende kritische Umgebungsvariablen (Environment Variables) fehlen in der Vercel-Umgebung:
          </p>
          <ul className="space-y-3 mb-8 font-mono text-sm bg-black/40 p-5 rounded-2xl border border-white/10 shadow-inner">
            {missingEnvs.map((env) => (
              <li key={env} className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 bg-red-400 rounded-full animate-ping font-bold"></span>
                <span className="font-bold tracking-wide">{env}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-red-100/80 font-medium">
            Bitte pflegen Sie diese exakten Keys im Vercel-Dashboard unter 
            <span className="text-white px-1">"Settings &gt; Environment Variables"</span> 
            ein und triggern Sie ein neues "Redeploy".
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
