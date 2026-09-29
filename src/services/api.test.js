import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { Buffer } from 'node:buffer';
import { BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js';

// Vite injects import.meta.env; use its default values in this Node harness.
const source = (await readFile(new URL('./api.js', import.meta.url), 'utf8'))
  .replace("from 'axios'", `from '${import.meta.resolve('axios')}'`)
  .replace("from './kmzInput.js'", `from '${new URL('./kmzInput.js', import.meta.url).href}'`)
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

test('KMZ upload submits only the unchanged KML through the existing endpoint', async () => {
  const kml = '<kml xmlns:gx="http://www.google.com/kml/ext/2.2"><gx:Track><when>2026-07-20T05:45:43Z</when></gx:Track></kml>';
  const zip = new ZipWriter(new BlobWriter(), { useWebWorkers: false });
  await zip.add('doc.kml', new TextReader(kml));
  await zip.add('files/photo.png', new TextReader('photo'));
  const input = new File([await zip.close()], '亚丁.kmz');
  let uploaded;
  api.defaults.adapter = async (config) => {
    assert.equal(config.url, '/api/v1/route-analysis/kml/upload');
    uploaded = config.data.get('file');
    return respond(config, { success: true, data: { kml_url: '/static/kml-upload/saved.kml', file_size: uploaded.size } });
  };
  const result = await routeApi.uploadKml(input);
  assert.equal(uploaded.name, '亚丁.kml');
  assert.equal(await uploaded.text(), kml);
  assert.equal(result.kml_url, '/static/kml-upload/saved.kml');
});

test('invalid KMZ is rejected before any upload request', async () => {
  let calls = 0;
  api.defaults.adapter = async (config) => { calls++; return respond(config, {}); };
  await assert.rejects(routeApi.uploadKml(new File(['invalid'], 'bad.kmz')), /KMZ/);
  assert.equal(calls, 0);
});

test('ordinary KML upload keeps the same file and response contract', async () => {
  const input = new File(['<kml/>'], 'route.kml');
  api.defaults.adapter = async (config) => {
    assert.equal(config.data.get('file'), input);
    return respond(config, { success: true, data: { kml_url: '/static/kml-upload/plain.kml', file_size: input.size } });
  };
  assert.deepEqual(await routeApi.uploadKml(input), { kml_url: '/static/kml-upload/plain.kml', file_size: input.size });
});

test('analysis file picker accepts KMZ and explains that photos are not uploaded', async () => {
  const page = await readFile(new URL('../pages/AgentService.jsx', import.meta.url), 'utf8');
  assert.match(page, /accept="\.kml,\.xml,\.kmz"/);
  assert.match(page, /图片不上传/);
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

test('web deployment validates its target and syncs without recursive deletion', async () => {
  const workflow = await readFile(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.equal(/\brm\s+[^\n]*-[a-zA-Z]*r/.test(workflow), false, 'deployment must not recursively delete a directory');
  assert.equal(workflow.includes('--delete'), false, 'deployment sync must not delete remote-only files');
  assert.ok(workflow.includes('Validate deployment target'));
  assert.ok(workflow.includes('test -d'));
  assert.ok(workflow.includes('--exclude=\'.env\''));
  assert.ok(workflow.includes('--exclude=\'.env.*\''));
  assert.ok(workflow.includes('BatchMode=yes'));
  assert.equal(workflow.includes('hex dump'), false, 'deployment must not print secret configuration');
});

// review-public-main-track-and-isolate-schemes: execute the real JSX functions,
// with commit-ordered hooks and Leaflet/timer doubles; no DOM, tiles or HTTP.
const routesPage = await readFile(new URL('../pages/Routes.jsx', import.meta.url), 'utf8');
const { transformWithOxc } = await import('vite');
const { code: routesCode } = await transformWithOxc(
  routesPage.replace(/^import .+;\r?\n/gm, '').replace('export default Routes;', ''),
  'Routes.jsx',
  { lang: 'jsx', jsx: { runtime: 'classic' }, sourcemap: false },
);

function viewElements(node) {
  if (Array.isArray(node)) return node.flatMap(viewElements);
  if (!node?.props) return [];
  return [node, ...viewElements(node.props.children), ...(node.props.items || []).flatMap((item) => [
    ...viewElements(item.label), ...viewElements(item.children),
  ])];
}

function createRouteViewHarness() {
  const maps = [], events = [], requests = [], timers = new Map();
  let activeHooks, nextTimer = 0;
  const ui = Object.fromEntries([...routesPage.matchAll(/^import \{([^}]+)\} from '(?:antd|@ant-design\/icons)';$/gm)]
    .flatMap((match) => match[1].split(',').map((name) => [name.trim(), name.trim()])));
  Object.assign(ui, {
    Input: { Search: 'Search', TextArea: 'TextArea' }, Select: { Option: 'Option' },
    Space: { Compact: 'Space.Compact' }, Descriptions: { Item: 'Descriptions.Item' },
    message: { error: () => {}, success: () => {}, warning: () => {} },
  });
  const schedule = (callback) => { const id = ++nextTimer; timers.set(id, callback); return id; };
  const cancel = (id) => { events.push(['cancel', id]); timers.delete(id); };
  const makeBounds = (points) => ({ points: [...points], extend(other) { this.points.push(...other.points); return this; }, pad() { return this; } });
  const layer = (kind, points, options) => ({
    kind, points, options: { ...options }, popup: null, popupOpens: 0,
    addTo(map) { this.map = map; map.layers.push(this); return this; },
    bindPopup(text) { this.popup = text; return this; },
    openPopup() { assert.equal(this.map.removed, false, 'detached layer received a timer callback'); this.popupOpens++; },
    setStyle(style) { assert.equal(this.map.removed, false, 'detached layer was restyled'); Object.assign(this.options, style); },
  });
  const L = {
    map(container) {
      assert.equal(maps.some((map) => map.container === container && !map.removed), false, 'old map must be removed before replacement');
      const map = {
        container, layers: [], removed: false,
        setView(center) { this.center = center; }, fitBounds() {}, flyTo() {}, flyToBounds() {}, stop() {},
        remove() { events.push(['remove', maps.indexOf(this)]); this.removed = true; this.layers = []; },
      };
      maps.push(map); events.push(['create', maps.length - 1]); return map;
    },
    tileLayer: () => layer('tile', [], {}),
    polyline: (points, options) => layer('line', points, options),
    circleMarker: (points, options) => layer('marker', points, options),
    latLngBounds: makeBounds,
  };
  const routeApi = {
    getRoutes: async () => ({ content: [], totalElements: 0 }),
    getRouteById: (id) => new Promise((resolve, reject) => requests.push({ id, resolve, reject })),
    adoptSegment: async () => ({}),
  };
  const agentServiceApi = { submitAnalysis: async () => ({ task_id: 'task-1' }), getTaskStatus: async () => ({ status: 'processing' }) };
  const dependencies = {
    ...ui, L, routeApi, agentServiceApi,
    TrackReviewPanel: 'TrackReviewPanel',
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }), Fragment: 'Fragment' },
    useState: (...args) => activeHooks.useState(...args),
    useRef: (...args) => activeHooks.useRef(...args),
    useEffect: (...args) => activeHooks.useEffect(...args),
    formatTimestamp: (v) => v, getDifficultyText: String, getDifficultyTagColor: () => 'green',
    getRouteStatusText: String, getRouteStatusColor: () => 'green',
    setTimeout: schedule, clearTimeout: cancel, setInterval: schedule, clearInterval: cancel,
    console: { error() {} },
  };
  const components = new Function(...Object.keys(dependencies), `${routesCode}; return { Routes, RouteMap };`)(...Object.values(dependencies));
  function mount(Component, initialProps = {}) {
    const slots = [];
    let cursor = 0, pending = [], props = initialProps;
    const hooks = {
      useState(initial) {
        const index = cursor++;
        slots[index] ||= { value: typeof initial === 'function' ? initial() : initial };
        return [slots[index].value, (value) => { slots[index].value = typeof value === 'function' ? value(slots[index].value) : value; }];
      },
      useRef(initial) { const index = cursor++; slots[index] ||= { current: initial }; return slots[index]; },
      useEffect(callback, deps) {
        const index = cursor++, previous = slots[index];
        if (!previous || deps.some((value, i) => !Object.is(value, previous.deps[i]))) {
          pending.push({ index, callback, deps, cleanup: previous?.cleanup });
        }
      },
    };
    return {
      render(nextProps = props) {
        props = nextProps; cursor = 0; pending = []; activeHooks = hooks;
        const tree = Component(props);
        for (const node of viewElements(tree)) if (node.props.ref) node.props.ref.current ||= {};
        activeHooks = null;
        // React cleans up all changed effects before setting them up again.
        for (const effect of pending) effect.cleanup?.();
        for (const effect of pending) slots[effect.index] = { deps: effect.deps, cleanup: effect.callback() };
        return tree;
      },
      unmount() { for (const slot of slots) slot?.cleanup?.(); },
    };
  }
  const page = mount(components.Routes);
  const render = () => page.render();
  const modal = () => viewElements(render()).find((node) => node.props.title === '路线详情');
  const segmentPanel = () => viewElements(render()).find((node) => node.type === ui.Tabs)?.props.items.find((item) => item.key === 'segments')?.children;
  const segmentView = () => viewElements(segmentPanel()).find((node) => typeof node.type === 'function');
  const open = (route) => {
    const table = viewElements(render()).find((node) => node.type === ui.Table && node.props.columns?.some((column) => column.key === 'action'));
    const actions = table.props.columns.find((column) => column.key === 'action').render(null, route);
    return viewElements(actions).find((node) => node.type === ui.Button).props.onClick();
  };
  return {
    maps, events, requests, timers, ui, routeApi, agentServiceApi, components, mount, page, render, modal, segmentView, open,
    chooseScheme: (id) => viewElements(segmentPanel()).find((node) => node.type === ui.Select).props.onChange(id),
    close: () => modal().props.onCancel(),
    flushTimers() { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); },
  };
}

