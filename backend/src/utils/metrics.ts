// ============================================
// Latency Metrics Tracker
// ============================================

export interface LatencyMetrics {
  stt: number;
  llm: number;
  tts: number;
  total: number;
}

export class MetricsTracker {
  private timestamps: Map<string, number> = new Map();
  private callSid: string;

  constructor(callSid: string) {
    this.callSid = callSid;
  }

  mark(event: string): void {
    this.timestamps.set(event, Date.now());
  }

  measure(from: string, to: string): number {
    const fromTime = this.timestamps.get(from);
    const toTime = this.timestamps.get(to);
    
    if (!fromTime || !toTime) {
      return 0;
    }
    
    return toTime - fromTime;
  }

  getLatencyMetrics(): LatencyMetrics {
    return {
      stt: this.measure('audio_received', 'transcript_ready'),
      llm: this.measure('transcript_ready', 'llm_complete'),
      tts: this.measure('llm_complete', 'audio_sent'),
      total: this.measure('audio_received', 'audio_sent'),
    };
  }

  reset(): void {
    this.timestamps.clear();
  }
}

// Global metrics collection
class MetricsCollector {
  private callMetrics: Map<string, MetricsTracker> = new Map();
  private latencyHistory: LatencyMetrics[] = [];
  private maxHistory = 1000;

  getTracker(callSid: string): MetricsTracker {
    let tracker = this.callMetrics.get(callSid);
    if (!tracker) {
      tracker = new MetricsTracker(callSid);
      this.callMetrics.set(callSid, tracker);
    }
    return tracker;
  }

  removeTracker(callSid: string): void {
    const tracker = this.callMetrics.get(callSid);
    if (tracker) {
      this.latencyHistory.push(tracker.getLatencyMetrics());
      if (this.latencyHistory.length > this.maxHistory) {
        this.latencyHistory.shift();
      }
    }
    this.callMetrics.delete(callSid);
  }

  getAverageLatency(): LatencyMetrics {
    if (this.latencyHistory.length === 0) {
      return { stt: 0, llm: 0, tts: 0, total: 0 };
    }

    const sum = this.latencyHistory.reduce(
      (acc, m) => ({
        stt: acc.stt + m.stt,
        llm: acc.llm + m.llm,
        tts: acc.tts + m.tts,
        total: acc.total + m.total,
      }),
      { stt: 0, llm: 0, tts: 0, total: 0 }
    );

    const count = this.latencyHistory.length;
    return {
      stt: Math.round(sum.stt / count),
      llm: Math.round(sum.llm / count),
      tts: Math.round(sum.tts / count),
      total: Math.round(sum.total / count),
    };
  }

  getActiveCallCount(): number {
    return this.callMetrics.size;
  }
}

export const metricsCollector = new MetricsCollector();
