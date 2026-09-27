import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';

// Vite injects import.meta.env; use its default values in this Node harness.
const source = (await readFile(new URL('./api.js', import.meta.url), 'utf8'))
  .replace("from 'axios'", `from '${import.meta.resolve('axios')}'`)
  .replaceAll('import.meta.env', '({})');
const { default: api, routeApi } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
globalThis.localStorage = { getItem: () => null };

function respond(config, data) {
  return { config, data, status: 200, statusText: 'OK', headers: {} };
}

test('publication sends explicit public type and stable request identity then verifies public version', async () => {
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return respond(config, config.method === 'post'
      ? { success: true, data: { id: 'route-1', is_public: true, published_version_id: 'version-1' } }
      : { data: { routeId: 'route-1', currentVersion: { versionId: 'version-1' } } });
  };
  await routeApi.changeRouteStatus('route-1', 1, null, { public_route_type: 'multi_day', publication_id: 'request-1' });
  assert.deepEqual(JSON.parse(requests[0].data), {
    target_status: 1, reason: null, public_route_type: 'multi_day', publication_id: 'request-1',
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].url, '/api/v1/public-routes/route-1');
});

test('old status success without public membership is not publication success', async () => {
  api.defaults.adapter = async (config) => respond(config, { success: true, data: { id: 'route-1', status: 1 } });
  await assert.rejects(routeApi.changeRouteStatus('route-1', 1, null, {
    public_route_type: 'one_day', publication_id: 'request-2',
  }), /公开/);
});

test('different public version fails verification rather than claiming success', async () => {
  api.defaults.adapter = async (config) => respond(config, config.method === 'post'
    ? { success: true, data: { id: 'route-1', is_public: true, published_version_id: 'version-1' } }
    : { data: { routeId: 'route-1', currentVersion: { versionId: 'version-other' } } });
  await assert.rejects(routeApi.changeRouteStatus('route-1', 1, null, {
    public_route_type: 'one_day', publication_id: 'request-3',
  }), /版本/);
});

test('missing explicit public type fails before making a request', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => { calls++; return respond(config, {}); };
  await assert.rejects(routeApi.changeRouteStatus('route-1', 1), /类型/);
  assert.equal(calls, 0);
});

test('withdrawal does not perform public detail verification', async () => {
  const requests = [];
  api.defaults.adapter = async (config) => {
    requests.push(config);
    return respond(config, { success: true, data: { id: 'route-1', is_public: false } });
  };
  await routeApi.changeRouteStatus('route-1', 0);
  assert.equal(requests.length, 1);
  assert.deepEqual(JSON.parse(requests[0].data), { target_status: 0, reason: null });
});

test('file selection uploads KML and retains the returned durable reference', async () => {
  const page = await readFile(new URL('../pages/AgentService.jsx', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('  const handleFileUpload ='), page.indexOf('  const handleSubmit ='));
  let uploaded = null;
  let reference = null;
  const noop = () => {};
  class FileReader {
    readAsText() { this.onload({ target: { result: '<kml />' } }); }
  }
  const dependencies = {
    routeApi: { uploadKml: async (file) => { uploaded = file; return { kml_url: '/static/kml-upload/saved.kml' }; } },
    FileReader,
    setUploadedKmlContent: noop,
    setUploadedKmlUrl: (url) => { reference = url; },
    setUploadedFileName: noop,
    setUploadLoading: noop,
    uploadSequenceRef: { current: 0 },
    message: { success: noop, error: noop },
  };
  const upload = new Function(...Object.keys(dependencies), `${handler}; return handleFileUpload;`)(...Object.values(dependencies));
  const file = { name: 'original.kml' };
  await upload(file);
  assert.equal(uploaded, file);
  assert.equal(reference, '/static/kml-upload/saved.kml');
});

test('publication page keeps request identity across failed verification and retry', async () => {
  const page = await readFile(new URL('../pages/Routes.jsx', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('  const handlePublication ='), page.indexOf('  const handleStatusChange ='));
  const requests = [];
  let closed = false;
  const dependencies = {
    publicRouteType: 'multi_day', publicationRoute: { id: 'route-1' },
    publicationRequestsRef: { current: {} }, crypto: { randomUUID: () => `request-${requests.length}` },
    setPublishing: () => {},
    setPublicationRoute: (value) => { closed = value === null; },
    routeApi: { changeRouteStatus: async (...args) => { requests.push(args); if (requests.length === 1) throw new Error('read failed'); } },
    message: { warning: () => {}, success: () => {} }, Modal: { warning: () => {} }, loadRoutes: () => {},
  };
  const publish = new Function(...Object.keys(dependencies), `${handler}; return handlePublication;`)(...Object.values(dependencies));
  await publish();
  assert.equal(closed, false);
  await publish();
  assert.equal(requests[0][3].publication_id, requests[1][3].publication_id);
  assert.equal(closed, true);
});

test('expired publication identity requires explicit reset before a new request', async () => {
  const page = await readFile(new URL('../pages/Routes.jsx', import.meta.url), 'utf8');
  const handler = page.slice(page.indexOf('  const handlePublication ='), page.indexOf('  const handleStatusChange ='));
  const reference = { current: { 'route-1': { public_route_type: 'multi_day', publication_id: 'old-request' } } };
  let confirmation;
  let sent;
  const dependencies = {
    publicRouteType: 'multi_day', publicationRoute: { id: 'route-1' },
    publicationRequestsRef: reference, crypto: { randomUUID: () => 'new-request' },
    setPublishing: () => {}, setPublicationRoute: () => {},
    routeApi: { changeRouteStatus: async (...args) => {
      sent = args[3].publication_id;
      throw { response: { status: 409, data: { message: '发布请求已失效' } } };
    } },
    message: { warning: () => {}, success: () => {} },
    Modal: { warning: () => {}, confirm: (value) => { confirmation = value; } }, loadRoutes: () => {},
  };
  const publish = new Function(...Object.keys(dependencies), `${handler}; return handlePublication;`)(...Object.values(dependencies));
  await publish();
  assert.equal(sent, 'old-request');
  assert.equal(reference.current['route-1'].publication_id, 'old-request');
  assert.equal(typeof confirmation?.onOk, 'function');
  confirmation.onOk();
  await publish();
  assert.equal(sent, 'new-request');
});
