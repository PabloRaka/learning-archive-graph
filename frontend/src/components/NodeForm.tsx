import React, { useState, useEffect } from 'react';
import { X, Save, Tag, BookOpen, Calendar, HelpCircle } from 'lucide-react';
import type { Category, LearningEntry } from '../types';

interface NodeFormProps {
  type: 'category' | 'learning';
  categories: Category[];
  learnings: LearningEntry[];
  editingEntry?: LearningEntry | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}

export const NodeForm: React.FC<NodeFormProps> = ({
  type,
  categories,
  learnings,
  editingEntry,
  onSave,
  onCancel,
}) => {
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [learnTitle, setLearnTitle] = useState('');
  const [learnContent, setLearnContent] = useState('');
  const [learnDate, setLearnDate] = useState(new Date().toISOString().split('T')[0]);
  const [learnPrimaryCatId, setLearnPrimaryCatId] = useState('');
  const [connectedNodeIds, setConnectedNodeIds] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    if (editingEntry) {
      setLearnTitle(editingEntry.title);
      setLearnContent(editingEntry.content);
      setLearnDate(editingEntry.date);
      setLearnPrimaryCatId(editingEntry.primary_category_id);
      
      // Let's load existing connections for editing.
      // We will let the parent component pass connections, or we can fetch/extract it.
      // Wait, we can pass it or fetch it in App.tsx. We will have `editingConnections` or we can let App.tsx manage it.
      // To keep it simple, we will set them through editingEntry's connections if passed, 
      // or we can allow the user to select them.
      // Let's add a prop or let the user choose them.
      // Wait! Let's pass the pre-existing connections in editingEntry as an additional parameter, or let the parent pass `connectedNodeIds`!
      // Let's pass `initialConnectedNodeIds` to make it super robust!
    } else {
      if (categories.length > 0) {
        setLearnPrimaryCatId(categories[0].id);
      }
    }
  }, [editingEntry, categories]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'category') {
      if (!catName.trim()) return;
      onSave({
        name: catName.trim(),
        description: catDesc.trim() || null,
      });
    } else {
      if (!learnTitle.trim() || !learnPrimaryCatId) return;
      onSave({
        title: learnTitle.trim(),
        content: learnContent,
        date: learnDate,
        primary_category_id: learnPrimaryCatId,
        connected_node_ids: connectedNodeIds,
      });
    }
  };

  const toggleConnectedNode = (id: string) => {
    if (connectedNodeIds.includes(id)) {
      setConnectedNodeIds(connectedNodeIds.filter(nId => nId !== id));
    } else {
      setConnectedNodeIds([...connectedNodeIds, id]);
    }
  };

  // Filter possible nodes to link to:
  // Cannot link a learning entry to itself.
  // The primary category is automatically linked, so hide it from the manual connections list.
  const eligibleNodes = [
    ...categories.map(c => ({ id: c.id, name: c.name, type: 'category' as const })),
    ...learnings
      .filter(l => !editingEntry || l.id !== editingEntry.id)
      .map(l => ({ id: l.id, name: l.title, type: 'entry' as const })),
  ].filter(
    node =>
      node.id !== learnPrimaryCatId &&
      (searchFilter === '' || node.name.toLowerCase().includes(searchFilter.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/80 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="w-full max-w-2xl angular-card bg-surface-soft p-6 relative flex flex-col gap-6">
        <div className="corner-square top-0 left-0" />
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <h2 className="text-xl font-bold uppercase tracking-wide text-brand flex items-center gap-2">
            {type === 'category' ? <Tag className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
            {editingEntry ? `Edit Learning Entry` : `Create New ${type === 'category' ? 'Category' : 'Learning Entry'}`}
          </h2>
          <button
            onClick={onCancel}
            className="text-mute hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {type === 'category' ? (
            <>
              {/* Category Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-mute">Category Name</label>
                <input
                  type="text"
                  placeholder="e.g. FastAPI, React Hooks, Deep Learning"
                  className="tech-input"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              {/* Category Description */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-mute">Description (Optional)</label>
                <textarea
                  placeholder="What is this category about?"
                  rows={3}
                  className="tech-input resize-none"
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              {/* Learning Title */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-mute">Title</label>
                <input
                  type="text"
                  placeholder="What did you learn today?"
                  className="tech-input"
                  value={learnTitle}
                  onChange={(e) => setLearnTitle(e.target.value)}
                  required
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Date Selection */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-mute flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" /> Date Logged
                  </label>
                  <input
                    type="date"
                    className="tech-input"
                    value={learnDate}
                    onChange={(e) => setLearnDate(e.target.value)}
                    required
                  />
                </div>

                {/* Primary Category Selector */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-mute flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Primary Category
                  </label>
                  <select
                    className="tech-input h-[42px] bg-canvas"
                    value={learnPrimaryCatId}
                    onChange={(e) => setLearnPrimaryCatId(e.target.value)}
                    required
                  >
                    {categories.length === 0 ? (
                      <option value="">-- No Categories Available --</option>
                    ) : (
                      categories.map(cat => (
                        <option key={cat.id} value={cat.id}>
                          {cat.name}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              </div>

              {/* Content (Markdown Notes) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-mute">
                  Notes (Markdown Supported)
                </label>
                <textarea
                  placeholder="Explain what you learned, write code snippets, key rules, etc..."
                  rows={6}
                  className="tech-input font-mono text-sm resize-y"
                  value={learnContent}
                  onChange={(e) => setLearnContent(e.target.value)}
                  required
                />
              </div>

              {/* Flexible Graph Connections selector */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-mute flex items-center gap-1.5">
                  <HelpCircle className="h-3.5 w-3.5" /> Connect to other nodes in the Graph (Optional)
                </label>
                <p className="text-[11px] text-mute mb-1">
                  Primary category connection is automatic. Connect this learning to other categories or learning entries here:
                </p>
                
                {/* Search in connection checklist */}
                <input
                  type="text"
                  placeholder="Filter nodes to connect..."
                  className="tech-input py-1 text-xs mb-2 bg-surface-elevated"
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                />

                <div className="border border-hairline max-h-40 overflow-y-auto bg-canvas p-2 flex flex-col gap-1.5 rounded-[2px]">
                  {eligibleNodes.length === 0 ? (
                    <span className="text-xs text-mute p-2 text-center">No other eligible nodes found</span>
                  ) : (
                    eligibleNodes.map(node => (
                      <label
                        key={node.id}
                        className="flex items-center gap-2 px-2 py-1 hover:bg-surface-elevated rounded-[2px] cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={connectedNodeIds.includes(node.id)}
                          onChange={() => toggleConnectedNode(node.id)}
                          className="accent-brand rounded-[2px]"
                        />
                        <span className="flex-1 text-xs truncate">
                          {node.name}
                        </span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-[2px] font-bold uppercase ${
                          node.type === 'category' 
                            ? 'bg-brand/10 text-brand border border-brand/20' 
                            : 'bg-white/10 text-white border border-white/20'
                        }`}>
                          {node.type}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 mt-2 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="btn-outline-secondary cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary cursor-pointer"
              disabled={type === 'learning' && categories.length === 0}
            >
              <Save className="h-4 w-4" /> Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
