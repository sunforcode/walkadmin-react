import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers';
import { transformWithOxc } from 'vite';

const source = await readFile(new URL('./TrackReviewPanel.jsx', import.meta.url), 'utf8');
const { code } = await transformWithOxc(source.replace(/^import .+;\r?\n/gm, '').replace('export default function', 'function'),
  'TrackReviewPanel.jsx', { lang: 'jsx', jsx: { runtime: 'classic' }, sourcemap: false });
const candidate = (routeId = 'route-1') => ({
  route_id: routeId, candidate_id: `candidate-${routeId}`, candidate_path: [[30, 120], [30.1, 120.1]],
  geometry_valid: true, validation_error: null, analysis_active: false,
  review_revision: 0, review: null, published_version_id: 'version-1', published_main_track_availability: 'pending_review',
});
const elements = (node) => Array.isArray(node) ? node.flatMap(elements) : node?.props ? [node, ...elements(node.props.children)] : [];

function harness(initialRoute = 'route-1') {
  const reads = [], writes = [], slots = [], reviewed = [];
  let cursor = 0, effects = [], routeId = initialRoute, identity = 0, extraProps = {};
  const ui = { Alert: 'Alert', Button: 'Button', Checkbox: 'Checkbox', Descriptions: { Item: 'Descriptions.Item' },
    Input: { TextArea: 'TextArea' }, Select: 'Select', Space: 'Space', Spin: 'Spin', Tag: 'Tag' };
  const dependencies = {
    ...ui,
    routeApi: {
      getMainTrackReview: (id) => new Promise((resolve, reject) => reads.push({ id, resolve, reject })),
      submitMainTrackReview: (id, request) => new Promise((resolve, reject) => writes.push({ id, request, resolve, reject })),
    },
    React: { createElement: (type, props, ...children) => ({ type, props: { ...props, children } }) },
    crypto: { randomUUID: () => `request-${++identity}` },
    useState(initial) {
      const i = cursor++;
      slots[i] ||= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (value) => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
    },
    useRef(initial) { const i = cursor++; slots[i] ||= { current: initial }; return slots[i]; },
    useEffect(callback, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) effects.push({ i, callback, deps, cleanup: old?.cleanup });
    },
    useMemo(factory, deps) {
      const i = cursor++, old = slots[i];
      if (!old || deps.some((v, j) => !Object.is(v, old.deps[j]))) slots[i] = { value: factory(), deps };
      return slots[i].value;
    },
  };
  const Component = new Function(...Object.keys(dependencies), `${code}; return TrackReviewPanel;`)(...Object.values(dependencies));
  const MapComponent = () => {};
  const render = (id = routeId, nextProps = extraProps) => {
    routeId = id; extraProps = nextProps; cursor = 0; effects = [];
    const tree = Component({ routeId, MapComponent, onReviewed: (value) => reviewed.push(value), ...extraProps });
    effects.forEach((effect) => effect.cleanup?.());
    effects.forEach((effect) => { slots[effect.i] = { deps: effect.deps, cleanup: effect.callback() }; });
    return tree;
  };
  const button = (label) => elements(render()).find((n) => n.type === ui.Button && n.props.children.includes(label));
  const input = (type) => elements(render()).find((n) => n.type === ui[type]);
  const alerts = () => elements(render()).filter((n) => n.type === ui.Alert).map((n) => n.props.title);
  const accept = async (view = candidate(routeId)) => { reads.at(-1).resolve(view); await new Promise(setImmediate); render(); };
  render();
  return { reads, writes, reviewed, render, accept, button, input, alerts, MapComponent,
    confirm: () => input('Checkbox').props.onChange({ target: { checked: true } }),
    system: (value) => input('Select').props.onChange(value),
    reason: (value) => elements(render()).find((n) => n.type === ui.Input.TextArea).props.onChange({ target: { value } }),
    unmount: () => slots.forEach((slot) => slot?.cleanup?.()),
  };
}

test('approval requires explicit unchecked confirmation and coordinate system', async () => {
  const h = harness(); await h.accept();
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(h.input('Select').props.value, null);
  assert.equal(h.button('确认通过').props.disabled, true);
  h.confirm(); assert.equal(h.button('确认通过').props.disabled, true);
  h.system('WGS84'); assert.equal(h.button('确认通过').props.disabled, false);
  assert.equal(h.writes.length, 0);
});

