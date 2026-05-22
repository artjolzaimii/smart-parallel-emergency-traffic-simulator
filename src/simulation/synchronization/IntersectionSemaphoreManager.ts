/**
 * IntersectionSemaphoreManager
 *
 * Models intersections as critical sections using a counting semaphore.
 *
 * Academic mapping:
 *   • Each controlled intersection = a shared resource (critical section entry point)
 *   • capacity (default 1) = semaphore initial value
 *   • acquire() = P(s) / wait(s) — blocks if count would go negative
 *   • release() = V(s) / signal(s) — increments count, unblocks a waiter
 *
 * The semaphore check runs in the main thread AFTER the executor produces
 * new vehicle states. Vehicles that fail to acquire a permit are reverted
 * to their pre-tick state and positioned at the intersection node, visually
 * "waiting" to enter. On the next tick they try again.
 *
 * Implementation is deterministic and purely synchronous — no async needed
 * because the check runs between ticks, not concurrently with workers.
 */

import type { RoadEdge } from '../pathfinding/roadGraph';
import type { VehicleGraphState } from '../vehicles/VehicleGraphState';
import type { VehicleMarkerData } from '../../types/map';
import type { GeoPosition } from '../../types/simulation';

export interface SemaphoreMetrics {
  acquisitions: number;
  waits: number;
  blockedThisTick: number;
  controlledIntersections: number;
}

// djb2-style hash — deterministic node selection without random()
function stableHash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h;
}

export class IntersectionSemaphoreManager {
  // controlled: nodeId → capacity (max simultaneous vehicles)
  private readonly controlled: Map<string, number>;
  // held: nodeId → set of vehicleIds currently holding a permit
  private readonly held: Map<string, Set<string>> = new Map();
  // vehiclePermit: vehicleId → nodeId where it holds its current permit
  private readonly vehiclePermit: Map<string, string> = new Map();

  private acquisitions = 0;
  private waits = 0;
  private blockedThisTick = 0;

  constructor(nodeIds: string[], capacityPerIntersection = 1) {
    this.controlled = new Map();
    // Select ~15 % of nodes deterministically as controlled intersections
    for (const id of nodeIds) {
      if (stableHash(id) % 100 < 15) {
        this.controlled.set(id, capacityPerIntersection);
      }
    }
  }

  /**
   * applyConstraints — the semaphore gate, called once per tick.
   *
   * For every vehicle that crossed an intersection this tick:
   *   1. Release any permit it was holding (moved away from previous intersection).
   *   2. Attempt to acquire a permit for the new intersection.
   *   3. If at capacity → revert state + position (vehicle waits one tick).
   *   4. If acquired → record permit, continue.
   *
   * Vehicles already holding a permit (still near the entry of their edge)
   * release it once their progress on that edge exceeds 0.3 (clear of junction).
   */
  applyConstraints(
    prevStates: VehicleGraphState[],
    newStates: VehicleGraphState[],
    prevVehicles: VehicleMarkerData[],
    newVehicles: VehicleMarkerData[],
    edgesMap: Map<string, RoadEdge>,
  ): { vehicles: VehicleMarkerData[]; graphStates: VehicleGraphState[] } {
    this.blockedThisTick = 0;

    const prevStateMap  = new Map(prevStates.map((s) => [s.id, s]));
    const prevVehicleMap = new Map(prevVehicles.map((v) => [v.id, v]));

    const outVehicles: VehicleMarkerData[] = [];
    const outStates: VehicleGraphState[]   = [];

    for (let i = 0; i < newStates.length; i++) {
      const ns = newStates[i];
      const nv = newVehicles[i];
      const ps = prevStateMap.get(ns.id);
      const pv = prevVehicleMap.get(ns.id);

      // Emergency vehicle and vehicles without a prior state are exempt
      if (!ps || !pv || nv.isEmergency) {
        outVehicles.push(nv);
        outStates.push(ns);
        continue;
      }

      const crossedEdge = ns.edgeId !== ps.edgeId;

      if (crossedEdge) {
        // Release any permit the vehicle was holding at a previous intersection
        const prevNode = this.vehiclePermit.get(ns.id);
        if (prevNode) {
          this.held.get(prevNode)?.delete(ns.id);
          this.vehiclePermit.delete(ns.id);
        }

        // Try to acquire a permit for the new intersection
        const newEdge = edgesMap.get(ns.edgeId);
        const intersectionId = newEdge?.from;

        if (intersectionId && this.controlled.has(intersectionId)) {
          const capacity = this.controlled.get(intersectionId)!;
          let heldSet = this.held.get(intersectionId);
          if (!heldSet) {
            heldSet = new Set<string>();
            this.held.set(intersectionId, heldSet);
          }

          if (heldSet.size < capacity) {
            // ── acquire ──────────────────────────────────────────────
            heldSet.add(ns.id);
            this.vehiclePermit.set(ns.id, intersectionId);
            this.acquisitions++;
            outVehicles.push(nv);
            outStates.push(ns);
          } else {
            // ── blocked: revert (vehicle waits at intersection) ───────
            this.waits++;
            this.blockedThisTick++;

            // Position vehicle at the intersection node (end of previous edge)
            const prevEdge = edgesMap.get(ps.edgeId);
            const intersectionPos: GeoPosition =
              prevEdge?.coordinates?.length
                ? prevEdge.coordinates[prevEdge.coordinates.length - 1]
                : pv.position;

            outVehicles.push({ ...pv, position: intersectionPos });
            // Hold progress at 0.99 so the vehicle stays on its current edge
            outStates.push({ ...ps, progress: 0.99 });
          }
          continue;
        }
      }

      // Release permit once vehicle has moved well past the intersection
      const permittedNode = this.vehiclePermit.get(ns.id);
      if (permittedNode && ns.progress >= 0.3 && !crossedEdge) {
        this.held.get(permittedNode)?.delete(ns.id);
        this.vehiclePermit.delete(ns.id);
      }

      outVehicles.push(nv);
      outStates.push(ns);
    }

    return { vehicles: outVehicles, graphStates: outStates };
  }

  getMetrics(): SemaphoreMetrics {
    return {
      acquisitions: this.acquisitions,
      waits: this.waits,
      blockedThisTick: this.blockedThisTick,
      controlledIntersections: this.controlled.size,
    };
  }

  reset(): void {
    this.held.clear();
    this.vehiclePermit.clear();
    this.acquisitions = 0;
    this.waits = 0;
    this.blockedThisTick = 0;
  }
}
