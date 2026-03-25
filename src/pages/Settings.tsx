import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { ImageUploader } from '../components/ImageUploader';
import { CopyableField } from '../components/CopyableField';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('general');
  // General: App Settings & Customization
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [caption, setCaption] = useState('Buchungssystem Mozarthaus');
  const [fontSize, setFontSize] = useState('text-xl');
  const [isSavingTexts, setIsSavingTexts] = useState(false);

  // Pricing Model
  const [premiumPrice, setPremiumPrice] = useState(65);
  const [standardPrice, setStandardPrice] = useState(45);
  const [wheelchairPrice, setWheelchairPrice] = useState(25);
  const [isSavingPricing, setIsSavingPricing] = useState(false);

  useEffect(() => {
    // Note: Can split this to different docs, grouping visually for MVP.
    const unsubGen = onSnapshot(doc(db, `apps/${APP_ID}/settings`, 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentLogo(data.logoBase64 || null);
        if (data.sidebarCaption !== undefined) setCaption(data.sidebarCaption);
        if (data.sidebarFontSize !== undefined) setFontSize(data.sidebarFontSize);
      }
    });

    const unsubCore = onSnapshot(doc(db, `apps/${APP_ID}/settings`, 'core_config'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.premiumPrice !== undefined) setPremiumPrice(data.premiumPrice);
        if (data.standardPrice !== undefined) setStandardPrice(data.standardPrice);
        if (data.wheelchairPrice !== undefined) setWheelchairPrice(data.wheelchairPrice);
      }
    });
    
    return () => { unsubGen(); unsubCore(); };
  }, []);

  const handleLogoUpload = async (base64: string) => {
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'general'), { logoBase64: base64 }, { merge: true });
  };

  const saveTextSettings = async () => {
    setIsSavingTexts(true);
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'general'), { 
      sidebarCaption: caption,
      sidebarFontSize: fontSize
    }, { merge: true });
    setTimeout(() => setIsSavingTexts(false), 1000);
  };

  const savePricing = async () => {
    setIsSavingPricing(true);
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'core_config'), {
      premiumPrice,
      standardPrice,
      wheelchairPrice
    }, { merge: true });
    setTimeout(() => setIsSavingPricing(false), 1000);
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <h1 className="text-2xl font-heading text-brand-primary mb-6">Systemeinstellungen</h1>

      {/* Tabs */}
      <div className="flex gap-4 border-b border-gray-200 mb-6">
        <button 
          onClick={() => setActiveTab('general')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'general' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Allgemein & Pricing
        </button>
        <button 
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === 'integrations' ? 'border-brand-primary text-brand-primary' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
        >
          Integrationen & API
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
          {/* Prices */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Preiskategorien (Core Config)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm text-gray-700 mb-1">Premium (€)</label>
                <input type="number" value={premiumPrice} onChange={e => setPremiumPrice(Number(e.target.value))} className="w-full p-2 border border-brand-primary rounded-lg focus:ring-1 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Standard (€)</label>
                <input type="number" value={standardPrice} onChange={e => setStandardPrice(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary" />
              </div>
              <div>
                <label className="block text-sm text-gray-700 mb-1">Rollstuhl (€)</label>
                <input type="number" value={wheelchairPrice} onChange={e => setWheelchairPrice(Number(e.target.value))} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-brand-primary" />
              </div>
            </div>
            <button onClick={savePricing} className="bg-brand-primary text-white px-4 py-2 rounded-lg hover:bg-red-700">
              {isSavingPricing ? 'Gespeichert!' : 'Preise aktualisieren'}
            </button>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Branding (Logo)</h2>
            <ImageUploader 
              onUpload={handleLogoUpload}
              currentImage={currentLogo || undefined}
            />
            {currentLogo && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Aktuelles Logo (Vorschau):</p>
                <img src={currentLogo} alt="Logo Preview" className="h-12 object-contain bg-gray-50 p-2 rounded border" />
              </div>
            )}
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Sidebar Text anpassen</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Titel (Caption)</label>
              <input type="text" value={caption} onChange={(e) => setCaption(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Schriftgröße</label>
              <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary">
                <option value="text-sm">Klein (text-sm)</option>
                <option value="text-base">Normal (text-base)</option>
                <option value="text-lg">Mittel (text-lg)</option>
                <option value="text-xl">Groß (text-xl)</option>
                <option value="text-2xl">Sehr groß (text-2xl)</option>
              </select>
            </div>
            <button onClick={saveTextSettings} className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-red-700">
              {isSavingTexts ? 'Gespeichert!' : 'Text & Größe speichern'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'integrations' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-medium text-gray-900 mb-2">n8n / Regiondo Webhooks (Phase 2)</h2>
            <p className="text-sm text-gray-500 mb-6">Nutze diese Endpunkte, um externe Buchungsinformationen (z.B. Regiondo, B2B APIs) sicher an das System zu leiten.</p>
            
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Incoming Booking Webhook (Firestore HTTPS Callable)</label>
                <CopyableField 
                  value={`https://europe-west3-mozarthaus-6cf51.cloudfunctions.net/api/v1/apps/${APP_ID}/booking.create`} 
                  label=""
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-1">Event Sync Webhook (List events)</label>
                <CopyableField 
                  value={`https://europe-west3-mozarthaus-6cf51.cloudfunctions.net/api/v1/apps/${APP_ID}/events.list`} 
                  label=""
                />
              </div>
            </div>

            <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
               <strong>Hinweis:</strong> Diese URLs sind Platzhalter für die n8n Infrastruktur (Phase 2). Derzeit liest das React System direkt aus Firestore über den Auth-less Layer.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
