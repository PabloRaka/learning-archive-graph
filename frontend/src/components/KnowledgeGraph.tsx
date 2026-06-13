import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { GraphNode, GraphLink, GraphData } from '../types';

interface KnowledgeGraphProps {
  data: GraphData;
  selectedNode: GraphNode | null;
  onSelectNode: (node: GraphNode | null) => void;
  searchQuery: string;
  showCategories: boolean;
  showLearnings: boolean;
  resetZoomRef?: React.MutableRefObject<(() => void) | null>;
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({
  data,
  selectedNode,
  onSelectNode,
  searchQuery,
  showCategories,
  showLearnings,
  resetZoomRef,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [selectedLink, setSelectedLink] = useState<GraphLink | null>(null);

  // Refs to D3 selections so highlight effect can access them without restarting simulation
  const nodeSelectionRef = useRef<d3.Selection<SVGGElement, GraphNode, SVGGElement, unknown> | null>(null);
  const linkSelectionRef = useRef<d3.Selection<SVGLineElement, GraphLink, SVGGElement, unknown> | null>(null);
  const filteredLinksRef = useRef<GraphLink[]>([]);
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  // Persists node positions (x, y, fx, fy) across simulation restarts so existing nodes
  // don't fly when new data arrives (e.g. after adding a category or learning entry).
  const nodePositionsRef = useRef<Map<string, { x: number; y: number; fx: number | null; fy: number | null }>>(new Map());

  // Clear selected link when selected node changes
  useEffect(() => {
    setSelectedLink(null);
  }, [selectedNode]);

  // 1. Handle resize
  useEffect(() => {
    if (!containerRef.current) return;
    const updateDimensions = () => {
      setDimensions({
        width: containerRef.current?.clientWidth || 800,
        height: containerRef.current?.clientHeight || 600,
      });
    };

    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // 2. Filter nodes and links based on toggles and search query
  // Wrapped in useMemo so array references only change when actual filter criteria change,
  // preventing the D3 simulation from restarting on unrelated re-renders (e.g. selectedNode change).
  const { filteredNodes, filteredLinks } = useMemo(() => {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const matchedNodeIds = new Set<string>();

    data.nodes.forEach(node => {
      if (node.type === 'category' && !showCategories) return;
      if (node.type === 'entry' && !showLearnings) return;

      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const nameMatch = node.name.toLowerCase().includes(query);
        const categoryMatch = node.category_name?.toLowerCase().includes(query);
        if (!nameMatch && !categoryMatch) return;
      }

      nodes.push({ ...node });
      matchedNodeIds.add(node.id);
    });

    data.links.forEach(link => {
      const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
      const targetId = typeof link.target === 'object' ? link.target.id : link.target;
      if (matchedNodeIds.has(sourceId) && matchedNodeIds.has(targetId)) {
        links.push({ source: sourceId, target: targetId, type: link.type });
      }
    });

    return { filteredNodes: nodes, filteredLinks: links };
  }, [data, searchQuery, showCategories, showLearnings]);

  // 3. Render and run D3 force simulation
  useEffect(() => {
    if (!svgRef.current || filteredNodes.length === 0) {
      // Clear SVG if empty
      d3.select(svgRef.current).selectAll('*').remove();
      return;
    }

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // ── SVG Defs: gradients, filters, markers ───────────────────────────────
    const defs = svg.append('defs');

    // Glow filter for selected / hovered nodes
    const glowFilter = defs.append('filter').attr('id', 'node-glow').attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const glowMerge = glowFilter.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'blur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Subtle glow for category nodes (always on)
    const catGlow = defs.append('filter').attr('id', 'cat-glow').attr('x', '-40%').attr('y', '-40%').attr('width', '180%').attr('height', '180%');
    catGlow.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    const catMerge = catGlow.append('feMerge');
    catMerge.append('feMergeNode').attr('in', 'blur');
    catMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Arrowhead marker for links
    defs.append('marker')
      .attr('id', 'arrow')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#444446');

    defs.append('marker')
      .attr('id', 'arrow-active')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 22)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#76b900');

    // Category node gradient
    const catGrad = defs.append('linearGradient')
      .attr('id', 'cat-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    catGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1c2a0a');
    catGrad.append('stop').attr('offset', '100%').attr('stop-color', '#0d1506');

    // Entry node gradient
    const entGrad = defs.append('linearGradient')
      .attr('id', 'ent-grad')
      .attr('x1', '0%').attr('y1', '0%')
      .attr('x2', '100%').attr('y2', '100%');
    entGrad.append('stop').attr('offset', '0%').attr('stop-color', '#1a1a1f');
    entGrad.append('stop').attr('offset', '100%').attr('stop-color', '#111114');

    // Container group for zooming
    const zoomGroup = svg.append('g').attr('class', 'zoom-container');

    // Zoom setup
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.15, 4])
      .on('zoom', (event) => {
        zoomGroup.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);
    zoomBehaviorRef.current = zoomBehavior;

    // Double-click on background only clears focus mode (zoom reset is now a button)
    svg.on('dblclick', (event) => {
      if (event.target === svgRef.current) {
        setFocusedNodeId(null);
      }
    });

    // 4. Force Simulation Setup
    // Restore saved positions for existing nodes so they don't fly on data refresh.
    // New nodes have no saved position — D3 places them near center automatically.
    filteredNodes.forEach(node => {
      const saved = nodePositionsRef.current.get(node.id);
      if (saved) {
        node.x = saved.x;
        node.y = saved.y;
        node.fx = saved.fx;
        node.fy = saved.fy;
      }
    });

    const simulation = d3.forceSimulation<GraphNode>(filteredNodes)
      .force('link', d3.forceLink<GraphNode, GraphLink>(filteredLinks)
        .id(d => d.id)
        .distance(d => {
          if (d.type === 'category-category') return 180;
          if (d.type === 'entry-category') return 110;
          return 80;
        })
      )
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius((d: any) => {
        return d.type === 'category' ? 80 : 55;
      }));

    // 5. Draw Links
    const link = zoomGroup.append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(filteredLinks)
      .enter()
      .append('line')
      .attr('class', 'graph-link')
      .attr('stroke', d => {
        if (d.type === 'category-category') return '#76b900';
        return '#3a3a3e';
      })
      .attr('stroke-opacity', d => {
        if (d.type === 'category-category') return 0.6;
        return 0.45;
      })
      .attr('stroke-width', d => {
        if (d.type === 'category-category') return 2;
        return 1.5;
      })
      .attr('stroke-dasharray', d => {
        if (d.type === 'entry-category') return '4,4';
        return 'none';
      })
      .attr('marker-end', 'url(#arrow)');

    // Animate individual link when clicked
    link.on('click', (event, d) => {
      event.stopPropagation();
      setSelectedLink(d);
      onSelectNode(null); // Deselect nodes when a link is clicked
    });

    // 6. Draw Nodes Group
    const node = zoomGroup.append('g')
      .attr('class', 'nodes')
      .selectAll('.node-group')
      .data(filteredNodes)
      .enter()
      .append('g')
      .attr('class', 'node-group')
      .style('cursor', 'pointer');

    // 7. Category nodes — pill card with icon badge
    const categoryNodes = node.filter((d: any) => d.type === 'category');

    const CAT_PX = 8.5;   // approx px per character at 13px bold
    const CAT_PAD = 36;   // horizontal padding (leaves room for icon)
    const CAT_H = 38;
    const CAT_ICON_W = 28; // width of left icon badge area

    // Shadow / glow backdrop rect (slightly larger)
    categoryNodes.append('rect')
      .attr('rx', 8)
      .attr('ry', 8)
      .attr('x', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2 - 2)
      .attr('y', -CAT_H / 2 - 2)
      .attr('width', (d: any) => d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W + 4)
      .attr('height', CAT_H + 4)
      .attr('fill', 'none')
      .attr('stroke', '#76b900')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.2)
      .attr('filter', 'url(#cat-glow)');

    // Main background rect
    categoryNodes.append('rect')
      .attr('rx', 7)
      .attr('ry', 7)
      .attr('x', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2)
      .attr('y', -CAT_H / 2)
      .attr('width', (d: any) => d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W)
      .attr('height', CAT_H)
      .attr('fill', 'url(#cat-grad)')
      .attr('stroke', '#76b900')
      .attr('stroke-width', 1.5)
      .attr('class', 'category-box');

    // Left icon badge strip
    categoryNodes.append('rect')
      .attr('rx', 7)
      .attr('ry', 7)
      .attr('x', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2)
      .attr('y', -CAT_H / 2)
      .attr('width', CAT_ICON_W)
      .attr('height', CAT_H)
      .attr('fill', '#76b900')
      .attr('fill-opacity', 0.15);

    // Clip the left strip so it fits inside the rounded rect border
    categoryNodes.append('rect')
      .attr('x', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2 + CAT_ICON_W)
      .attr('y', -CAT_H / 2)
      .attr('width', 1)
      .attr('height', CAT_H)
      .attr('fill', '#76b900')
      .attr('fill-opacity', 0.3);

    // Icon dot inside left badge
    categoryNodes.append('circle')
      .attr('cx', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2 + CAT_ICON_W / 2)
      .attr('cy', 0)
      .attr('r', 5)
      .attr('fill', '#76b900')
      .attr('fill-opacity', 0.9);

    // Category label
    categoryNodes.append('text')
      .text((d: any) => d.name)
      .attr('x', (d: any) => -(d.name.length * CAT_PX + CAT_PAD + CAT_ICON_W) / 2 + CAT_ICON_W + 10)
      .attr('dy', '0.35em')
      .attr('fill', '#a3e635')
      .attr('font-size', '13px')
      .attr('font-weight', '700')
      .attr('font-family', 'Inter, Arial, sans-serif')
      .attr('letter-spacing', '0.3px')
      .attr('class', 'category-text')
      .style('pointer-events', 'none');

    // 8. Entry nodes — pill badge with colored dot + label
    const entryNodes = node.filter((d: any) => d.type === 'entry');

    const ENT_PX = 7.5;
    const ENT_PAD = 28; // padding with dot space
    const ENT_H = 30;
    const ENT_DOT_R = 4;

    // Shadow ring
    entryNodes.append('rect')
      .attr('rx', ENT_H / 2)
      .attr('ry', ENT_H / 2)
      .attr('x', (d: any) => -(d.name.length * ENT_PX + ENT_PAD) / 2 - 2)
      .attr('y', -ENT_H / 2 - 2)
      .attr('width', (d: any) => d.name.length * ENT_PX + ENT_PAD + 4)
      .attr('height', ENT_H + 4)
      .attr('fill', 'none')
      .attr('stroke', '#4a4a52')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.5);