const viewSegment = (id, start, end) => ({ id, name: id, status: 'draft', track_start_index: start, track_end_index: end, description: `${id} description`, notes: `${id} notes` });
function viewRoute(id = 'A') {
  return {
    id, status: 0, kml_url: `/${id}.kml`,
    track_path: Array.from({ length: 10 }, (_, i) => [30 + i * 0.001, 120 + i * 0.001]),
    segment_schemes: [
      { id: `${id}-day`, scheme_type: 'day', segments: [viewSegment('day-1', 0, 4), viewSegment('day-2', 5, 9)] },
      { id: `${id}-slope`, scheme_type: 'slope', segments: [viewSegment('slope-1', 0, 2), viewSegment('slope-2', 3, 7), viewSegment('slope-3', 7, 9)] },
    ],
    poi_points: [{ id: 'poi-1', name: 'poi-1', category: 'camp', latitude: 30, longitude: 120 }],
  };
}
async function openView(h, route = viewRoute()) {
  const pending = h.open(route);
  h.requests.at(-1).resolve(route);
  await pending;
  return route;
}
const coloredLines = (map) => map.layers.filter((layer) => layer.kind === 'line' && layer.options.color !== '#aaaaaa');

test('route view: day and slope lists and map layers are mutually exclusive', async () => {
  const h = createRouteViewHarness();
  const route = await openView(h);
  for (const scheme of route.segment_schemes) {
    h.chooseScheme(scheme.id);
    const view = h.segmentView();
    const tree = h.mount(view.type, view.props).render();
    const collapses = viewElements(tree).filter((node) => node.type === h.ui.Collapse);
    assert.equal(collapses.length, 1, 'a day view must not nest the slope list');
    assert.deepEqual(collapses[0].props.items.map((item) => item.key), scheme.segments.map((segment) => segment.id));
    const fields = viewElements(collapses[0]).filter((node) => node.props.label === '描述' || node.props.label === '备注');
    assert.deepEqual(fields.map((node) => node.props.children[0]), scheme.segments.flatMap((segment) => [segment.description, segment.notes]));
    const mapNode = viewElements(tree).find((node) => node.type === h.components.RouteMap);
    const map = h.mount(mapNode.type, mapNode.props);
    map.render();
    assert.equal(coloredLines(h.maps.at(-1)).length, scheme.segments.length);
    map.unmount();
    assert.equal(h.maps.filter((item) => !item.removed).length, 0);
  }
});

