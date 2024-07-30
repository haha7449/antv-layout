import { slack } from "./util";
import { minBy } from "../util";
import { Edge, Graph, ID } from "@antv/graphlib";
import { EdgeData, Graph as IGraph } from "../../types";

// 和求最短路径思路有点类似，比如松弛这个概念
/*
 * Constructs a spanning tree with tight edges and adjusted the input node's
 * ranks to achieve this. A tight edge is one that is has a length that matches
 * its "minlen" attribute.
 *
 * The basic structure for this function is derived from Gansner, et al., "A
 * Technique for Drawing Directed Graphs."
 *
 * Pre-conditions:
 *
 *    1. Graph must be a DAG.
 *    2. Graph must be connected.
 *    3. Graph must have at least one node.
 *    5. Graph nodes must have been previously assigned a "rank" property that
 *       respects the "minlen" property of incident edges.
 *    6. Graph edges must have a "minlen" property.
 *
 * Post-conditions:
 *
 *    - Graph nodes will have their rank adjusted to ensure that all edges are
 *      tight.
 *
 * Returns a tree (undirected graph) that is constructed using only "tight"
 * edges.
 */
const feasibleTree = (g: IGraph) => {
  const t = new Graph({
    tree: [],
  });

  // Choose arbitrary node from which to start our tree
  const start = g.getAllNodes()[0];
  const size = g.getAllNodes().length;
  t.addNode(start);

  let edge: Edge<EdgeData>;
  let delta: number;
  // 紧致图种如果包含所有点，则说明所有边都紧致完成，结束循环
  while (tightTree(t, g) < size) {
    // 寻找与当前紧致图连接的最小松弛边
    edge = findMinSlackEdge(t, g);
    // 如果source在紧致图中，那么target必然不在，此时可以理解为紧致图在左，target在右，所以紧致图需要+才能靠近，即正数
    // 反之，说明target在，source不在，那么就是source在左，紧致图在右，所以需要-才能靠近source，即负数
    delta = t.hasNode(edge.source) ? slack(g, edge) : -slack(g, edge);
    // 改变相关点层级（靠近过程）
    shiftRanks(t, g, delta);
  }

  return t;
};

/*
 * Finds a maximal tree of tight edges and returns the number of nodes in the
 * tree.
 */
// 当前最小紧致图：获取其种组成的点、边
const tightTree = (t: IGraph, g: IGraph) => {
  const dfs = (v: ID) => {
    g.getRelatedEdges(v, "both").forEach((e) => {
      const edgeV = e.source;
      const w = v === edgeV ? e.target : edgeV; // 最终w、v，一个表示target、一个表示source
      // slack = 0，无法再紧致的边
      if (!t.hasNode(w) && !slack(g, e)) {
        t.addNode({
          id: w,
          data: {},
        });
        // 为什么这么确定source就是v？
        // 其实不确定，但是不会紧致的效果
        // 紧致时，其实是否是有向图没有关系，统一看成无向图
        t.addEdge({
          id: e.id,
          source: v,
          target: w,
          data: {},
        });
        dfs(w);
      }
    });
  };

  t.getAllNodes().forEach((n) => dfs(n.id));
  return t.getAllNodes().length;
};

/*
 * Constructs a spanning tree with tight edges and adjusted the input node's
 * ranks to achieve this. A tight edge is one that is has a length that matches
 * its "minlen" attribute.
 *
 * The basic structure for this function is derived from Gansner, et al., "A
 * Technique for Drawing Directed Graphs."
 *
 * Pre-conditions:
 *
 *    1. Graph must be a DAG.
 *    2. Graph must be connected.
 *    3. Graph must have at least one node.
 *    5. Graph nodes must have been previously assigned a "rank" property that
 *       respects the "minlen" property of incident edges.
 *    6. Graph edges must have a "minlen" property.
 *
 * Post-conditions:
 *
 *    - Graph nodes will have their rank adjusted to ensure that all edges are
 *      tight.
 *
 * Returns a tree (undirected graph) that is constructed using only "tight"
 * edges.
 */
// 和feasibleTree一样，除了tightTreeWithLayer
const feasibleTreeWithLayer = (g: IGraph) => {
  const t = new Graph({ tree: [] });

  // Choose arbitrary node from which to start our tree
  const start = g.getAllNodes()[0];
  const size = g.getAllNodes().length;
  t.addNode(start);

  let edge: Edge<EdgeData>;
  let delta: number;
  while (tightTreeWithLayer(t, g)! < size) {
    edge = findMinSlackEdge(t, g);
    delta = t.hasNode(edge.source) ? slack(g, edge) : -slack(g, edge);
    shiftRanks(t, g, delta);
  }

  return t;
};

/*
 * Finds a maximal tree of tight edges and returns the number of nodes in the
 * tree.
 */
// 和tightTree只有一个区别，判断是否指定了layer
const tightTreeWithLayer = (t: IGraph, g: IGraph) => {
  const dfs = (v: ID) => {
    g.getRelatedEdges(v, "both")?.forEach((e) => {
      const edgeV = e.source;
      const w = v === edgeV ? e.target : edgeV;
      // 对于指定layer的，直接加入tight-tree，不参与调整
      if (
        !t.hasNode(w) &&
        (g.getNode(w)!.data.layer !== undefined || !slack(g, e))
      ) {
        t.addNode({
          id: w,
          data: {},
        });
        t.addEdge({
          id: e.id,
          source: v,
          target: w,
          data: {},
        });
        dfs(w);
      }
    });
  };

  t.getAllNodes().forEach((n) => dfs(n.id));
  return t.getAllNodes().length;
};

/*
 * Finds the edge with the smallest slack that is incident on tree and returns
 * it.
 */
const findMinSlackEdge = (t: IGraph, g: IGraph) => {
  // minBy找到可以被松弛的最小边
  return minBy(g.getAllEdges(), (e) => {
    // 要么source在紧致图中，要么target在
    // 如果都在则不需紧致
    // 如果都不在，也无需判断，还没轮到他们
    if (t.hasNode(e.source) !== t.hasNode(e.target)) {
      return slack(g, e);
    }
    return Infinity;
  });
};

// 所有紧致点加上delta空隙，相当于把当前紧致图和即将被紧致的边缩短
// 即拉近紧致点和紧致图的距离，拉近之后，满足条件的点自然成为了紧致图中的一个新节点
// 通过拉近点改变边长
const shiftRanks = (t: IGraph, g: IGraph, delta: number) => {
  t.getAllNodes().forEach((tn) => {
    const v = g.getNode(tn.id);
    if (!v.data.rank) v.data.rank = 0;
    v.data.rank! += delta;
  });
};

export { feasibleTree, feasibleTreeWithLayer };