    // Main pill background
    entryNodes.append('rect')
      .attr('rx', ENT_H / 2)
      .attr('ry', ENT_H / 2)
      .attr('x', (d: any) => -(d.name.length * ENT_PX + ENT_PAD) / 2)
      .attr('y', -ENT_H / 2)
      .attr('width', (d: any) => d.name.length * ENT_PX + ENT_PAD)
      .attr('height', ENT_H)
      .attr('fill', 'url(#ent-grad)')
      .attr('stroke', '#3a3a42')
      .attr('stroke-width', 1.5)
      .attr('class', 'entry-circle');

    // Colored indicator dot
    entryNodes.append('circle')
      .attr('cx', (d: any) => -(d.name.length * ENT_PX + ENT_PAD) / 2 + 14)
      .attr('cy', 0)
      .attr('r', ENT_DOT_R)
      .attr('fill', '#60a5fa')
      .attr('fill-opacity', 0.85)
      .style('pointer-events', 'none');

    // Entry label text
    entryNodes.append('text')
      .text((d: any) => d.name)
      .attr('x', (d: any) => -(d.name.length * ENT_PX + ENT_PAD) / 2 + 25)
      .attr('dy', '0.35em')
      .attr('fill', '#d4d4d8')
      .attr('font-size', '12px')
      .attr('font-weight', '500')
      .attr('font-family', 'Inter, Arial, sans-serif')
      .attr('class', 'entry-text')
      .style('pointer-events', 'none');

