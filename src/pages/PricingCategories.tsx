import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TicketCategory } from '../types/schema';
import { listenTicketCategories, saveTicketCategory, deleteTicketCategory } from '../services/firebase/pricingService';

export function PricingCategories() {
  const [categories, setCategories] = useState<TicketCategory[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState<TicketCategory | null>(null);

  useEffect(() => {
    const unsub = listenTicketCategories((data) => {
      setCategories(data);
    });
    return () => unsub();
  }, []);

  const openNewModal = () => {
    setEditingCat(null);
    setIsModalOpen(true);
  };

  const openEditModal = (cat: TicketCategory) => {
    setEditingCat(cat);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Bist du sicher, dass du diese Kategorie löschen möchtest? Dies kann Buchungen und Belegungspläne beeinflussen!')) {
      try {
        await deleteTicketCategory(id);
        toast.success('Kategorie gelöscht');
      } catch (err) {
        console.error(err);
        toast.error('Fehler beim Löschen');
      }
    }
  };

  const mainCategories = categories.filter(c => !c.type || c.type === 'main');
  const variantCategories = categories.filter(c => c.type === 'variant');

  const renderTable = (cats: TicketCategory[], emptyMessage: string) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200 text-sm text-gray-500">
            <th className="p-4 font-bold">Farbe</th>
            <th className="p-4 font-bold">ID / Alias</th>
            <th className="p-4 font-bold">Name</th>
            <th className="p-4 font-bold">Preis</th>
            <th className="p-4 font-bold">Verknüpfung</th>
            <th className="p-4 font-bold text-center">Aktiv</th>
            <th className="p-4 font-bold text-right">Aktionen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {cats.map((cat) => (
            <tr key={cat.id} className="hover:bg-gray-50/50">
              <td className="p-4">
                <div className="w-6 h-6 rounded border border-gray-200 shadow-sm" style={{ backgroundColor: cat.colorCode }}></div>
              </td>
              <td className="p-4 font-mono text-sm text-gray-600">{cat.id}</td>
              <td className="p-4 font-medium text-gray-900">{cat.name}</td>
              <td className="p-4 font-bold text-gray-900">€{cat.price.toFixed(2)}</td>
              <td className="p-4 text-sm text-gray-500">
                {cat.type === 'variant' && cat.parentId ? (
                  <span className="flex items-center gap-1">
                    ↳ {categories.find(c => c.id === cat.parentId)?.name || cat.parentId}
                  </span>
                ) : (
                  <span className="text-gray-300">-</span>
                )}
              </td>
              <td className="p-4 text-center">
                {cat.isActive ? <Check className="w-5 h-5 text-green-500 mx-auto" /> : <X className="w-5 h-5 text-gray-400 mx-auto" />}
              </td>
              <td className="p-4 text-right">
                <div className="flex justify-end gap-2">
                  <button onClick={() => openEditModal(cat)} className="p-2 text-gray-400 hover:text-brand-primary transition">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(cat.id)} className="p-2 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {cats.length === 0 && (
            <tr>
              <td colSpan={7} className="p-8 text-center text-gray-500">{emptyMessage}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto pb-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-heading text-brand-primary font-bold">Preise & Kategorien</h1>
          <p className="text-gray-500 mt-1">Verwalte die verfügbaren Ticket-Kategorien (Stammdaten).</p>
        </div>
        <button
          onClick={openNewModal}
          className="bg-brand-primary text-white px-6 py-2.5 rounded-lg flex items-center gap-2 hover:bg-red-700 transition shadow-sm font-bold"
        >
          <Plus className="w-5 h-5" />
          Kategorie hinzufügen
        </button>
      </div>

      <h2 className="text-xl font-bold text-gray-900 mb-4">Hauptkategorien (Regiondo)</h2>
      {renderTable(mainCategories, 'Keine Hauptkategorien angelegt.')}

      <h2 className="text-xl font-bold text-gray-900 mb-4 mt-8">Preisvarianten / Partner-Tarife</h2>
      {(() => {
        const tariffGroups = Array.from(new Set(variantCategories.map(c => c.tariffGroup || 'Ohne Tarifgruppe')));
        if (tariffGroups.length === 0) return renderTable([], 'Keine Varianten angelegt.');
        
        return tariffGroups.map(group => {
          const groupCats = variantCategories.filter(c => (c.tariffGroup || 'Ohne Tarifgruppe') === group);
          return (
            <div key={group}>
              <h3 className="text-lg font-bold text-gray-700 mb-2 px-1">Tarifgruppe: {group}</h3>
              {renderTable(groupCats, 'Keine Varianten in dieser Gruppe.')}
            </div>
          );
        });
      })()}

      {isModalOpen && (
        <CategoryModal
          category={editingCat}
          categories={categories}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
}

function CategoryModal({ category, categories, onClose }: { category: TicketCategory | null, categories: TicketCategory[], onClose: () => void }) {
  const [formData, setFormData] = useState<Partial<TicketCategory>>(
    category || {
      id: '',
      name: '',
      price: 0,
      colorCode: '#c02a2a',
      isActive: true,
      description: '',
      type: 'main',
      parentId: '',
      tariffGroup: ''
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.id || !formData.name || formData.price === undefined) {
      toast.error('Bitte ID, Name und Preis angeben.');
      return;
    }
    if (formData.type === 'variant' && !formData.parentId) {
      toast.error('Bitte eine Hauptkategorie für die Variante auswählen.');
      return;
    }

    // Force strict ID style manually if it's new
    let finalId = formData.id;
    if (!category) {
       finalId = finalId.toLowerCase().replace(/[^a-z0-9_]/g, '_');
    }

    try {
      await saveTicketCategory({ ...formData, id: finalId } as TicketCategory);
      toast.success('Kategorie gespeichert');
      onClose();
    } catch (err) {
      console.error(err);
      toast.error('Fehler beim Speichern');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-xl font-heading font-bold text-gray-900">
            {category ? 'Kategorie bearbeiten' : 'Neue Kategorie'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ID (Alias)</label>
              <input
                type="text"
                value={formData.id}
                onChange={e => setFormData({ ...formData, id: e.target.value })}
                disabled={!!category}
                required
                placeholder="z.B. cat_a"
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none disabled:bg-gray-100 disabled:text-gray-500 font-mono text-sm"
              />
              {!category && <p className="text-xs text-gray-500 mt-1">Nur Kleinbuchstaben & Unterstriche (z.B. cat_a).</p>}
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Typ</label>
              <select
                value={formData.type || 'main'}
                onChange={e => setFormData({ ...formData, type: e.target.value as 'main' | 'variant', parentId: e.target.value === 'main' ? null : formData.parentId })}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none bg-white"
              >
                <option value="main">Hauptkategorie (Regiondo)</option>
                <option value="variant">Preisvariante / Rabatt</option>
              </select>
            </div>

            {formData.type === 'variant' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Verknüpfte Hauptkategorie <span className="text-red-500">*</span></label>
                  <select
                    value={formData.parentId || ''}
                    onChange={e => setFormData({ ...formData, parentId: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none bg-white"
                    required
                  >
                    <option value="">-- Bitte wählen --</option>
                    {categories.filter(c => !c.type || c.type === 'main').map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-1">Tarifgruppe / Rabatt-Name (Optional)</label>
                  <input
                    type="text"
                    list="tariff-groups"
                    value={formData.tariffGroup || ''}
                    onChange={e => setFormData({ ...formData, tariffGroup: e.target.value })}
                    placeholder="z.B. Vienna Card, Hotel"
                    className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
                  />
                  <datalist id="tariff-groups">
                    {Array.from(new Set(categories.map(c => c.tariffGroup).filter(Boolean))).map(group => (
                      <option key={group as string} value={group as string} />
                    ))}
                  </datalist>
                  <p className="text-xs text-gray-500 mt-1">
                    Varianten mit gleicher Tarifgruppe werden im Booking-Wizard in einem Dropdown gebündelt.
                  </p>
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Anzeigename</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                required
                placeholder={formData.type === 'variant' ? "z.B. Student, Rollstuhl" : "z.B. Kategorie A"}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Preis (€)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.price}
                onChange={e => setFormData({ ...formData, price: Number(e.target.value) })}
                required
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none"
              />
            </div>

            <div className="flex gap-4">
               <div className="flex-1">
                 <label className="block text-sm font-bold text-gray-700 mb-1">Farbcode (Saalplan)</label>
                 <div className="flex items-center gap-2">
                   <input
                     type="color"
                     value={formData.colorCode}
                     onChange={e => setFormData({ ...formData, colorCode: e.target.value })}
                     className="w-10 h-10 rounded cursor-pointer border-0 p-0"
                   />
                   <input 
                     type="text" 
                     value={formData.colorCode}
                     onChange={e => setFormData({ ...formData, colorCode: e.target.value })}
                     className="flex-1 p-2.5 border border-gray-300 rounded-lg font-mono text-sm text-gray-600"
                   />
                 </div>
               </div>
               
               <div className="flex items-center pt-6">
                 <label className="flex items-center gap-2 cursor-pointer">
                   <input
                     type="checkbox"
                     checked={formData.isActive}
                     onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                     className="w-5 h-5 text-brand-primary rounded border-gray-300 focus:ring-brand-primary"
                   />
                   <span className="text-sm font-bold text-gray-700">Aktiv</span>
                 </label>
               </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">Beschreibung (Optional)</label>
              <textarea
                value={formData.description || ''}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={2}
                className="w-full p-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary outline-none resize-none"
              />
            </div>
            
          </div>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 font-bold rounded-lg hover:bg-gray-50 transition"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2.5 bg-brand-primary text-white font-bold rounded-lg hover:bg-red-700 transition"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
