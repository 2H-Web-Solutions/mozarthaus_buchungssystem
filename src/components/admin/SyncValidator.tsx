import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { APP_ID } from '../../lib/constants';
import { Activity, Zap, Clock } from 'lucide-react';

export function SyncValidator() {
  const [latency, setLatency] = useState<number | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [lastPingSent, setLastPingSent] = useState<number>(0);
  const [statusColor, setStatusColor] = useState<'green' | 'yellow' | 'red' | 'gray'>('gray');

  // Listen to returning Real-time Pings
  useEffect(() => {
    const pingRef = doc(db, `apps/${APP_ID}/system_tests`, 'ping');
    
    const unsub = onSnapshot(pingRef, (snap) => {
      // Validating true transit-time, excluding initial local cache hits that are faster than network
      if (snap.exists() && isTesting && lastPingSent > 0) {
        
        // Metadata validation preventing false-positive optimistic UI cache matches
        if (!snap.metadata.hasPendingWrites) {
            const receivedTime = Date.now();
            const diff = receivedTime - lastPingSent;
            setLatency(diff);
            setIsTesting(false);
            
            // Seat-lock safety thresholds: < 200ms is ideal for overlapping high-concurrency ticket checkouts
            if (diff < 200) setStatusColor('green');
            else if (diff < 500) setStatusColor('yellow');
            else setStatusColor('red');
        }
      }
    });

    return () => unsub();
  }, [isTesting, lastPingSent]);

  const runPingTest = async () => {
    setIsTesting(true);
    setLatency(null);
    setStatusColor('gray');
    const sendTime = Date.now();
    setLastPingSent(sendTime);
    
    try {
      const pingRef = doc(db, `apps/${APP_ID}/system_tests`, 'ping');
      await setDoc(pingRef, {
        timestamp: serverTimestamp(),
        clientTime: sendTime
      });
    } catch (err) {
      console.error(err);
      setIsTesting(false);
      setStatusColor('red');
    }
  };

  return (
    <div className="h-[calc(100vh-100px)] w-full p-4 flex flex-col items-center justify-center animate-in fade-in">
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-sm w-full border border-gray-100 text-center relative overflow-hidden">
        
        {/* Decorative Radar Sweep */}
        <div className={`absolute top-0 left-0 w-full h-1 ${isTesting ? 'bg-blue-500 animate-pulse' : 'bg-transparent'}`}></div>

        <div className="w-20 h-20 bg-blue-50/50 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner ring-1 ring-blue-100">
          <Activity className="w-10 h-10 text-blue-600" />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2 font-heading tracking-tight">Sync Validator</h1>
        <p className="text-gray-500 mb-10 text-sm leading-relaxed">
          Überprüft die Vercel-zu-Firestore WebSocket (onSnapshot) Latenz in Echtzeit. Kritisch für atomare Sitzplatz-Sperren.
        </p>

        <div className="flex justify-center mb-10">
          <div className={`relative flex items-center justify-center w-36 h-36 rounded-full border-4 transition-colors duration-700 ${
            statusColor === 'green' ? 'border-green-500 bg-green-50' :
            statusColor === 'yellow' ? 'border-yellow-500 bg-yellow-50' :
            statusColor === 'red' ? 'border-red-500 bg-red-50' :
            'border-gray-100 bg-gray-50'
          }`}>
            {isTesting ? (
              <Zap className="w-12 h-12 text-blue-400 animate-pulse" />
            ) : latency !== null ? (
              <div className="flex flex-col items-center animate-in zoom-in-50 duration-300">
                <span className={`text-4xl font-bold font-mono tracking-tighter ${
                  statusColor === 'green' ? 'text-green-600' :
                  statusColor === 'yellow' ? 'text-yellow-600' :
                  'text-red-600'
                }`}>{latency}</span>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">ms</span>
              </div>
            ) : (
              <Clock className="w-12 h-12 text-gray-300" />
            )}
            
            {/* Ping Radar Animation overlapping the circle */}
            {isTesting && (
              <div className="absolute inset-0 rounded-full border-4 border-blue-400 animate-ping opacity-30"></div>
            )}
          </div>
        </div>

        <button 
          onClick={runPingTest}
          disabled={isTesting}
          className="w-full py-4 bg-gray-900 hover:bg-black text-white rounded-2xl font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xl shadow-black/10"
        >
          {isTesting ? 'Sende Ping...' : 'Latenz Test Starten'}
        </button>
      </div>
    </div>
  );
}