test('route view: same-scheme split replaces old layers before drawing new segments', () => {
  const h = createRouteViewHarness(), route = viewRoute();
  const props = { route, mode: 'segments', segments: route.segment_schemes[1].segments };
  const view = h.mount(h.components.RouteMap, props);
  view.render();
  const previous = h.maps.at(-1);
  const split = [viewSegment('split-a', 0, 1), viewSegment('split-b', 1, 2), ...props.segments.slice(1)];
  view.render({ ...props, segments: split });
  assert.equal(previous.removed, true);
  assert.equal(coloredLines(h.maps.at(-1)).length, 4);
  assert.equal(coloredLines(h.maps.at(-1)).some((line) => line.popup.includes('slope-1</b>')), false);
  assert.deepEqual(h.events.filter(([event]) => event === 'create' || event === 'remove'), [['create', 0], ['remove', 0], ['create', 1]]);
  view.unmount();
});

test('route view: route geometry replacement redraws without retaining previous coordinates', () => {
  const h = createRouteViewHarness(), route = viewRoute();
  const props = { route, mode: 'segments', segments: route.segment_schemes[0].segments };
  const view = h.mount(h.components.RouteMap, props);
  view.render();
  const moved = { ...route, track_path: route.track_path.map(([lat, lon]) => [lat + 1, lon + 1]) };
  view.render({ ...props, route: moved });
  assert.deepEqual(coloredLines(h.maps.at(-1))[0].points, moved.track_path.slice(0, 5));
  assert.equal(h.maps.filter((map) => !map.removed).length, 1);
  view.unmount();
});

