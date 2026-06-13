export interface Category {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface LearningEntry {
  id: string;
  title: string;
  content: string;
  date: string;
  primary_category_id: string;
  created_at: string;
}

export interface Connection {
  id: string;
  source_id: string;
  target_id: string;
  type: string;
  created_at: string;
}

export interface GraphNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  type: 'category' | 'entry';
  category_name?: string;
  date?: string;
}

export interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  source: string | GraphNode;
  target: string | GraphNode;
  type: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}
