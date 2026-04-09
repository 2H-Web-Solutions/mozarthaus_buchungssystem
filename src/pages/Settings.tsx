import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { APP_ID } from '../lib/constants';
import { ImageUploader } from '../components/ImageUploader';
import { CopyableField } from '../components/CopyableField';
import { DataSeeder } from '../components/admin/DataSeeder';

export function Settings() {
  const [activeTab, setActiveTab] = useState<'general' | 'integrations'>('general');
  // General: App Settings & Customization
  const [currentLogo, setCurrentLogo] = useState<string | null>(null);
  const [currentFavicon, setCurrentFavicon] = useState<string | null>(null);
  const [caption, setCaption] = useState('Buchungssystem Mozarthaus');
  const [fontSize, setFontSize] = useState('text-xl');
  const [isSavingTexts, setIsSavingTexts] = useState(false);



  useEffect(() => {
    // Note: Can split this to different docs, grouping visually for MVP.
    const unsubGen = onSnapshot(doc(db, `apps/${APP_ID}/settings`, 'general'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setCurrentLogo(data.logoBase64 || null);
        setCurrentFavicon(data.faviconBase64 || null);
        if (data.sidebarCaption !== undefined) setCaption(data.sidebarCaption);
        if (data.sidebarFontSize !== undefined) setFontSize(data.sidebarFontSize);
      }
    });

    return () => unsubGen();
  }, []);

  const handleLogoUpload = async (base64: string) => {
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'general'), { logoBase64: base64 }, { merge: true });
  };

  const handleFaviconUpload = async (base64: string) => {
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'general'), { faviconBase64: base64 }, { merge: true });
  };

  const saveTextSettings = async () => {
    setIsSavingTexts(true);
    await setDoc(doc(db, `apps/${APP_ID}/settings`, 'general'), { 
      sidebarCaption: caption,
      sidebarFontSize: fontSize
    }, { merge: true });
    setTimeout(() => setIsSavingTexts(false), 1000);
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
          Allgemein & Branding
        </button>
      </div>

      {activeTab === 'general' && (
        <div className="space-y-6">
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
            <h2 className="text-lg font-medium text-gray-900 mb-4">Favicon (Browser Tab Icon)</h2>
            <p className="text-sm text-gray-500 mb-4">Lädt dynamisch in jedem Tab. Quadratische Grafiken bevorzugt (z.B. 64x64px).</p>
            <ImageUploader 
              onUpload={handleFaviconUpload}
              currentImage={currentFavicon || undefined}
            />
            {currentFavicon && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-sm text-gray-500 mb-2">Aktuelles Favicon (Vorschau):</p>
                <img src={currentFavicon} alt="Favicon Preview" className="h-8 w-8 object-contain bg-gray-50 p-1 rounded border shadow-sm" />
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
          <DataSeeder />
        </div>
      )}
    </div>
  );
}
