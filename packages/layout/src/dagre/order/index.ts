import { initOrder } from "./init-order";
import { crossCount } from "./cross-count";
import { buildLayerGraph } from "./build-layer-graph";
import { addSubgraphConstraints } from "./add-subgraph-constraints";
import { sortSubgraph } from "./sort-subgraph";
import { buildLayerMatrix, maxRank } from "../util";
import { Graph as IGraph } from "../../types";
import { Graph, ID } from "@antv/graphlib";
import { clone } from "@antv/util";

/*
 * Applies heuristics to minimize edge crossings in the graph and sets the best
 * order solution as an order attribute on each node.
 *
 * Pre-conditions:
 *
 *    1. Graph must be DAG
 *    2. Graph nodes must be objects with a "rank" attribute
 *    3. Graph edges must have the "weight" attribute
 *
 * Post-conditions:
 *
 *    1. Graph nodes will have an "order" attribute based on the results of the
 *       algorithm.
 */
export const order = (g: IGraph, keepNodeOrder?: boolean) => {
  const mxRank = maxRank(g);
  const range1 = [];
  const range2 = [];
  for (let i = 1; i < mxRank + 1; i++) range1.push(i); // [1, mxRank]
  for (let i = mxRank - 1; i > -1; i--) range2.push(i); // [0, mxRank - 1]
  const downLayerGraphs = buildLayerGraphs(g, range1, "in");
  const upLayerGraphs = buildLayerGraphs(g, range2, "out");

  // 初始化order
  let layering = initOrder(g); // layering中数组的索引表示节点的order
  assignOrder(g, layering);

  let bestCC = Number.POSITIVE_INFINITY;
  let best: string[][];
  // 为什么是4遍？？可能有什么科学证明
  for (let i = 0, lastBest = 0; lastBest < 4; ++i, ++lastBest) {
    sweepLayerGraphs(
      i % 2 ? downLayerGraphs : upLayerGraphs,
      i % 4 >= 2,
      false,
      keepNodeOrder
    );

    layering = buildLayerMatrix(g); // 按照order升序计算新的节点顺序
    const cc = crossCount(g, layering); // 交叉边个数
    if (cc < bestCC) {
      lastBest = 0; // 一旦是最佳的排序，验证4次排序中是否还是最优结果
      best = clone(layering);
      bestCC = cc;
    }
  }

  // g6新增特点：考虑之前的节点order
  // consider use previous result, maybe somewhat reduendant
  layering = initOrder(g);
  assignOrder(g, layering);
  for (let i = 0, lastBest = 0; lastBest < 4; ++i, ++lastBest) {
    sweepLayerGraphs(
      i % 2 ? downLayerGraphs : upLayerGraphs,
      i % 4 >= 2,
      true, // 只有这里，其他参数和步骤和之前一样。。。。
      keepNodeOrder
    );

    layering = buildLayerMatrix(g);
    const cc = crossCount(g, layering);
    if (cc < bestCC) {
      lastBest = 0;
      best = clone(layering);
      bestCC = cc;
    }
  }
  assignOrder(g, best!);
};

const buildLayerGraphs = (
  g: IGraph,
  ranks: number[],
  direction: "in" | "out"
) => {
  return ranks.map((rank) => {
    return buildLayerGraph(g, rank, direction);
  });
};

const sweepLayerGraphs = (
  layerGraphs: IGraph[],
  biasRight: boolean,
  usePrev?: boolean,
  keepNodeOrder?: boolean
) => {
  const cg = new Graph();
  layerGraphs?.forEach((lg) => {
    // const root = lg.graph().root as string;
    const root = lg.getRoots()[0].id;
    const sorted = sortSubgraph(
      lg,
      root,
      cg,
      biasRight,
      usePrev,
      keepNodeOrder
    );
    for (let i = 0; i < sorted.vs?.length || 0; i++) {
      const lnode = lg.getNode(sorted.vs[i]);
      if (lnode) {
        lnode.data.order = i;
      }
    }
    addSubgraphConstraints(lg, cg, sorted.vs);
  });
};

const assignOrder = (g: IGraph, layering: ID[][]) => {
  layering?.forEach((layer) => {
    layer?.forEach((v: ID, i: number) => {
      g.getNode(v).data.order = i;
    });
  });
};
