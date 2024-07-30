import { ID } from "@antv/graphlib";
import { Graph } from "../../types";

/**
 * TODO: The median method consistently performs better than the barycenter method and has a slight theoretical advantage
 */
export const barycenter = (g: Graph, movable: ID[]) => {
  return movable.map((v) => {
    const inV = g.getRelatedEdges(v, "in");
    if (!inV?.length) {
      return { v };
    }

    const result = { sum: 0, weight: 0 };
    inV?.forEach((e) => {
      // 入边的起点
      const nodeU = g.getNode(e.source)!;
      // 考虑边权重，order相当于当前节点的重心值？？？
      result.sum += e.data.weight! * nodeU.data.order!;
      result.weight += e.data.weight!;
    });
    return {
      v,
      // 重心计算：上一层与之相连节点重心值的平均值，但是考虑了边的权重，所以计算方法不同了
      barycenter: result.sum / result.weight,
      weight: result.weight,
    };
  });
};