test('route view: segment focus cancels obsolete timers on focus change and data replacement', () => {
  const h = createRouteViewHarness(), route = viewRoute();
  const props = { route, mode: 'segments', segments: route.segment_schemes[1].segments };
  const view = h.mount(h.components.RouteMap, props);
  view.render({ ...props, focus: { type: 'segment', id: 'slope-1', ts: 1 } });
  const map = h.maps.at(-1), first = coloredLines(map)[0];
  assert.equal(first.options.weight, 8);
  view.render({ ...props, focus: { type: 'segment', id: 'slope-2', ts: 2 } });
  assert.equal(h.maps.at(-1), map, 'focus alone must not recreate the map');
  assert.equal(first.options.weight, 5);
  assert.equal(h.timers.size, 1);
  view.render({ ...props, segments: [...props.segments], focus: null });
  assert.equal(h.timers.size, 0);
  h.flushTimers();
  view.unmount();
});

test('route view: delayed POI popup is cancelled on refresh and unmount', () => {
  const h = createRouteViewHarness(), route = viewRoute();
  const props = { route, mode: 'pois', pois: route.poi_points, focus: { type: 'poi', id: 'poi-1', ts: 1 } };
  const view = h.mount(h.components.RouteMap, props);
  view.render();
  assert.equal(h.timers.size, 1);
  view.render({ ...props, pois: [...props.pois], focus: null });
  assert.equal(h.timers.size, 0);
  view.render({ ...props, focus: { ...props.focus, ts: 2 } });
  view.unmount();
  assert.equal(h.timers.size, 0);
  h.flushTimers();
});

test('route view: switching schemes clears selection and focus instead of replaying the previous segment', async () => {
  const h = createRouteViewHarness();
  await openView(h);
  const old = h.segmentView();
  old.props.onToggleSegSelect('slope-1', true);
  old.props.onFocus({ type: 'segment', id: 'slope-1', ts: 1 });
  h.chooseScheme('A-day');
  assert.deepEqual(h.segmentView().props.selectedSegIds, []);
  assert.equal(h.segmentView().props.focus, null);
});

test('route view: accepted detail refresh invalidates selected IDs and focus even if IDs still exist', async () => {
  const h = createRouteViewHarness(), route = await openView(h);
  const view = h.segmentView();
  view.props.onToggleSegSelect('slope-1', true);
  view.props.onFocus({ type: 'segment', id: 'slope-1', ts: 1 });
  await view.props.onAdopt(route.segment_schemes[1].segments[0]);
  h.requests.at(-1).resolve({ ...route });
  await Promise.resolve();
  assert.deepEqual(h.segmentView().props.selectedSegIds, []);
  assert.equal(h.segmentView().props.focus, null);
});

test('route view: opening B rejects a late A detail and preserves the current loading state', async () => {
  const h = createRouteViewHarness();
  const a = h.open(viewRoute('A')), b = h.open(viewRoute('B'));
  h.requests[0].resolve(viewRoute('A')); await a;
  const loading = viewElements(h.modal()).find((node) => node.type === h.ui.Spin);
  assert.equal(loading.props.spinning, true);
  assert.equal(h.segmentView().props.route.id, 'B');
  h.requests[1].resolve(viewRoute('B')); await b;
  assert.equal(h.segmentView().props.route.id, 'B');
});

test('route view: older same-route refresh cannot replace the newer response or reset its selection', async () => {
  const h = createRouteViewHarness(), route = await openView(h);
  const onAdopt = h.segmentView().props.onAdopt;
  await onAdopt(route.segment_schemes[1].segments[0]);
  await onAdopt(route.segment_schemes[1].segments[1]);
  const newer = { ...route, name: 'newer' }, older = { ...route, name: 'older' };
  h.requests[2].resolve(newer); await Promise.resolve();
  h.segmentView().props.onToggleSegSelect('slope-1', true);
  h.requests[1].resolve(older); await Promise.resolve();
  assert.equal(h.segmentView().props.route.name, 'newer');
  assert.deepEqual(h.segmentView().props.selectedSegIds, ['slope-1']);
});