    // 9. Highlight active selected node
    const updateHighlights = () => {
      // Category node: highlight border + glow
      node.selectAll('rect.category-box')
        .attr('stroke', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return '#a3e635';
          return '#76b900';
        })
        .attr('stroke-width', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return 2.5;
          return 1.5;
        })
        .attr('filter', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return 'url(#node-glow)';
          return 'url(#cat-glow)';
        });

      // Entry node pill: highlight border
      node.selectAll('rect.entry-circle')
        .attr('stroke', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return '#76b900';
          return '#3a3a42';
        })
        .attr('stroke-width', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return 2;
          return 1.5;
        })
        .attr('filter', (d: any) => {
          if (selectedNode && d.id === selectedNode.id) return 'url(#node-glow)';
          return null;
        });

      // Update active link flow animations
      link.classed('link-flow-active', (d: any) => {
        const srcId = typeof d.source === 'object' ? d.source.id : d.source;
        const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
        
        // Active if connected to selected node
        if (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) {
          return true;
        }
        
        // Active if link itself is selected
        if (selectedLink) {
          const selSrcId = typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source;
          const selTgtId = typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target;
          if (srcId === selSrcId && tgtId === selTgtId) {
            return true;
          }
        }
        return false;
      });

      // Focus Mode Opacities (when focusedNodeId is set)
      if (focusedNodeId) {
        // Find focused node neighbors
        const neighborIds = new Set<string>([focusedNodeId]);
        filteredLinks.forEach(l => {
          const srcId = typeof l.source === 'object' ? l.source.id : l.source;
          const tgtId = typeof l.target === 'object' ? l.target.id : l.target;
          if (srcId === focusedNodeId) neighborIds.add(tgtId);
          if (tgtId === focusedNodeId) neighborIds.add(srcId);
        });

        // Fade nodes
        node.style('opacity', (d: any) => neighborIds.has(d.id) ? 1 : 0.15);
        // Fade links
        link.style('opacity', (d: any) => {
          const sId = typeof d.source === 'object' ? d.source.id : d.source;
          const tId = typeof d.target === 'object' ? d.target.id : d.target;
          return neighborIds.has(sId) && neighborIds.has(tId) ? 1 : 0.08;
        });
      } else {
        node.style('opacity', 1);
        link.style('opacity', 1);
      }
    };

    // Store selections in refs so the separate highlight effect can access them
    nodeSelectionRef.current = node as any;
    linkSelectionRef.current = link as any;
    filteredLinksRef.current = filteredLinks;

    // Initial highlight pass
    updateHighlights();

    // 10. Dragging implementation (Locks position on drag)
    const drag = d3.drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        // Keep node pinned! Design choice: drag pinning
        d.fx = event.x;
        d.fy = event.y;
      });

    node.call(drag);

    // 11. Clicks & Double-Clicks
    node.on('click', (event, d) => {
      event.stopPropagation();
      onSelectNode(d);
    });

    node.on('dblclick', (event, d) => {
      event.stopPropagation();
      if (focusedNodeId === d.id) {
        setFocusedNodeId(null);
      } else {
        setFocusedNodeId(d.id);
        
        // Pan & Center focused node
        const scale = 1.2;
        const x = width / 2 - d.x! * scale;
        const y = height / 2 - d.y! * scale;
        
        svg.transition().duration(750).call(
          zoomBehavior.transform,
          d3.zoomIdentity.translate(x, y).scale(scale)
        );
      }
    });

    // Handle click on background to clear selection / focus
    svg.on('click', (event) => {
      if (event.target === svgRef.current) {
        onSelectNode(null);
        setSelectedLink(null);
        setFocusedNodeId(null);
      }
    });

    // 12. Simulation Tick Update
    simulation.on('tick', () => {
      // Save current positions so they survive the next simulation restart
      filteredNodes.forEach(d => {
        nodePositionsRef.current.set(d.id, {
          x: d.x ?? 0,
          y: d.y ?? 0,
          fx: d.fx ?? null,
          fy: d.fy ?? null,
        });
      });

      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    return () => {
      simulation.stop();
    };
    // NOTE: selectedNode and selectedLink are intentionally excluded from deps.
    // They are handled in a separate useEffect below to avoid restarting the simulation
    // (which would reset dragged node positions) on every selection change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredNodes, filteredLinks, dimensions, focusedNodeId]);

  // Highlight effect: runs when selection/focus changes, never rebuilds the simulation
  useEffect(() => {
    const node = nodeSelectionRef.current;
    const link = linkSelectionRef.current;
    if (!node || !link) return;

    // Category node: highlight border + glow
    node.selectAll('rect.category-box')
      .attr('stroke', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return '#a3e635';
        return '#76b900';
      })
      .attr('stroke-width', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return 2.5;
        return 1.5;
      })
      .attr('filter', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return 'url(#node-glow)';
        return 'url(#cat-glow)';
      });

    // Entry node pill: highlight border
    node.selectAll('rect.entry-circle')
      .attr('stroke', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return '#76b900';
        return '#3a3a42';
      })
      .attr('stroke-width', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return 2;
        return 1.5;
      })
      .attr('filter', (d: any) => {
        if (selectedNode && d.id === selectedNode.id) return 'url(#node-glow)';
        return null;
      });

    // Link flow animation
    link.classed('link-flow-active', (d: any) => {
      const srcId = typeof d.source === 'object' ? d.source.id : d.source;
      const tgtId = typeof d.target === 'object' ? d.target.id : d.target;
      if (selectedNode && (srcId === selectedNode.id || tgtId === selectedNode.id)) return true;
      if (selectedLink) {
        const selSrcId = typeof selectedLink.source === 'object' ? selectedLink.source.id : selectedLink.source;
        const selTgtId = typeof selectedLink.target === 'object' ? selectedLink.target.id : selectedLink.target;
        if (srcId === selSrcId && tgtId === selTgtId) return true;
      }
      return false;
    });
  }, [selectedNode, selectedLink]);

  // Pan to selected node when it changes
  useEffect(() => {
    if (!selectedNode || !svgRef.current) return;
    const matchedNode = filteredLinksRef.current
      ? (nodeSelectionRef.current?.data().find((n: any) => n.id === selectedNode.id) as GraphNode | undefined)
      : undefined;
    if (!matchedNode || matchedNode.x === undefined || matchedNode.y === undefined) return;

    const svg = d3.select(svgRef.current);
    const { width, height } = dimensions;
    const scale = 1.1;
    const x = width / 2 - matchedNode.x * scale;
    const y = height / 2 - matchedNode.y * scale;

    svg.transition().duration(500).call(
      d3.zoom<SVGSVGElement, unknown>().transform,
      d3.zoomIdentity.translate(x, y).scale(scale)
    );
  }, [selectedNode]);

  // Imperative reset zoom
  const handleResetZoom = useCallback(() => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    setFocusedNodeId(null);
    d3.select(svgRef.current)
      .transition()
      .duration(450)
      .call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
  }, []);

  // Expose the reset function to App.tsx
  useEffect(() => {
    if (resetZoomRef) {
      resetZoomRef.current = handleResetZoom;
    }
    return () => {
      if (resetZoomRef) {
        resetZoomRef.current = null;
      }
    };
  }, [resetZoomRef, handleResetZoom]);

  return (
    <div className="w-full h-full relative border border-hairline bg-canvas rounded-[2px]" ref={containerRef}>
      {filteredNodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-mute gap-2 select-none">
          <span className="text-sm uppercase tracking-wider font-bold">No Graph Nodes Match Active Filters</span>
          <span className="text-xs">Adjust your search query or add new category/learning logs.</span>
        </div>
      ) : (
        <svg ref={svgRef} className="w-full h-full block focus:outline-none" />
      )}

      {/* Bottom-left control strip */}
      <div className="absolute bottom-3 left-3 flex items-center gap-2 select-none">
        {/* Hint */}
        <span
          className="text-[9px] font-bold uppercase tracking-wider"
          style={{
            color: 'rgba(255,255,255,0.2)',
          }}
        >
          Dbl-click node · focus mode
        </span>
      </div>
    </div>
  );
};
