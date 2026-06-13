import { useState, useEffect, useRef } from 'react';
import { 
  Network, CheckCircle2, AlertTriangle, RefreshCw, Database, RotateCcw,
  Search, Plus, Filter, Tag, BookOpen
} from 'lucide-react';

import { KnowledgeGraph } from './components/KnowledgeGraph';
import { Sidebar } from './components/Sidebar';
import { NodeForm } from './components/NodeForm';
import type { Category, LearningEntry, GraphNode, GraphLink, Connection } from './types';

const API_BASE = 'http://localhost:8000/api';

function App() {
  // Data States
  const [categories, setCategories] = useState<Category[]>([]);
  const [learnings, setLearnings] = useState<LearningEntry[]>([]);
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [connections, setConnections] = useState<Connection[]>([]);

  // UI / Interaction States
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showForm, setShowForm] = useState<'category' | 'learning' | null>(null);
  const [editingEntry, setEditingEntry] = useState<LearningEntry | null>(null);
  const resetZoomRef = useRef<(() => void) | null>(null);
  
  // Search and Visibility Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showCategories, setShowCategories] = useState(true);
  const [showLearnings, setShowLearnings] = useState(true);

  // Status States
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [apiConnected, setApiConnected] = useState(false);

  // 1. Fetch data from backend
  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Test backend connection
      const [catsRes, learnsRes, graphRes, connsRes] = await Promise.all([
        fetch(`${API_BASE}/categories`),
        fetch(`${API_BASE}/learnings`),
        fetch(`${API_BASE}/graph`),
        fetch(`${API_BASE}/connections`),
      ]);

      if (!catsRes.ok || !learnsRes.ok || !graphRes.ok || !connsRes.ok) {
        throw new Error('Failed to fetch data from the server');
      }

      const cats = await catsRes.json();
      const learns = await learnsRes.json();
      const graph = await graphRes.json();
      const conns = await connsRes.json();

      setCategories(cats);
      setLearnings(learns);
      setGraphData(graph);
      setConnections(conns);
      setApiConnected(true);
    } catch (err: any) {
      console.error(err);
      setError('Could not connect to the backend server. Please verify FastAPI is running on http://localhost:8000');
      setApiConnected(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Sync selected node when categories or learnings are updated
  useEffect(() => {
    if (selectedNode) {
      const stillExists = graphData.nodes.find(n => n.id === selectedNode.id);
      if (!stillExists) {
        setSelectedNode(null);
      } else {
        setSelectedNode(stillExists);
      }
    }
  }, [graphData]);

  // 2. Select node by ID (for sidebar tag clicks)
  const handleSelectNodeById = (id: string) => {
    const node = graphData.nodes.find(n => n.id === id);
    if (node) {
      setSelectedNode(node);
    }
  };

  // 3. Category actions
  const handleSaveCategory = async (catData: { name: string; description: string | null }) => {
    try {
      const res = await fetch(`${API_BASE}/categories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(catData),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || 'Failed to create category');
      }

      setShowForm(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Error creating category: ${err.message}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/categories/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete category');

      if (selectedNode?.id === id) setSelectedNode(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Error deleting category: ${err.message}`);
    }
  };

  // 4. Learning Log actions
  const handleSaveLearning = async (learnData: {
    title: string;
    content: string;
    date: string;
    primary_category_id: string;
    connected_node_ids: string[];
  }) => {
    try {
      let url = `${API_BASE}/learnings`;
      let method = 'POST';

      if (editingEntry) {
        url = `${API_BASE}/learnings/${editingEntry.id}`;
        method = 'PUT';
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(learnData),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.detail || 'Failed to save learning entry');
      }

      setShowForm(null);
      setEditingEntry(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Error saving learning log: ${err.message}`);
    }
  };

  const handleEditLearning = (entry: LearningEntry) => {
    setEditingEntry(entry);
    setShowForm('learning');
  };

  const handleDeleteLearning = async (id: string) => {
    try {
      const res = await fetch(`${API_BASE}/learnings/${id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete learning entry');

      if (selectedNode?.id === id) setSelectedNode(null);
      await loadAllData();
    } catch (err: any) {
      alert(`Error deleting learning log: ${err.message}`);
    }
  };

  // 5. Connection actions
  const handleAddConnection = async (sourceId: string, targetId: string) => {
    try {
      const isSrcCat = categories.some(c => c.id === sourceId);
      const isTgtCat = categories.some(c => c.id === targetId);
      let connType = 'entry-entry';
      if (isSrcCat && isTgtCat) connType = 'category-category';
      else if (isSrcCat || isTgtCat) connType = 'entry-category';

      const res = await fetch(`${API_BASE}/connections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_id: sourceId,
          target_id: targetId,
          type: connType,
        }),
      });

      if (!res.ok) throw new Error('Failed to add connection');

      await loadAllData();
    } catch (err: any) {
      alert(`Error adding connection: ${err.message}`);
    }
  };

  const handleRemoveConnection = async (sourceId: string, targetId: string) => {
    try {
      // Find the connection ID in our connections list
      const conn = connections.find(
        c =>
          (c.source_id === sourceId && c.target_id === targetId) ||
          (c.source_id === targetId && c.target_id === sourceId)
      );

      if (!conn) throw new Error('Connection not found in client state');

      const res = await fetch(`${API_BASE}/connections/${conn.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) throw new Error('Failed to delete connection');

      await loadAllData();
    } catch (err: any) {
      alert(`Error removing connection: ${err.message}`);
    }
  };

  return (
    <div className="w-full h-screen bg-canvas text-ink flex flex-col font-brand antialiased">
      {/* NVIDIA Styled Toolbar / Nav */}
      <header className="h-[64px] border-b border-hairline bg-surface-soft px-4 flex items-center justify-between gap-3 shrink-0 select-none">
        <div className="flex items-center gap-2.5 shrink-0">
          <Network className="h-5 w-5 text-brand" />
          <span className="text-sm font-bold uppercase tracking-wider text-white">
            Learning Archive <span className="text-brand">Graph</span>
          </span>
        </div>

        {/* Center: Search & Filter & Add actions */}
        <div className="flex-1 flex items-center justify-center gap-4 max-w-3xl">
          {/* Search Input */}
          <div className="relative w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-mute" />
            <input
              type="text"
              placeholder="Search nodes..."
              className="w-full tech-input pl-9"
              style={{ padding: '5px 10px 5px 32px', fontSize: '11px' }}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Filter Toggles */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-mute flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider">
              <Filter className="h-3.5 w-3.5" /> Filter:
            </span>
            
            <button
              onClick={() => setShowCategories(!showCategories)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase border rounded-[2px] transition-all cursor-pointer ${
                showCategories
                  ? 'bg-ink text-canvas border-ink'
                  : 'border-hairline text-body hover:border-brand'
              }`}
            >
              <Tag className="h-2.5 w-2.5" /> Categories
            </button>

            <button
              onClick={() => setShowLearnings(!showLearnings)}
              className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold uppercase border rounded-[2px] transition-all cursor-pointer ${
                showLearnings
                  ? 'bg-ink text-canvas border-ink'
                  : 'border-hairline text-body hover:border-brand'
              }`}
            >
              <BookOpen className="h-2.5 w-2.5" /> Learnings
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setShowForm('category')}
              className="btn-outline-secondary py-1 px-2.5 text-[11px] font-bold uppercase cursor-pointer"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <Plus className="h-3 w-3" /> Category
            </button>
            <button
              onClick={() => setShowForm('learning')}
              className="btn-primary py-1 px-2.5 text-[11px] font-bold uppercase cursor-pointer"
              style={{ padding: '4px 8px', fontSize: '11px' }}
            >
              <Plus className="h-3 w-3" /> Add Learning
            </button>
          </div>
        </div>
        
        {/* Status / Controls */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-1.5 text-[11px]">
            <Database className="h-3.5 w-3.5 text-mute" />
            <span className="text-mute font-bold uppercase tracking-wide">API:</span>
            {apiConnected ? (
              <span className="flex items-center gap-1 text-brand font-bold uppercase text-[10px]">
                <CheckCircle2 className="h-3 w-3" /> ONLINE
              </span>
            ) : (
              <span className="flex items-center gap-1 text-red-500 font-bold uppercase text-[10px]">
                <AlertTriangle className="h-3 w-3" /> OFFLINE
              </span>
            )}
          </div>

          <button
            onClick={() => resetZoomRef.current?.()}
            className="flex items-center gap-1 px-2 py-1 border border-hairline rounded-[2px] bg-canvas text-[11px] font-bold uppercase tracking-wider text-mute hover:text-brand hover:border-brand/30 transition-all cursor-pointer"
            title="Reset zoom to default view"
          >
            <RotateCcw className="h-3 w-3" />
            Reset Zoom
          </button>

          <button
            onClick={loadAllData}
            className="text-mute hover:text-white transition-colors cursor-pointer"
            title="Reload dataset"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 flex flex-col md:flex-row gap-4 p-4 overflow-hidden min-h-0 bg-canvas">
        {/* Loading Overlay */}
        {loading && (
          <div className="absolute inset-0 z-40 bg-canvas/60 backdrop-blur-xs flex items-center justify-center">
            <div className="flex items-center gap-3 border border-hairline bg-surface-soft p-4 rounded-[2px]">
              <RefreshCw className="h-5 w-5 text-brand animate-spin" />
              <span className="text-xs uppercase font-bold text-white tracking-wider">Syncing Database...</span>
            </div>
          </div>
        )}

        {/* Backend offline alert banner */}
        {error && !loading && (
          <div className="absolute top-20 left-1/2 -translate-x-1/2 z-40 w-full max-w-xl angular-card bg-red-950/20 border-red-500 p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
            <div className="flex-1 flex flex-col gap-1">
              <span className="text-xs font-bold uppercase text-red-500">Database Connection Failed</span>
              <p className="text-xs text-zinc-300 leading-normal">{error}</p>
              <button
                onClick={loadAllData}
                className="mt-2 text-left text-[10px] text-red-400 font-bold uppercase hover:underline cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Graph Area — full width */}
        <div className="flex-1 flex flex-col min-h-0">
          
          {/* Graph canvas with overlay panel */}
          <div className="flex-1 min-h-0 relative">
            <KnowledgeGraph
              data={graphData}
              selectedNode={selectedNode}
              onSelectNode={setSelectedNode}
              searchQuery={searchQuery}
              showCategories={showCategories}
              showLearnings={showLearnings}
              resetZoomRef={resetZoomRef}
            />

            {/* Glass overlay panel — appears on node click */}
            <Sidebar
              selectedNode={selectedNode}
              categories={categories}
              learnings={learnings}
              links={graphData.links}
              onClose={() => setSelectedNode(null)}
              onEdit={handleEditLearning}
              onDeleteCategory={handleDeleteCategory}
              onDeleteLearning={handleDeleteLearning}
              onSelectNodeById={handleSelectNodeById}
              onAddConnection={handleAddConnection}
              onRemoveConnection={handleRemoveConnection}
            />
          </div>
        </div>
      </main>

      {/* Popups Forms */}
      {showForm && (
        <NodeForm
          type={showForm}
          categories={categories}
          learnings={learnings}
          editingEntry={editingEntry}
          onCancel={() => {
            setShowForm(null);
            setEditingEntry(null);
          }}
          onSave={showForm === 'category' ? handleSaveCategory : handleSaveLearning}
        />
      )}
    </div>
  );
}

export default App;
