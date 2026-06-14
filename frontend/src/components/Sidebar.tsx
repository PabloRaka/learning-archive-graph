import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  Tag, BookOpen, Calendar, Trash2, Edit2, X, Link as LinkIcon, Plus, Maximize2
} from 'lucide-react';
import type { Category, LearningEntry, GraphNode, GraphLink } from '../types';
import { getCategoryColor } from '../colors';
import hljs from 'highlight.js';

interface SidebarProps {
  selectedNode: GraphNode | null;
  categories: Category[];
  learnings: LearningEntry[];
  links: GraphLink[];
  onClose: () => void;
  onEdit: (entry: LearningEntry) => void;
  onDeleteCategory: (id: string) => void;
  onDeleteLearning: (id: string) => void;
  onSelectNodeById: (id: string) => void;
  onAddConnection: (sourceId: string, targetId: string) => void;
  onRemoveConnection: (sourceId: string, targetId: string) => void;
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

export const Sidebar: React.FC<SidebarProps> = ({
  selectedNode,
  categories,
  learnings,
  links,
  onClose,
  onEdit,
  onDeleteCategory,
  onDeleteLearning,
  onSelectNodeById,
  onAddConnection,
  onRemoveConnection,
}) => {
  const [showAddConn, setShowAddConn] = useState(false);
  const [connTargetId, setConnTargetId] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isFullscreenMarkdown, setIsFullscreenMarkdown] = useState(false);

  // Reset delete confirm state and fullscreen mode when node changes
  React.useEffect(() => {
    setShowDeleteConfirm(false);
    setShowAddConn(false);
    setIsFullscreenMarkdown(false);
  }, [selectedNode?.id]);

