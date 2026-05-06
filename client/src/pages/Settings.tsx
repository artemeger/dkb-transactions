import { useState, useEffect } from 'react';
import type { CategoryRule } from '../types/transaction';
import { useCategories } from '../hooks/useTransactions';
// Import Material Icons component
import Icon from '../components/Icon';

// German labels (hardcoded)
const ADD_CATEGORY_TITLE = 'Kategorie hinzufügen';
const NAME_PLACEHOLDER = 'Name';
const KEYWORDS_PLACEHOLDER = 'Schlüsselwörter (kommagetrennt)';
const SUBMIT_LABEL = 'Hinzufügen';
const CATEGORY_RULES_TITLE = '{{count}} Kategorien';
const RECATEGORIZE_ALL_BUTTON = 'Alle neu kategorisieren';
const RECAT_FEEDBACK = '{{count}} Transaktionen neu kategorisiert';
const KEYWORDS_PLACEHOLDER_EDIT = 'Schlüsselwörter';
const NO_KEYWORDS = 'Keine Schlüsselwörter';
const EDIT_LABEL = 'Bearbeiten';
const DELETE_LABEL = 'Löschen';
const SAVE_LABEL = 'Speichern';
const CANCEL_LABEL = 'Abbrechen';
const NO_CATEGORIES_DEFAULT = 'Noch keine Kategorien. Fügen Sie Ihre erste Kategorie oben hinzu.';

