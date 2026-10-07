'use strict';

/**
 * Minimal Prometheus registry (counters + histograms) exposed at /metrics.
 * Avoids a dependency; names follow Prometheus conventions.
 */

function labelKey(labels = {}) {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}="${String(labels[k]).replace(/["\\\n]/g, '_')}"`).join(',');
}

function createMetrics() {
  const counters = new Map();
  const histos = new Map();
  const BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  return {
    inc(name, labels, by = 1) {
      const k = `${name}{${labelKey(labels)}}`;
      counters.set(k, (counters.get(k) || 0) + by);
    },
    observe(name, labels, seconds) {
      const lk = labelKey(labels);
      const k = `${name}|${lk}`;
      if (!histos.has(k)) histos.set(k, { name, lk, counts: BUCKETS.map(() => 0), sum: 0, count: 0 });
      const h = histos.get(k);
      BUCKETS.forEach((b, i) => { if (seconds <= b) h.counts[i]++; });
      h.sum += seconds;
      h.count++;
    },
    render() {
      const lines = [];
      for (const [k, v] of counters) lines.push(`${k.replace('{}', '')} ${v}`);
      for (const h of histos.values()) {
        const sep = h.lk ? `${h.lk},` : '';
        BUCKETS.forEach((b, i) => lines.push(`${h.name}_bucket{${sep}le="${b}"} ${h.counts[i]}`));
        lines.push(`${h.name}_bucket{${sep}le="+Inf"} ${h.count}`);
        lines.push(`${h.name}_sum${h.lk ? `{${h.lk}}` : ''} ${h.sum}`);
        lines.push(`${h.name}_count${h.lk ? `{${h.lk}}` : ''} ${h.count}`);
      }
      const mem = process.memoryUsage();
      lines.push(`process_resident_memory_bytes ${mem.rss}`);
      lines.push(`process_uptime_seconds ${Math.round(process.uptime())}`);
      return `${lines.join('\n')}\n`;
    },
    snapshot() {
      return Object.fromEntries(counters);
    },
  };
}

module.exports = { createMetrics };