  // Listen for Escape key to exit fullscreen mode
  React.useEffect(() => {
    if (!isFullscreenMarkdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsFullscreenMarkdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreenMarkdown]);

  // Panel only shows when a node is selected
  if (!selectedNode) return null;

  const isCategory = selectedNode.type === 'category';
  const categoryData = isCategory ? categories.find(c => c.id === selectedNode.id) : null;
  const learningData = !isCategory ? learnings.find(l => l.id === selectedNode.id) : null;

  const nodeCategoryName = isCategory ? selectedNode.name : selectedNode.category_name;
  const nodeColor = getCategoryColor(nodeCategoryName);

  const nodeConnections = links.filter(l => {
    const srcId = typeof l.source === 'object' ? l.source.id : l.source;
    const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
    return srcId === selectedNode.id || tgtId === selectedNode.id;
  });

  const connectedNodes = nodeConnections.map(c => {
    const srcId = typeof c.source === 'object' ? c.source.id : c.source;
    const tgtId = typeof c.target === 'object' ? c.target.id : c.target;
    const neighborId = srcId === selectedNode.id ? tgtId : srcId;
    const cat = categories.find(cat => cat.id === neighborId);
    if (cat) return { id: cat.id, name: cat.name, type: 'category' as const, linkType: c.type, categoryName: cat.name };
    const learn = learnings.find(l => l.id === neighborId);
    if (learn) {
      const parentCat = categories.find(cat => cat.id === learn.primary_category_id);
      return { 
        id: learn.id, 
        name: learn.title, 
        type: 'entry' as const, 
        linkType: c.type, 
        categoryName: parentCat ? parentCat.name : 'Unknown' 
      };
    }
    return { id: neighborId, name: 'Unknown Node', type: 'entry' as const, linkType: c.type, categoryName: 'Unknown' };
  });

  const connectedIds = connectedNodes.map(n => n.id);
  const eligibleNodes = [
    ...categories.map(c => ({ id: c.id, name: c.name, type: 'category' })),
    ...learnings.map(l => ({ id: l.id, name: l.title, type: 'entry' })),
  ].filter(n => n.id !== selectedNode.id && !connectedIds.includes(n.id));

  const handleAddConnection = () => {
    if (!connTargetId) return;
    onAddConnection(selectedNode.id, connTargetId);
    setConnTargetId('');
    setShowAddConn(false);
  };

  const handleDelete = () => {
    if (isCategory) onDeleteCategory(selectedNode.id);
    else onDeleteLearning(selectedNode.id);
  };

  return (
    // Overlay container — absolute over the graph canvas
    <div className="absolute top-0 right-0 h-full pointer-events-none flex items-start justify-end z-20 p-3">
      <div
        className="pointer-events-auto w-[360px] max-h-full flex flex-col overflow-hidden rounded-xl"
        style={{
          background: 'rgba(10, 10, 12, 0.72)',
          backdropFilter: 'blur(20px) saturate(180%)',
          WebkitBackdropFilter: 'blur(20px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Inner scroll area */}
        <div className="overflow-y-auto flex flex-col gap-4 p-5">

          {/* Header */}
          <div className="flex items-center justify-between">
            <span
              className="text-[10px] px-2.5 py-1 rounded-full font-bold uppercase tracking-widest border"
              style={{
                background: `${nodeColor}15`,
                color: nodeColor,
                borderColor: `${nodeColor}30`,
              }}
            >
              {selectedNode.type}
            </span>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors cursor-pointer rounded-full p-1 hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Title & Meta */}
          <div
            className="flex flex-col gap-2 pb-4"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}
          >
            <h1 className="text-lg font-bold text-white leading-snug">
              {selectedNode.name}
            </h1>

            {!isCategory && learningData && (
              <div className="flex flex-col gap-1.5 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" /> Logged on: {learningData.date}
                </div>
                {learningData.primary_category_id && (
                  <div
                    onClick={() => onSelectNodeById(learningData.primary_category_id)}
                    className="flex items-center gap-1.5 cursor-pointer hover:underline"
                    style={{ color: nodeColor }}
                  >
                    <Tag className="h-3.5 w-3.5" /> Category: {selectedNode.category_name}
                  </div>
                )}
              </div>
            )}

            {isCategory && categoryData?.description && (
              <p className="text-xs italic" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {categoryData.description}
              </p>
            )}
          </div>

          {/* Markdown Content for Learning Entry */}
          {!isCategory && learningData && (
            <div className="flex flex-col gap-2 pb-4" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white/40 flex items-center gap-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-brand" /> Notes
                </span>
                <button
                  onClick={() => setIsFullscreenMarkdown(true)}
                  className="text-[10px] text-brand hover:text-brand/80 font-bold uppercase flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Maximize2 className="h-3 w-3" /> Full Screen
                </button>
              </div>
              <div className="markdown-body max-h-64 overflow-y-auto pr-1">
                <ReactMarkdown components={markdownComponents}>{learningData.content}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Connected Nodes */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span
                className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                <LinkIcon className="h-3.5 w-3.5" /> Connected Nodes ({connectedNodes.length})
              </span>
              <button
                onClick={() => setShowAddConn(!showAddConn)}
                className="text-[10px] font-bold uppercase px-2 py-0.5 rounded cursor-pointer flex items-center gap-1 transition-all"
                style={{
                  color: '#a3e635',
                  border: '1px solid rgba(118,185,0,0.3)',
                  background: showAddConn ? 'rgba(118,185,0,0.1)' : 'transparent',
                }}
              >
                <Plus className="h-3 w-3" /> Connect
              </button>
            </div>

            {/* Add Connection Form */}
            {showAddConn && (
              <div
                className="flex flex-col gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <label className="text-[10px] font-bold uppercase" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Target Node
                </label>
                <select
                  className="tech-input text-xs h-8 py-0"
                  value={connTargetId}
                  onChange={(e) => setConnTargetId(e.target.value)}
                  style={{ background: 'rgba(0,0,0,0.4)' }}
                >
                  <option value="">-- Choose node --</option>
                  {eligibleNodes.map(n => (
                    <option key={n.id} value={n.id}>
                      [{n.type.toUpperCase()}] {n.name}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-end gap-2 mt-1">
                  <button
                    onClick={() => setShowAddConn(false)}
                    className="text-[10px] font-bold uppercase px-2 py-1 cursor-pointer transition-colors"
                    style={{ color: 'rgba(255,255,255,0.4)' }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddConnection}
                    disabled={!connTargetId}
                    className="text-[10px] bg-brand text-canvas font-bold uppercase px-3 py-1 rounded-[2px] cursor-pointer disabled:opacity-50"
                  >
                    Add Link
                  </button>
                </div>
              </div>
            )}

            {/* Connection Tags */}
            <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto pr-1">
              {connectedNodes.length === 0 ? (
                <span className="text-xs italic" style={{ color: 'rgba(255,255,255,0.3)' }}>
                  No connections in graph
                </span>
              ) : (
                connectedNodes.map(node => {
                  const connColor = getCategoryColor(node.categoryName);
                  return (
                    <div
                      key={node.id}
                      className="group flex items-center gap-1 pl-2 pr-1.5 py-1 text-xs transition-all rounded-md cursor-pointer animate-in fade-in duration-100"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: `1px solid ${connColor}25`,
                      }}
                    >
                      <button
                        onClick={() => onSelectNodeById(node.id)}
                        className="flex items-center gap-1 cursor-pointer font-medium text-left truncate max-w-[180px] transition-colors"
                        style={{ color: 'rgba(255,255,255,0.75)' }}
                        onMouseEnter={e => (e.currentTarget.style.color = connColor)}
                        onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.75)')}
                      >
                        {node.type === 'category' ? (
                          <Tag className="h-3 w-3 shrink-0" style={{ color: connColor }} />
                        ) : (
                          <BookOpen className="h-3 w-3 shrink-0" style={{ color: connColor }} />
                        )}
                        <span className="truncate">{node.name}</span>
                      </button>
                      <button
                        onClick={() => onRemoveConnection(selectedNode.id, node.id)}
                        className="ml-1 p-0.5 rounded transition-all cursor-pointer opacity-0 group-hover:opacity-100"
                        style={{ color: 'rgba(255,255,255,0.3)' }}
                        onMouseEnter={e => {
                          (e.currentTarget as HTMLElement).style.color = '#f87171';
                          (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)';
                        }}
                        onMouseLeave={e => {
                          (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)';
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }}
                        title="Remove connection"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div
            className="pt-3 mt-auto"
            style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          >
            {showDeleteConfirm ? (
              // Inline confirmation
              <div
                className="flex flex-col gap-2 p-3 rounded-lg"
                style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)' }}
              >
                <p className="text-xs font-bold" style={{ color: '#fca5a5' }}>
                  {isCategory
                    ? 'Delete this category and ALL its learning entries?'
                    : 'Delete this learning entry?'}
                </p>
                <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  This action cannot be undone.
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 text-[11px] font-bold uppercase py-1.5 rounded-md cursor-pointer transition-all"
                    style={{
                      color: 'rgba(255,255,255,0.5)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      background: 'transparent',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 text-[11px] font-bold uppercase py-1.5 rounded-md cursor-pointer transition-all flex items-center justify-center gap-1"
                    style={{
                      color: '#fff',
                      background: '#dc2626',
                      border: '1px solid rgba(220,38,38,0.5)',
                    }}
                  >
                    <Trash2 className="h-3 w-3" /> Confirm Delete
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-1.5 text-xs font-bold uppercase px-3 py-2 rounded-md cursor-pointer transition-all"
                  style={{
                    color: '#f87171',
                    border: '1px solid rgba(248,113,113,0.25)',
                    background: 'transparent',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(248,113,113,0.1)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.5)';
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                    (e.currentTarget as HTMLElement).style.borderColor = 'rgba(248,113,113,0.25)';
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>

                {!isCategory && (
                  <button
                    onClick={() => learningData && onEdit(learningData)}
                    className="btn-primary py-2 text-xs font-bold uppercase flex-1 justify-center cursor-pointer"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit Learning
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen Markdown Modal */}
      {isFullscreenMarkdown && !isCategory && learningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-md pointer-events-auto">
          <div
            className="w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden rounded-xl animate-in fade-in zoom-in-95 duration-200"
            style={{
              background: 'rgba(10, 10, 12, 0.85)',
              border: '1px solid rgba(255,255,255,0.1)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-brand font-bold uppercase tracking-widest">
                  Learning Notes
                </span>
                <h2 className="text-xl font-bold text-white leading-tight">
                  {selectedNode.name}
                </h2>
              </div>
              <button
                onClick={() => setIsFullscreenMarkdown(false)}
                className="text-white/40 hover:text-white transition-colors cursor-pointer rounded-full p-2 hover:bg-white/10"
                title="Close fullscreen view (Esc)"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-8 markdown-body text-zinc-200">
              <ReactMarkdown components={markdownComponents}>{learningData.content}</ReactMarkdown>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