test('save approval sends the viewed candidate then reports publication is still required', async () => {
  const h = harness(); await h.accept(); h.confirm(); h.system('WGS84');
  const pending = h.button('确认通过').props.onClick();
  assert.deepEqual(h.writes[0].request, { candidate_id: 'candidate-route-1', expected_revision: 0,
    decision: 'approved', confirm_complete_hiking_range: true, reference_system: 'WGS84', reason: null, request_id: 'request-1' });
  h.writes[0].resolve({ ...candidate(), review_revision: 1, review: { decision: 'approved', reference_system: 'WGS84' } });
  await pending;
  assert.ok(h.alerts().includes('审核已保存，需发布或重新发布后公开生效'));
  assert.deepEqual(h.reviewed, ['route-1']);
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(h.writes.length, 1);
});

test('failed transport reuses the same request identity, stale response requires explicit refresh', async () => {
  const h = harness(); await h.accept(); h.confirm(); h.system('WGS84');
  const first = h.button('确认通过').props.onClick();
  h.writes[0].reject(new Error('network failure')); await first;
  const again = h.button('确认通过').props.onClick();
  assert.equal(h.writes[1].request.request_id, h.writes[0].request.request_id);
  h.writes[1].reject({ response: { status: 409, data: { message: '候选已变化' } } }); await again;
  assert.ok(h.alerts().some((text) => text.includes('刷新候选')));
  assert.equal(h.reads.length, 1);
  h.button('刷新候选').props.onClick(); h.render(); await h.accept({ ...candidate(), candidate_id: 'new-candidate', review_revision: 2 });
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(h.input('Select').props.value, null);
});

test('reject requires a reason and does not leak the approval checkbox into the request', async () => {
  const h = harness(); await h.accept();
  assert.equal(h.button('驳回候选').props.disabled, true);
  h.confirm(); h.system('WGS84'); h.reason('包含接驳车');
  const pending = h.button('驳回候选').props.onClick();
  assert.equal(h.writes[0].request.decision, 'rejected');
  assert.equal(h.writes[0].request.reference_system, null);
  assert.equal(h.writes[0].request.confirm_complete_hiking_range, false);
  h.writes[0].resolve({ ...candidate(), review_revision: 1, review: { decision: 'rejected' } }); await pending;
});

test('late candidate and submit responses from an old route cannot overwrite another route', async () => {
  const h = harness('A'); h.render('B');
  h.reads[0].resolve(candidate('A')); await new Promise(setImmediate);
  assert.equal(h.button('确认通过'), undefined);
  await h.accept(candidate('B')); h.confirm(); h.system('WGS84');
  const pending = h.button('确认通过').props.onClick();
  h.render('C'); await h.accept(candidate('C'));
  h.writes[0].resolve({ ...candidate('B'), review: { decision: 'approved' } }); await pending;
  assert.deepEqual(h.reviewed, []);
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(elements(h.render()).find((n) => n.type === h.MapComponent).props.route.id, 'C');
});

test('invalid geometry and active analysis cannot be submitted', async () => {
  for (const view of [{ ...candidate(), geometry_valid: false, validation_error: '候选无效' }, { ...candidate(), analysis_active: true }]) {
    const h = harness(); await h.accept(view); h.confirm(); h.system('WGS84'); h.reason('需重新分析');
    assert.equal(h.button('确认通过').props.disabled, true);
    assert.equal(h.button('驳回候选').props.disabled, true);
    assert.equal(h.writes.length, 0);
  }
});

test('candidate map is not recreated just by changing review form state', async () => {
  const h = harness(); await h.accept();
  const before = elements(h.render()).find((n) => n.type === h.MapComponent).props.route;
  h.confirm(); h.system('WGS84'); h.reason('人工核对');
  assert.equal(elements(h.render()).find((n) => n.type === h.MapComponent).props.route, before);
});

test('409 invalidates old confirmation and both submit buttons until an explicit refresh', async () => {
  const h = harness(); await h.accept(); h.confirm(); h.system('WGS84'); h.reason('review');
  const pending = h.button('确认通过').props.onClick();
  h.writes[0].reject({ response: { status: 409, data: { message: '审核已更新' } } }); await pending;
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(h.input('Select').props.value, null);
  assert.equal(h.button('确认通过').props.disabled, true);
  assert.equal(h.button('驳回候选').props.disabled, true);
  assert.equal(h.reads.length, 1);
});

test('same-route analysis revokes the old form and rereads when the analysis finishes', async () => {
  const h = harness(); await h.accept(); h.confirm(); h.system('WGS84');
  h.render('route-1', { analysisActive: true, candidateRevision: 'first' });
  assert.equal(h.button('确认通过'), undefined);
  assert.equal(h.writes.length, 0);
  h.render('route-1', { analysisActive: false, candidateRevision: 'second' });
  assert.equal(h.reads.length, 2);
  await h.accept({ ...candidate(), candidate_id: 'new-candidate', review_revision: 1 });
  assert.equal(h.input('Checkbox').props.checked, false);
  assert.equal(h.input('Select').props.value, null);
});
