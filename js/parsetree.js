/**
 * Parse Tree and Derivation Generator
 * Constructs concrete syntax trees and formats leftmost derivation sequences.
 */

let nextNodeId = 1;

class ParseTreeNode {
  constructor(symbol, type = 'non-terminal', value = null, ruleUsed = null) {
    this.id = `node_${nextNodeId++}`;
    this.symbol = symbol; // e.g. "E", "id", "+"
    this.type = type;     // 'non-terminal', 'terminal', 'epsilon'
    this.value = value;   // token value if terminal, e.g. "x", "42"
    this.ruleUsed = ruleUsed; // production string
    this.children = [];
  }

  addChild(node) {
    this.children.push(node);
  }

  isLeaf() {
    return this.children.length === 0;
  }
}

class ParseTreeBuilder {
  constructor() {
    nextNodeId = 1;
    this.root = null;
  }

  reset() {
    nextNodeId = 1;
    this.root = null;
  }

  /**
   * Generates SVG representation of the Parse Tree
   */
  renderSVG(rootNode, containerWidth = 800) {
    if (!rootNode) return '<svg width="100%" height="100"><text x="50%" y="50" text-anchor="middle" fill="#888">No Parse Tree Available</text></svg>';

    // 1. Calculate positions using a tree layout algorithm
    const layout = this.computeTreeLayout(rootNode);
    const width = Math.max(containerWidth, layout.maxX + 80);
    const height = layout.maxY + 100;

    // 2. Generate SVG lines and nodes
    let svgContent = `<svg viewBox="0 0 ${width} ${height}" class="parse-tree-svg" xmlns="http://www.w3.org/2000/svg">`;
    svgContent += `<defs>
      <linearGradient id="ntGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#3b82f6" />
        <stop offset="100%" stop-color="#1d4ed8" />
      </linearGradient>
      <linearGradient id="termGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#10b981" />
        <stop offset="100%" stop-color="#047857" />
      </linearGradient>
      <linearGradient id="epsGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6b7280" />
        <stop offset="100%" stop-color="#4b5563" />
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.15"/>
      </filter>
    </defs>`;

    // Render edges first so they are behind nodes
    for (const edge of layout.edges) {
      svgContent += `<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="#cbd5e1" stroke-width="2" stroke-linecap="round" />`;
    }

    // Render nodes
    for (const n of layout.nodes) {
      const isNT = n.node.type === 'non-terminal';
      const isEps = n.node.type === 'epsilon';
      const fill = isNT ? 'url(#ntGrad)' : (isEps ? 'url(#epsGrad)' : 'url(#termGrad)');
      const stroke = isNT ? '#2563eb' : (isEps ? '#4b5563' : '#059669');
      const label = n.node.symbol;
      const subLabel = n.node.value && n.node.value !== label ? `"${n.node.value}"` : '';

      svgContent += `<g class="tree-node" transform="translate(${n.x}, ${n.y})" filter="url(#shadow)">`;
      svgContent += `<circle r="22" fill="${fill}" stroke="${stroke}" stroke-width="2"/>`;
      svgContent += `<text y="${subLabel ? -2 : 5}" text-anchor="middle" fill="#ffffff" font-size="13" font-weight="bold" font-family="system-ui, sans-serif">${label}</text>`;
      if (subLabel) {
        svgContent += `<text y="14" text-anchor="middle" fill="#e2e8f0" font-size="10" font-family="monospace">${subLabel}</text>`;
      }
      svgContent += `</g>`;
    }

    svgContent += `</svg>`;
    return svgContent;
  }

  computeTreeLayout(root) {
    const nodes = [];
    const edges = [];
    let curX = 40;
    const levelHeight = 70;
    const siblingDistance = 55;

    function postOrder(node, depth) {
      if (!node.children || node.children.length === 0) {
        const x = curX;
        curX += siblingDistance;
        return { node, x, y: 40 + depth * levelHeight, depth, children: [] };
      }

      const childLayouts = [];
      for (const child of node.children) {
        childLayouts.push(postOrder(child, depth + 1));
      }

      const firstX = childLayouts[0].x;
      const lastX = childLayouts[childLayouts.length - 1].x;
      const x = (firstX + lastX) / 2;

      return { node, x, y: 40 + depth * levelHeight, depth, children: childLayouts };
    }

    const layoutRoot = postOrder(root, 0);

    let maxX = 0;
    let maxY = 0;

    function collect(item) {
      nodes.push(item);
      if (item.x > maxX) maxX = item.x;
      if (item.y > maxY) maxY = item.y;

      for (const child of item.children) {
        edges.push({
          x1: item.x,
          y1: item.y + 20,
          x2: child.x,
          y2: child.y - 20
        });
        collect(child);
      }
    }

    collect(layoutRoot);

    return { nodes, edges, maxX, maxY };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ParseTreeNode, ParseTreeBuilder };
}