export default function SettingsPage() {
  const { categories, loading, addCategory, updateCategory, deleteCategory, lastRecategorizedCount, clearLastRecategorizedCount, recategorizeAll, resetAllData } = useCategories();

  // Auto-clear recategorization feedback after display
  useEffect(() => {
    if (lastRecategorizedCount !== null) {
      const timer = setTimeout(() => clearLastRecategorizedCount(), 4000);
      return () => clearTimeout(timer);
    }
  }, [lastRecategorizedCount, clearLastRecategorizedCount]);
  
  const [newName, setNewName] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [newColor, setNewColor] = useState('#8b5cf6');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [editColor, setEditColor] = useState('#8b5cf6');

  const handleAddCategory = async () => {
    if (!newName.trim()) return;
    
    await addCategory({
      name: newName.trim(),
      keywords: newKeywords.split(',').map(k => k.trim()).filter(Boolean),
      color: newColor,
    });
    
    setNewName('');
    setNewKeywords('');
  };

  const handleUpdateCategory = async (id: string) => {
    await updateCategory(id, {
      name: editName.trim(),
      keywords: editKeywords.split(',').map(k => k.trim()).filter(Boolean),
      color: editColor,
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Sind Sie sicher, dass Sie diese Kategorie löschen möchten?')) {
      await deleteCategory(id);
    }
  };

  const startEditing = (category: CategoryRule) => {
    setEditingId(category.id);
    setEditName(category.name);
    setEditKeywords(category.keywords.join(', '));
    setEditColor(category.color || '#8b5cf6');
  };

  if (loading) return <div className="flex items-center justify-center h-96"><p>Laden...</p></div>;

  // Build category rules title with count interpolation
  const getCategoryRulesTitle = () => {
    const count = categories?.length || 0;
    return CATEGORY_RULES_TITLE.replace('{{count}}', String(count));
  };

  // Build recategorization feedback message
  const getRecatFeedback = () => {
    if (lastRecategorizedCount !== null) {
      return RECAT_FEEDBACK.replace('{{count}}', String(lastRecategorizedCount));
    }
    return '';
  };

  // Check if a category has keywords and build appropriate message
  const getCategoryKeywordsMessage = (category: CategoryRule) => {
    if (category.keywords.length > 0) {
      const shown = category.keywords.slice(0, 5).join(', ');
      const suffix = category.keywords.length > 5 ? ` (+${category.keywords.length - 5})` : '';
      return `Schlüsselwörter: ${shown}${suffix}`;
    }
    return NO_KEYWORDS;
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      {/* Recategorization Feedback */}
      {lastRecategorizedCount !== null && lastRecategorizedCount > 0 && (
        <div className="p-4 bg-blue-500/15 border border-blue-500/30 rounded-xl shadow-card">
          <p className="text-success font-medium flex items-center gap-1">
            <Icon name="check" size={16} /> {getRecatFeedback()}
          </p>
        </div>
      )}

      {/* Add Category Section */}
      <section>
        <h2 className="text-lg font-semibold mb-4">{ADD_CATEGORY_TITLE}</h2>
        <div className="bg-surface rounded-xl p-6 border border-border shadow-card space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder={NAME_PLACEHOLDER}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-all shadow-card"
            />
            <input
              type="text"
              placeholder={KEYWORDS_PLACEHOLDER}
              value={newKeywords}
              onChange={(e) => setNewKeywords(e.target.value)}
              className="bg-background border border-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-primary transition-all shadow-card"
            />
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
              />
              <span className="text-sm text-gray-400">{newColor}</span>
            </div>
          </div>
          <button
            onClick={handleAddCategory}
            disabled={!newName.trim()}
            className="bg-primary hover:bg-primary-hover px-6 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {SUBMIT_LABEL}
          </button>
        </div>
      </section>

      {/* Existing Categories */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{getCategoryRulesTitle()}</h2>
          <button
            onClick={async () => {
              try {
                await recategorizeAll();
              } catch (err) {
                console.error('Neuklassifizierung fehlgeschlagen:', err);
              }
            }}
            className="bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/30 text-yellow-400 px-4 py-2 rounded-lg font-medium transition-colors"
          >
            {RECATEGORIZE_ALL_BUTTON}
          </button>
        </div>
        <div className="space-y-3">
          {categories.map(category => (
            editingId === category.id ? (
              <div key={category.id} className="bg-surface rounded-xl p-5 border border-primary/50 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder={NAME_PLACEHOLDER}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    value={editKeywords}
                    onChange={(e) => setEditKeywords(e.target.value)}
                    placeholder={KEYWORDS_PLACEHOLDER_EDIT}
                    className="bg-background border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary sm:col-span-2"
                  />
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdateCategory(category.id)}
                    className="bg-success/80 hover:bg-success px-4 py-1.5 rounded-lg text-sm font-medium"
                  >
                    {SAVE_LABEL}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="bg-gray-600 hover:bg-gray-500 px-4 py-1.5 rounded-lg text-sm"
                  >
                    {CANCEL_LABEL}
                  </button>
                </div>
              </div>
            ) : (
              <div key={category.id} className="bg-surface rounded-xl p-5 border border-border flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-8 h-8 rounded-lg" style={{ backgroundColor: category.color }} />
                  <div>
                    <p className="font-medium">{category.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {getCategoryKeywordsMessage(category)}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEditing(category)}
                    className="px-3 py-1.5 text-sm bg-surface-hover hover:bg-border rounded-lg transition-colors"
                  >
                    {EDIT_LABEL}
                  </button>
                  <button
                    onClick={() => handleDelete(category.id)}
                    className="px-3 py-1.5 text-sm text-danger hover:bg-danger/20 rounded-lg transition-colors"
                  >
                    {DELETE_LABEL}
                  </button>
                </div>
              </div>
            )
          ))}

          {categories.length === 0 && (
            <p className="text-center text-gray-400 py-8">{NO_CATEGORIES_DEFAULT}</p>
          )}
        </div>
      </section>

      {/* Danger Zone - Reset All Data */}
      <section className="border-t border-border pt-8">
        <h2 className="text-lg font-semibold text-danger mb-4">Gefahrenzone</h2>
        <div className="bg-danger/5 border border-danger/30 rounded-xl p-6">
          <p className="text-sm text-gray-400 mb-4">
            Alle Transaktionen und Kategorien werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.
          </p>
          <button
            onClick={async () => {
              if (window.confirm('Sind Sie sicher, dass Sie ALLE Daten löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
                if (window.confirm('Letzte Chance: Wirklich wirklich ALLES löschen?')) {
                  try {
                    await resetAllData();
                    window.location.reload();
                  } catch (err) {
                    console.error('Reset fehlgeschlagen:', err);
                    alert('Fehler beim Zurücksetzen der Daten.');
                  }
                }
              }
            }}
            className="bg-danger hover:bg-danger/80 px-6 py-2 rounded-lg font-medium transition-colors"
          >
            Alle Daten zurücksetzen
          </button>
        </div>
      </section>
    </div>
  );
}
