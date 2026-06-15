#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const PROJ = '/home/timothy/Project/Arch-Mk2';
const TRACE_LOG = path.join(PROJ, 'ltm', 'store', 'traces.jsonl');
const LANGEFUSE_URL = process.env.LANGFUSE_URL || 'http://localhost:3000';
const LANGEFUSE_PK = process.env.LANGFUSE_PUBLIC_KEY || '';
const LANGEFUSE_SK = process.env.LANGFUSE_SECRET_KEY || '';
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME || 'kiro-agent';

class Tracer {
  constructor() {
    this.traces = {};
    this.activeSpans = {};
    this.spanIdCounter = 0;
    this.traceIdCounter = 0;
  }

  _ensureDir() {
    const dir = path.dirname(TRACE_LOG);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _nextSpanId() {
    return `span_${++this.spanIdCounter}_${Date.now()}`;
  }

  _nextTraceId() {
    return `trace_${++this.traceIdCounter}_${Date.now()}`;
  }

  _now() {
    return new Date().toISOString();
  }

  _timestampMs() {
    return Date.now();
  }

  startTrace(name, attributes = {}) {
    const traceId = this._nextTraceId();
    this.traces[traceId] = {
      trace_id: traceId,
      name,
      service: OTEL_SERVICE_NAME,
      started_at: this._now(),
      attributes,
      spans: []
    };
    return traceId;
  }

  startSpan(traceId, name, parentSpanId = null, attributes = {}) {
    const spanId = this._nextSpanId();
    const span = {
      trace_id: traceId,
      span_id: spanId,
      parent_span_id: parentSpanId,
      name,
      started_at: this._now(),
      started_ms: this._timestampMs(),
      attributes: { ...attributes },
      events: [],
      status: 'ok'
    };
    this.activeSpans[spanId] = span;
    return spanId;
  }

  addEvent(spanId, eventName, attributes = {}) {
    const span = this.activeSpans[spanId];
    if (!span) return;
    span.events.push({
      name: eventName,
      at: this._now(),
      attributes
    });
  }

  endSpan(spanId, status = 'ok', attributes = {}) {
    const span = this.activeSpans[spanId];
    if (!span) return null;
    span.ended_at = this._now();
    span.duration_ms = this._timestampMs() - span.started_ms;
    span.status = status;
    Object.assign(span.attributes, attributes);
    const trace = this.traces[span.trace_id];
    if (trace) {
      trace.spans.push(span);
    }
    delete this.activeSpans[spanId];
    return span;
  }

  endTrace(traceId, status = 'ok', attributes = {}) {
    const trace = this.traces[traceId];
    if (!trace) return null;
    trace.ended_at = this._now();
    trace.status = status;
    Object.assign(trace.attributes, attributes);
    this._persistTrace(trace);
    this._sendToLangfuse(trace);
    delete this.traces[traceId];
    return trace;
  }

  _persistTrace(trace) {
    try {
      this._ensureDir();
      const line = JSON.stringify(trace);
      fs.appendFileSync(TRACE_LOG, line + '\n');
    } catch (err) {
      console.error(`[tracer] Persist failed: ${err.message}`);
    }
  }

  async _sendToLangfuse(trace) {
    if (!LANGEFUSE_PK || !LANGEFUSE_SK) return;
    try {
      const body = {
        traceId: trace.trace_id,
        name: trace.name,
        timestamp: trace.started_at,
        tags: [trace.service, trace.status],
        metadata: trace.attributes,
        spans: trace.spans.map(s => ({
          spanId: s.span_id,
          parentSpanId: s.parent_span_id,
          name: s.name,
          startTime: s.started_at,
          endTime: s.ended_at,
          duration: s.duration_ms,
          status: s.status,
          metadata: s.attributes,
          events: s.events
        }))
      };
      const auth = Buffer.from(`${LANGEFUSE_PK}:${LANGEFUSE_SK}`).toString('base64');
      const res = await fetch(`${LANGEFUSE_URL}/api/public/traces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${auth}`
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) {
        console.error(`[tracer] Langfuse push failed: ${res.status}`);
      }
    } catch (err) {
      console.error(`[tracer] Langfuse error: ${err.message}`);
    }
  }

  searchTraces(query = {}, limit = 20) {
    try {
      this._ensureDir();
      if (!fs.existsSync(TRACE_LOG)) return [];
      const raw = fs.readFileSync(TRACE_LOG, 'utf8').trim();
      if (!raw) return [];
      const lines = raw.split('\n').filter(Boolean);
      const results = [];
      for (let i = lines.length - 1; i >= 0 && results.length < limit; i--) {
        try {
          const trace = JSON.parse(lines[i]);
          if (query.name && !trace.name.includes(query.name)) continue;
          if (query.status && trace.status !== query.status) continue;
          results.push(trace);
        } catch {}
      }
      return results;
    } catch {
      return [];
    }
  }

  getStats() {
    try {
      this._ensureDir();
      if (!fs.existsSync(TRACE_LOG)) return { total_traces: 0, total_spans: 0, by_status: {} };
      const raw = fs.readFileSync(TRACE_LOG, 'utf8').trim();
      if (!raw) return { total_traces: 0, total_spans: 0, by_status: {} };
      const lines = raw.split('\n').filter(Boolean);
      const byStatus = {};
      let totalSpans = 0;
      for (const line of lines) {
        try {
          const t = JSON.parse(line);
          byStatus[t.status] = (byStatus[t.status] || 0) + 1;
          totalSpans += (t.spans || []).length;
        } catch {}
      }
      return { total_traces: lines.length, total_spans: totalSpans, by_status: byStatus };
    } catch {
      return { total_traces: 0, total_spans: 0, by_status: {} };
    }
  }
}

const tracer = new Tracer();
module.exports = { tracer, Tracer };
