import { Edge, ID } from "@antv/graphlib";
import { EdgeData, Graph } from "../../types";

/*
 * Initializes ranks for the input graph using the longest path algorithm. This
 * algorithm scales well and is fast in practice, it yields rather poor
 * solutions. Nodes are pushed to the lowest layer possible, leaving the bottom
 * ranks wide and leaving edges longer than necessary. However, due to its
 * speed, this algorithm is good for getting an initial ranking that can be fed
 * into other algorithms.
 *
 * This algorithm does not normalize layers because it will be used by other
 * algorithms in most cases. If using this algorithm directly, be sure to
 * run normalize at the end.
 *
 * Pre-conditions:
 *
 *    1. Input graph is a DAG.
 *    2. Input graph node labels can be assigned properties.
 *
 * Post-conditions:
 *
 *    1. Each node will be assign an (unnormalized) "rank" property.
 */
const longestPath = (g: Graph) => {
  const visited: Record<ID, boolean> = {};

  const dfs = (v: ID) => {
    const label = g.getNode(v)!;
    if (!label) return 0;
    if (visited[v]) {
      return label.data.rank!;
    }
    visited[v] = true;

    let rank: number;

    g.getRelatedEdges(v, "out")?.forEach((e) => {
      const wRank = dfs(e.target);
      const minLen = e.data.minlen!;
      // 为什么是减？因为wRank最大值是0，所以往后只能是负的，所以是wRank-minLen
      const r = wRank - minLen;
      if (r) {
        if (rank === undefined || r < rank) {
          rank = r;
        }
      }
    });

    if (!rank!) {
      rank = 0;
    }

    label.data.rank = rank;
    return rank;
  };

  g.getAllNodes()
    .filter((n) => g.getRelatedEdges(n.id, "in").length === 0)
    .forEach((source) => dfs(source.id));
};

const longestPathWithLayer = (g: Graph) => {
  // 用longest path，找出最深的点
  const visited: Record<ID, boolean> = {};
  let minRank: number; // 最小层级

  const dfs = (v: ID) => {
    const label = g.getNode(v)!;
    if (!label) return 0;
    if (visited[v]) {
      return label.data.rank!;
    }
    visited[v] = true;

    let rank: number;

    g.getRelatedEdges(v, "out")?.forEach((e) => {
      const wRank = dfs(e.target);
      const minLen = e.data.minlen!;
      const r = wRank - minLen;
      if (r) {
        if (rank === undefined || r < rank) {
          rank = r;
        }
      }
    });

    if (!rank!) {
      rank = 0;
    }

    if (minRank === undefined || rank < minRank) {
      minRank = rank;
    }

    label.data.rank = rank;
    return rank;
  };

  g.getAllNodes()
    .filter((n) => g.getRelatedEdges(n.id, "in").length === 0)
    .forEach((source) => {
      if (source) dfs(source.id);
    });

  if (minRank! === undefined) {
    minRank = 0;
  }

  // minRank += 1; // NOTE: 最小的层级是dummy root，+1

  // forward一遍，赋值层级
  const forwardVisited: Record<string, boolean> = {};
  const dfsForward = (v: ID, nextRank: number) => {
    const label = g.getNode(v)!;

    // 如果节点指定了layer参数，那么就用指定的，否则就用默认的nextRank
    const currRank = !isNaN(label.data.layer!) ? label.data.layer! : nextRank;

    // 没有指定，取最大值
    // 注意：data.rank要么还没指定值，如果指定了值一定是 >= 0
    if (label.data.rank === undefined || label.data.rank! < currRank) {
      label.data.rank = currRank; // 选择层级大的，即靠近末端的层级
    }

    if (forwardVisited[v]) return;
    forwardVisited[v] = true;

    // DFS遍历子节点
    g.getRelatedEdges(v, "out")?.forEach((e) => {
      dfsForward(e.target, currRank + e.data.minlen!);
    });
  };

  // 指定层级的，更新下游
  g.getAllNodes().forEach((n) => {
    const label = n.data;
    if (!label) return;
    // 指定了layer，直接更新下游，否则被初始化rank
    if (!isNaN(label.layer!)) {
      dfsForward(n.id, label.layer!); // 默认的dummy root所在层的rank是-1
    } else {
      label.rank! -= minRank; // 变成正数，rank在dfsForward过程还可能被改变，这儿只是附初始值
    }
  });
};

/*
 * Returns the amount of slack for the given edge. The slack is defined as the
 * difference between the length of the edge and its minimum length.
 */
// tagert - source得到目前的层级间隔r，r-minLen（边长），那么就得到多余的间隙，即可以被松弛的长度
// 并且return一定是个正数，因为最长路径中计算之后target.rank > source.rank
const slack = (g: Graph, e: Edge<EdgeData>) => {
  return (
    g.getNode(e.target).data.rank! -
    g.getNode(e.source).data.rank! -
    e.data.minlen!
  );
};

export { longestPath, longestPathWithLayer, slack };
