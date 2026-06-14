import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  X, Save, Tag, BookOpen, Calendar, HelpCircle,
  Bold, Italic, Code, Link as LinkIcon, List, Heading, Eye, Edit3
} from 'lucide-react';
import type { Category, LearningEntry, Connection } from '../types';
import { getCategoryColor } from '../colors';
import hljs from 'highlight.js';

interface NodeFormProps {
  type: 'category' | 'learning';
  categories: Category[];
  learnings: LearningEntry[];
  connections?: Connection[];
  editingEntry?: LearningEntry | null;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const markdownComponents = {
  code({ children, className, ...rest }: React.ComponentPropsWithoutRef<'code'>) {
    const match = /language-(\w+)/.exec(className || '');
    const codeString = String(children).replace(/\n$/, '');
    if (match) {
      try {
        const highlighted = hljs.highlight(codeString, { language: match[1] }).value;
        return <code className={`${className} hljs`} dangerouslySetInnerHTML={{ __html: highlighted }} />;
      } catch {
        // Fallback
      }
    }
    return <code className={className} {...rest}>{children}</code>;
  }
};

export const NodeForm: React.FC<NodeFormProps> = ({
  type,
  categories,
  learnings,
  connections = [],
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

  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  const insertMarkdown = (syntaxBefore: string, syntaxAfter: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const replacement = syntaxBefore + selectedText + syntaxAfter;

    setLearnContent(text.substring(0, start) + replacement + text.substring(end));

    // Refocus and set cursor selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + syntaxBefore.length,
        start + syntaxBefore.length + selectedText.length
      );
    }, 0);
  };

  useEffect(() => {
    if (editingEntry) {
      setLearnTitle(editingEntry.title);
      setLearnContent(editingEntry.content);
      setLearnDate(editingEntry.date);
      setLearnPrimaryCatId(editingEntry.primary_category_id);
      
      // Load existing connections for editing
      const initialConns = connections
        .filter(c => c.source_id === editingEntry.id || c.target_id === editingEntry.id)
        .map(c => c.source_id === editingEntry.id ? c.target_id : c.source_id);
      
      // Filter out the primary category connection, since it's added automatically
      setConnectedNodeIds(initialConns.filter(id => id !== editingEntry.primary_category_id));
    } else {
      if (categories.length > 0) {
        setLearnPrimaryCatId(categories[0].id);
      }
      setConnectedNodeIds([]);
    }
  }, [editingEntry, categories, connections]);

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

  const eligibleNodes = [
    ...categories.map(c => ({ id: c.id, name: c.name, type: 'category' as const, categoryName: c.name })),
    ...learnings
      .filter(l => !editingEntry || l.id !== editingEntry.id)
      .map(l => {
        const cat = categories.find(c => c.id === l.primary_category_id);
        return {
          id: l.id,
          name: l.title,
          type: 'entry' as const,
          categoryName: cat ? cat.name : 'Unknown'
        };
      }),
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between border-b border-hairline pb-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-mute">
                    Notes (Markdown Supported)
                  </label>
                  
                  {/* Tab Switcher */}
                  <div className="flex items-center gap-1 bg-canvas p-0.5 rounded border border-hairline">
                    <button
                      type="button"
                      onClick={() => setActiveTab('write')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-[2px] transition-all cursor-pointer ${
                        activeTab === 'write'
                          ? 'bg-hairline text-white'
                          : 'text-mute hover:text-white'
                      }`}
                    >
                      <Edit3 className="h-3 w-3" /> Write
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('preview')}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[10px] font-bold uppercase rounded-[2px] transition-all cursor-pointer ${
                        activeTab === 'preview'
                          ? 'bg-hairline text-white'
                          : 'text-mute hover:text-white'
                      }`}
                    >
                      <Eye className="h-3 w-3" /> Preview
                    </button>
                  </div>
                </div>

                {activeTab === 'write' ? (
                  <div className="flex flex-col gap-1.5">
                    {/* Toolbar */}
                    <div className="flex items-center gap-1 p-1 bg-canvas rounded border border-hairline shrink-0">
                      <button
                        type="button"
                        onClick={() => insertMarkdown('**', '**')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Bold"
                      >
                        <Bold className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('*', '*')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Italic"
                      >
                        <Italic className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('### ')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Heading"
                      >
                        <Heading className="h-3.5 w-3.5" />
                      </button>
                      <div className="w-[1px] h-4 bg-hairline mx-1" />
                      <button
                        type="button"
                        onClick={() => insertMarkdown('`', '`')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Inline Code"
                      >
                        <Code className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('```\n', '\n```')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Code Block"
                      >
                        <span className="text-[10px] font-bold font-mono px-0.5 leading-none">```</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('[', '](url)')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="Link"
                      >
                        <LinkIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => insertMarkdown('- ')}
                        className="p-1 hover:bg-hairline rounded text-mute hover:text-brand transition-colors cursor-pointer flex items-center justify-center"
                        title="List"
                      >
                        <List className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      placeholder="Explain what you learned, write code snippets, key rules, etc..."
                      rows={6}
                      className="tech-input font-mono text-xs resize-y w-full bg-canvas/40"
                      value={learnContent}
                      onChange={(e) => setLearnContent(e.target.value)}
                      required
                    />
                  </div>
                ) : (
                  <div 
                    className="tech-input bg-canvas/20 border border-hairline p-3 overflow-y-auto markdown-body text-xs rounded-[2px]"
                    style={{ minHeight: '166px', maxHeight: '250px' }}
                  >
                    {learnContent.trim() ? (
                      <ReactMarkdown components={markdownComponents}>{learnContent}</ReactMarkdown>
                    ) : (
                      <span className="text-mute italic">Nothing to preview yet. Start typing in the 'Write' tab!</span>
                    )}
                  </div>
                )}
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
                    eligibleNodes.map(node => {
                      const color = getCategoryColor(node.categoryName);
                      return (
                        <label
                          key={node.id}
                          className="flex items-center gap-2 px-2 py-1 hover:bg-surface-elevated rounded-[2px] cursor-pointer text-sm transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={connectedNodeIds.includes(node.id)}
                            onChange={() => toggleConnectedNode(node.id)}
                            className="rounded-[2px]"
                            style={{ accentColor: color }}
                          />
                          <span className="flex-1 text-xs truncate" style={{ color: node.type === 'category' ? color : undefined }}>
                            {node.name}
                          </span>
                          <span 
                            className="text-[9px] px-1.5 py-0.5 rounded-[2px] font-bold uppercase border"
                            style={{
                              backgroundColor: `${color}15`,
                              borderColor: `${color}35`,
                              color: color
                            }}
                          >
                            {node.type}
                          </span>
                        </label>
                      );
                    })
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
