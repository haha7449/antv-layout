import { Graph, ID } from "@antv/graphlib";
import { EdgeData, Graph as IGraph, NodeData } from "../../types";

/*
 * Constructs a graph that can be used to sort a layer of nodes. The graph will
 * contain all base and subgraph nodes from the request layer in their original
 * hierarchy and any edges that are incident on these nodes and are of the type
 * requested by the "relationship" parameter.
 *
 * Nodes from the requested rank that do not have parents are assigned a root
 * node in the output graph, which is set in the root graph attribute. This
 * makes it easy to walk the hierarchy of movable nodes during ordering.
 *
 * Pre-conditions:
 *
 *    1. Input graph is a DAG
 *    2. Base nodes in the input graph have a rank attribute
 *    3. Subgraph nodes in the input graph has minRank and maxRank attributes
 *    4. Edges have an assigned weight
 *
 * Post-conditions:
 *
 *    1. Output graph has all nodes in the movable rank with preserved
 *       hierarchy.
 *    2. Root nodes in the movable layer are made children of the node
 *       indicated by the root attribute of the graph.
 *    3. Non-movable nodes incident on movable nodes, selected by the
 *       relationship parameter, are included in the graph (without hierarchy).
 *    4. Edges incident on movable nodes, selected by the relationship
 *       parameter, are added to the output graph.
 *    5. The weights for copied edges are aggregated as need, since the output
 *       graph is not a multi-graph.
 */
/**
 * 生成的两层图一定是一个有多个根节点的树结构
 * 后续思路都是基于树
 */
export const buildLayerGraph = (
  g: IGraph,
  rank: number,
  direction: "in" | "out"
) => {
  const root = createRootNode(g);
  const result = new Graph<NodeData, EdgeData>({
    tree: [
      {
        id: root,
        children: [],
        data: {},
      },
    ],
  });

  g.getAllNodes().forEach((v) => {
    // 刚刚搜了下，似乎只有分层算法中network-simplex这个设置了parent，其他都没有设置
    const parent = g.getParent(v.id);

    // 对层级为rank的节点进行遍历生成layermap
    if (
      v.data.rank === rank ||
      // 这是未开发的功能？？没看到设置 minRank 和 maxRank 的地方
      // 节点可能是子图，minRank和maxRank是子图的左右边界
      (v.data.minRank! <= rank && rank <= v.data.maxRank!)
    ) {
      if (!result.hasNode(v.id)) {
        result.addNode({ ...v });
      }

      // 设置parent，后续可能会用到
      if (parent?.id && !result.hasNode(parent?.id)) {
        result.addNode({ ...parent });
      }

      // 设置parent或者虚拟root
      result.setParent(v.id, parent?.id || root);

      // This assumes we have only short edges!
      g.getRelatedEdges(v.id, direction).forEach((e) => {
        const u = e.source === v.id ? e.target : e.source;
        if (!result.hasNode(u)) {
          result.addNode({ ...g.getNode(u) });
        }

        // 为什么是u的出边？？
        // 实际上处理时，没有区别是否有向，统一按照无向边处理
        const edge = result
          .getRelatedEdges(u, "out")
          .find(({ target }) => target === v.id);
        // 权重？？？
        const weight = edge !== undefined ? edge.data.weight! : 0;

        if (!edge) {
          result.addEdge({
            id: e.id,
            source: u,
            target: v.id,
            data: {
              weight: e.data.weight! + weight, // 此时weight必然为0，所以写不写无所谓
            },
          });
        }
        // 为什么会有这种情况，那这不是同一条边吗？？？
        // 应该是给出的数据中，可能会重复给出一条边，所以这里的处理就是把重复的边合并
        else {
          result.updateEdgeData(edge.id, {
            ...edge.data,
            weight: e.data.weight! + weight,
          });
        }
      });

      // console.log(v);

      // 说明是子图
      if (v.data.hasOwnProperty("minRank")) {
        result.updateNodeData(v.id, {
          ...v.data,
          borderLeft: (v.data.borderLeft as ID[])[rank],
          borderRight: (v.data.borderRight as ID[])[rank],
        });
      }
    }
  });

  return result;
};

const createRootNode = (g: IGraph) => {
  let v;
  // 生成唯一id的节点
  while (g.hasNode((v = `_root${Math.random()}`)));
  return v;
};
