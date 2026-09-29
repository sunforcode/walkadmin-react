import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

const source = (await readFile(new URL('./api.js', import.meta.url), 'utf8'))
  .replace("from 'axios'", `from '${import.meta.resolve('axios')}'`)
  .replace("from './kmzInput.js'", `from '${new URL('./kmzInput.js', import.meta.url).href}'`)
  .replaceAll('import.meta.env', '({})');
const { default: api, routeApi } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
globalThis.localStorage = { getItem: () => null };

function respond(config, data) {
  return { config, data: { success: true, data }, status: 200, statusText: 'OK', headers: {} };
}

const request = {
  candidate_id: 'candidate-1', expected_revision: 0, request_id: 'review-1',
  decision: 'approved', confirm_complete_hiking_range: true, reference_system: 'WGS84',
};

test('main track review reads the candidate through its explicit management endpoint', async () => {
  api.defaults.adapter = async (config) => {
    assert.equal(config.method, 'get');
    assert.equal(config.url, '/api/v1/routes/route-1/main-track-review');
    return respond(config, { route_id: 'route-1', candidate_id: 'candidate-1', review_revision: 0 });
  };
  assert.equal((await routeApi.getMainTrackReview('route-1')).candidate_id, 'candidate-1');
});

test('main track approval passes a fixed candidate and revision without publishing', async () => {
  let count = 0;
  api.defaults.adapter = async (config) => {
    count++;
    assert.equal(config.method, 'post');
    assert.equal(config.url, '/api/v1/routes/route-1/main-track-review');
    assert.deepEqual(JSON.parse(config.data), request);
    return respond(config, { route_id: 'route-1', candidate_id: 'candidate-1', review_revision: 1,
      review: { request_id: 'review-1', decision: 'approved' } });
  };
  const response = await routeApi.submitMainTrackReview('route-1', request);
  assert.equal(response.review.decision, 'approved');
  assert.equal(count, 1);
});

test('rejection preserves its reason and does not mark the candidate as a public track', async () => {
  const rejection = { ...request, decision: 'rejected', confirm_complete_hiking_range: false,
    reference_system: null, reason: '包含接驳车辆' };
  api.defaults.adapter = async (config) => {
    assert.deepEqual(JSON.parse(config.data), rejection);
    return respond(config, { review: { decision: 'rejected' }, published_main_track_availability: 'pending_review' });
  };
  assert.equal((await routeApi.submitMainTrackReview('route-1', rejection)).published_main_track_availability, 'pending_review');
});

test('review request helpers do not send invalid confirmations or coordinate systems', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => { calls++; return respond(config, {}); };
  for (const invalid of [
    { ...request, candidate_id: '' }, { ...request, expected_revision: -1 },
    { ...request, request_id: '' }, { ...request, confirm_complete_hiking_range: false },
    { ...request, reference_system: '' }, { ...request, decision: 'valid' },
    { ...request, decision: 'rejected', confirm_complete_hiking_range: false, reference_system: null, reason: ' ' },
  ]) {
    await assert.rejects(() => routeApi.submitMainTrackReview('route-1', invalid));
  }
  assert.equal(calls, 0);
});

test('stale review is surfaced instead of refreshing and automatically resubmitting', async () => {
  let calls = 0;
  api.defaults.adapter = async () => {
    calls++;
    throw { response: { status: 409, data: { message: '候选已变化' } } };
  };
  await assert.rejects(routeApi.submitMainTrackReview('route-1', request), (error) => error.response.status === 409);
  assert.equal(calls, 1);
});