test('route view: closing invalidates a pending detail even when the same route is reopened', async () => {
  const h = createRouteViewHarness();
  const old = h.open(viewRoute('A'));
  h.close();
  assert.equal(h.segmentView(), undefined, 'closing must unmount the map content');
  const current = h.open({ ...viewRoute('A'), name: 'reopened' });
  h.requests[1].resolve({ ...viewRoute('A'), name: 'current' }); await current;
  h.requests[0].resolve({ ...viewRoute('A'), name: 'obsolete' }); await old;
  assert.equal(h.segmentView().props.route.name, 'current');
});

test('route view: late mutation refresh for A cannot issue a detail request over B', async () => {
  const h = createRouteViewHarness(), route = await openView(h);
  const staleRefresh = h.segmentView().props.onAdopt;
  await openView(h, viewRoute('B'));
  const count = h.requests.length;
  await staleRefresh(route.segment_schemes[1].segments[0]);
  assert.equal(h.requests.length, count);
  assert.equal(h.segmentView().props.route.id, 'B');
});

test('route view: a completed poll from the closed route cannot clear the new route selection or refresh it', async () => {
  const h = createRouteViewHarness();
  await openView(h);
  let resolveStatus;
  h.agentServiceApi.getTaskStatus = () => new Promise((resolve) => { resolveStatus = resolve; });
  const analyze = viewElements(h.modal()).find((node) => node.type === h.ui.Button && node.props.children.includes('重新分析'));
  await analyze.props.onClick();
  const pending = [...h.timers.values()][0]();
  h.close();
  await openView(h, viewRoute('B'));
  h.chooseScheme('B-day');
  h.segmentView().props.onToggleSegSelect('day-1', true);
  const count = h.requests.length;
  resolveStatus({ status: 'completed' });
  await pending;
  assert.equal(h.requests.length, count);
  assert.equal(h.segmentView().props.schemeKey, 'B-day');
  assert.deepEqual(h.segmentView().props.selectedSegIds, ['day-1']);
});

test('route view: stale detail errors do not report failure after another route has loaded', async () => {
  const h = createRouteViewHarness(), errors = [];
  h.ui.message.error = (message) => errors.push(message);
  const old = h.open(viewRoute('A'));
  await openView(h, viewRoute('B'));
  h.requests[0].reject(new Error('old request failed'));
  await old;
  assert.deepEqual(errors, []);
  assert.equal(h.segmentView().props.route.id, 'B');
});

test('route view: current route exposes a separate main-track review tab', async () => {
  const h = createRouteViewHarness();
  await openView(h);
  const tabs = viewElements(h.render()).find((node) => node.type === h.ui.Tabs);
  const review = tabs.props.items.find((item) => item.key === 'main-track-review');
  assert.equal(review.label, '主轨迹审核');
  const panel = viewElements(review.children).find((node) => node.type === 'TrackReviewPanel');
  assert.equal(panel.props.routeId, 'A');
  assert.equal(panel.props.MapComponent, h.components.RouteMap);
});

test('route view: a single candidate point is centered and drawn instead of using another location', () => {
  const h = createRouteViewHarness();
  const view = h.mount(h.components.RouteMap, { route: { id: 'single', track_path: [[30, 120, 100]] }, mode: 'segments' });
  view.render();
  const map = h.maps.at(-1);
  assert.deepEqual(map.center, [30, 120]);
  assert.equal(map.layers.filter((layer) => layer.kind === 'marker').length, 1);
  assert.deepEqual(map.layers.find((layer) => layer.kind === 'marker').points, [30, 120]);
  view.unmount();
});

test('route view: main track review receives current analysis state and refreshed candidate identity', async () => {
  const h = createRouteViewHarness();
  const route = await openView(h);
  const getPanel = () => viewElements(h.render()).find((node) => node.type === 'TrackReviewPanel');
  assert.equal(getPanel().props.analysisActive, false);
  assert.equal(getPanel().props.candidateRevision, route.track_path);
  const analyze = viewElements(h.modal()).find((node) => node.type === h.ui.Button && node.props.children.includes('重新分析'));
  await analyze.props.onClick();
  assert.equal(getPanel().props.analysisActive, true);
});
