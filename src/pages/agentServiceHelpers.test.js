import assert from 'node:assert/strict';
import test from 'node:test';

import {
  appendExecutionEvent,
  closeEventSourceAfterError,
  formatExecutionEventTime,
  getCompletionPresentation,
  getExecutionEventIdentity,
  normalizeTaskEvent,
} from './agentServiceHelpers.js';

test('normalizeTaskEvent maps SSE snake_case fields and preserves execution event', () => {
  const executionEvent = {
    timestamp: '2026-08-25T10:15:30Z',
    node: 'content_agent',
    phase: 'completed',
    level: 'info',
    message: '内容生成完成',
    progress: 80,
  };

  assert.deepEqual(
    normalizeTaskEvent({
      status: 'completed',
      progress: 100,
      current_step: '完成',
      route_id: 42,
      execution_event: executionEvent,
      degraded: true,
    }),
    {
      status: 'completed',
      progress: 100,
      currentStep: '完成',
      routeId: 42,
      error: undefined,
      executionEvent,
      degraded: true,
    },
  );
});

test('appendExecutionEvent ignores payloads without an execution event', () => {
  const existing = [{ message: '已接收' }];

  assert.strictEqual(appendExecutionEvent(existing, { status: 'processing' }), existing);
});

test('getExecutionEventIdentity prefers event_id', () => {
  assert.equal(
    getExecutionEventIdentity({
      event_id: 'event-42',
      timestamp: '2026-08-25T10:15:30Z',
      node: 'content_agent',
      phase: 'completed',
      message: '内容生成完成',
    }),
    'id:event-42',
  );
});

test('getExecutionEventIdentity falls back to stable event fields', () => {
  assert.equal(
    getExecutionEventIdentity({
      timestamp: '2026-08-25T10:15:30Z',
      node: 'content_agent',
      phase: 'completed',
      message: '内容生成完成',
    }),
    'fallback:2026-08-25T10:15:30Z\u0000content_agent\u0000completed\u0000内容生成完成',
  );
});

test('appendExecutionEvent deduplicates replayed event_id while keeping receive order', () => {
  const first = { event_id: 'event-1', timestamp: '2026-08-25T10:15:31Z', message: '先收到' };
  const second = { event_id: 'event-2', timestamp: '2026-08-25T10:15:30Z', message: '后收到' };

  const events = appendExecutionEvent(
    appendExecutionEvent(
      appendExecutionEvent([], { executionEvent: first }),
      { executionEvent: second },
    ),
    { executionEvent: { ...first, message: '重放内容不同也以 event_id 为准' } },
  );

  assert.deepEqual(events, [first, second]);
});

test('appendExecutionEvent deduplicates replayed event without event_id', () => {
  const event = {
    timestamp: '2026-08-25T10:15:30Z',
    node: 'content_agent',
    phase: 'completed',
    message: '内容生成完成',
  };
  const existing = [event];

  assert.strictEqual(appendExecutionEvent(existing, { executionEvent: { ...event } }), existing);
});

test('closeEventSourceAfterError closes a CONNECTING source before marking it disconnected', () => {
  const calls = [];
  const eventSource = {
    readyState: 0,
    close: () => calls.push('close'),
  };

  closeEventSourceAfterError(eventSource, () => calls.push('disconnected'));

  assert.deepEqual(calls, ['close', 'disconnected']);
});

test('getCompletionPresentation distinguishes degraded completion', () => {
  assert.deepEqual(getCompletionPresentation({ status: 'completed', degraded: true }), {
    alertType: 'warning',
    label: '降级完成',
    message: '分析已完成，但部分步骤已降级',
  });
});

test('getCompletionPresentation labels normal completion', () => {
  assert.deepEqual(getCompletionPresentation({ status: 'completed', degraded: false }), {
    alertType: 'success',
    label: '已完成',
    message: '分析完成',
  });
});

test('formatExecutionEventTime displays a stable time value', () => {
  assert.equal(formatExecutionEventTime('2026-08-25T10:15:30Z', 'en-GB', 'UTC'), '10:15:30');
  assert.equal(formatExecutionEventTime(undefined), '--:--:--');
});
