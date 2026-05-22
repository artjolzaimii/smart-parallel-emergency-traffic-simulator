/**
 * EmergencyRequestQueue
 *
 * A first-in-first-out queue implementing the producer-consumer pattern.
 *
 * Academic mapping:
 *   • Producer: the WebSocket handler (user clicks "Trigger Emergency")
 *     — calls enqueue() from outside the tick loop
 *   • Consumer: the simulation engine tick
 *     — calls consume() once per tick, processes at most one request
 *   • The queue acts as the bounded buffer that decouples the two
 *
 * This mirrors OS-level producer-consumer queues where producers do not
 * block on capacity (the queue accepts all requests) and the consumer
 * drains one item per scheduling quantum (simulation tick).
 *
 * In a multi-process system this would need a mutex around enqueue/consume.
 * Here both run in the same Node.js thread so JS's single-threaded event
 * loop provides mutual exclusion naturally.
 */

export interface EmergencyRequest {
  readonly id: string;
  readonly enqueuedAtTick: number;
  readonly enqueuedAt: number; // wall-clock ms
}

export interface QueueMetrics {
  produced: number;
  consumed: number;
  pending: number;
}

export class EmergencyRequestQueue {
  private readonly buffer: EmergencyRequest[] = [];
  private produced = 0;
  private consumed = 0;

  /** Producer side — enqueue a new emergency dispatch request. */
  enqueue(tickNum: number): void {
    this.buffer.push({
      id: `req-${tickNum}-${this.produced}`,
      enqueuedAtTick: tickNum,
      enqueuedAt: Date.now(),
    });
    this.produced++;
  }

  /**
   * Consumer side — dequeue and return the oldest pending request.
   * Returns null if the queue is empty (nothing to process this tick).
   */
  consume(): EmergencyRequest | null {
    const req = this.buffer.shift();
    if (req) this.consumed++;
    return req ?? null;
  }

  /** Peek without consuming — useful for UI display. */
  peek(): EmergencyRequest | null {
    return this.buffer[0] ?? null;
  }

  getMetrics(): QueueMetrics {
    return {
      produced: this.produced,
      consumed: this.consumed,
      pending: this.buffer.length,
    };
  }

  reset(): void {
    this.buffer.length = 0;
    this.produced = 0;
    this.consumed = 0;
  }
}
