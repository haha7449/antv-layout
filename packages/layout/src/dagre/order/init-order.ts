import { ID } from "@antv/graphlib";
import { Graph } from "../../types";

/*
 * Assigns an initial order value for each node by performing a DFS search
 * starting from nodes in the first rank. Nodes are assigned an order in their
 * rank as they are first visited.
 *
 * This approach comes from Gansner, et al., "A Technique for Drawing Directed
 * Graphs."
 *
 * Returns a layering matrix with an array per layer and each layer sorted by
 * the order of its nodes.
 */
/**
 * 初始化节点order
 * 1. fixOrder：如果有nodeOrder，那么把里面的点先挑出来
 *    ----- 这也解释了为什么同一层级的节点，如果部分设置nodeOrder，那么没设置的就会后面处理，自然order放在后面了
 * 2.
 */
export const initOrder = (g: Graph) => {
  const visited: Record<string, boolean> = {};
  // const simpleNodes = g.getAllNodes().filter((v) => {
  //   return !g.getChildren(v.id)?.length;
  // });
  const simpleNodes = g.getAllNodes();
  // 还可以这样计算最大值！多用函数
  const nodeRanks = simpleNodes.map((v) => v.data.rank! ?? -Infinity);
  const maxRank = Math.max(...nodeRanks);

  // layers初始化
  const layers: ID[][] = [];
  for (let i = 0; i < maxRank + 1; i++) {
    layers.push([]);
  }

  // 升序
  const orderedVs = simpleNodes.sort(
    (a, b) => g.getNode(a.id).data.rank! - g.getNode(b.id).data.rank!
  );
  // const orderedVs = _.sortBy(simpleNodes, function(v) { return g.node(v)!.rank; });

  // 有fixOrder的，直接排序好放进去
  // fixorder是什么？？？和nodeOrder对应吗？？？感觉是
  const beforeSort = orderedVs.filter((n) => {
    return g.getNode(n.id).data.fixorder !== undefined;
  });
  const fixOrderNodes = beforeSort.sort(
    (a, b) => g.getNode(a.id).data.fixorder! - g.getNode(b.id).data.fixorder!
  );
  fixOrderNodes?.forEach((n) => {
    if (!isNaN(g.getNode(n.id).data.rank!)) {
      layers[g.getNode(n.id).data.rank!].push(n.id);
    }
    visited[n.id] = true;
  });

  // 先按照目前节点默认一个order
  // 所以开始节点根据rank来排序有什么用？？会提升性能吗？？好像会。。。。
  orderedVs?.forEach((n) =>
    g.dfsTree(n.id, (node) => {
      if (visited.hasOwnProperty(node.id)) return true; // 。。。为啥又突然hasOwnProperty这样写
      visited[node.id] = true;
      if (!isNaN(node.data.rank!)) {
        layers[node.data.rank!].push(node.id);
      }
    })
  );

  return layers;
};
