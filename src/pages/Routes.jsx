import { useState, useEffect, useRef } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin, Tabs, Collapse, Badge, InputNumber, Progress, Checkbox, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, EnvironmentOutlined, ThunderboltOutlined, PlusOutlined, CheckOutlined, ScissorOutlined, RocketOutlined, AimOutlined, EditOutlined, MergeCellsOutlined, RobotOutlined, DeleteOutlined, SendOutlined, StopOutlined } from '@ant-design/icons';
import { routeApi, agentServiceApi, formatTimestamp, getDifficultyText, getDifficultyTagColor, getRouteStatusText, getRouteStatusColor } from '../services/api';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const { Search } = Input;
const { Option } = Select;

// POI 分类元信息（地图与表格共用）
const CATEGORY_META = {
  start: { label: '🚩 起点', color: 'green', mapColor: '#52c41a' },
  end: { label: '🏁 终点', color: 'red', mapColor: '#f5222d' },
  water: { label: '💧 水源', color: 'blue', mapColor: '#1677ff' },
  camp: { label: '⛺ 营地', color: 'cyan', mapColor: '#13c2c2' },
  supply: { label: '🏪 补给点', color: 'orange', mapColor: '#fa8c16' },
  photo: { label: '📷 观景点', color: 'purple', mapColor: '#722ed1' },
  pass: { label: '⛰️ 垭口', color: 'geekblue', mapColor: '#2f54eb' },
  danger: { label: '⚠️ 危险点', color: 'volcano', mapColor: '#fa541c' },
};

// 分段渲染调色板（逐段区分颜色）
const SEG_COLORS = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231', '#911eb4', '#008080',
  '#f032e6', '#808000', '#000075', '#e65100', '#00897b', '#c62828',
  '#5c6bc0', '#6a1b9a', '#259324', '#ad1457',
];
const getSegColor = (i) => SEG_COLORS[i % SEG_COLORS.length];

/**
 * 共享地图组件
 * @param {object} route 路线详情（含 track_points）
 * @param {string} mode 'segments'（分段彩色渲染）| 'pois'（POI 标记）
 * @param {Array} segments 分段列表（mode=segments 时渲染）
 * @param {Array} pois POI 列表（mode=pois 时渲染标记）
 * @param {object} focus 外部定位触发 { type: 'segment'|'poi', id, ts }
 * @param {Array} overlaySegments 叠加细分段（如按天视图下嵌套的坡度段），粗半透明主线之上绘制细实线
 */
const RouteMap = ({ route, mode, segments = [], pois = [], focus = null, overlaySegments = null }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRefs = useRef({});
  const segLineRefs = useRef({});
  const segBoundsRefs = useRef({});

  // 优先使用分析回调保存的完整轨迹（索引与分段 track_start/end_index 对齐）
  const trackPath = (route?.track_path || []).filter(
    (p) => Array.isArray(p) && p.length >= 2 && p[0] != null && p[1] != null
  );
  const waypointTrack = (route?.track_points || [])
    .slice()
    .sort((a, b) => (a.sequence_number ?? 0) - (b.sequence_number ?? 0))
    .filter((tp) => tp.latitude != null && tp.longitude != null)
    .map((tp) => [tp.latitude, tp.longitude]);
  const trackLatLngs = trackPath.length > 1
    ? trackPath.map((p) => [p[0], p[1]])
    : waypointTrack;

  // 分段精确切片：完整轨迹存在时按索引直接取，否则按比例估算
  const getSegmentSlice = (seg) => {
    if (trackPath.length > 0) {
      const s = Math.max(seg.track_start_index ?? 0, 0);
      const e = Math.min(seg.track_end_index ?? s, trackPath.length - 1);
      if (e < s) return [];
      return trackPath.slice(s, e + 1).map((p) => [p[0], p[1]]);
    }
    // 回退：按比例映射到轨迹点
    const totalIdx = Math.max(
      ...segments.map((s) => s.track_end_index ?? 0),
      1
    );
    const n = waypointTrack.length;
    const sI = seg.track_start_index ?? 0;
    const eI = seg.track_end_index ?? sI;
    const start = Math.min(Math.floor((sI / totalIdx) * n), n - 1);
    let end = Math.floor(((eI + 1) / totalIdx) * n);
    end = Math.min(Math.max(end, start + 2), n);
    return waypointTrack.slice(start, end);
  };

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const lats = trackLatLngs.map((p) => p[0]);
    const lngs = trackLatLngs.map((p) => p[1]);
    const center = lats.length
      ? [lats.reduce((a, b) => a + b, 0) / lats.length, lngs.reduce((a, b) => a + b, 0) / lngs.length]
      : [39.05, 113.65];

    const map = L.map(containerRef.current, { scrollWheelZoom: true });
    mapRef.current = map; // 立即登记，避免后续代码抛错时容器未被清理
    map.setView(center, 12);

    // 高德瓦底（国内访问稳定）
    L.tileLayer('https://webrd0{s}.is.autonavi.com/appmaptile?lang=zh_cn&size=1&scale=1&style=8&x={x}&y={y}&z={z}', {
      subdomains: ['1', '2', '3', '4'],
      attribution: '© 高德地图',
      maxZoom: 18,
    }).addTo(map);

    // 底层完整轨迹（浅灰细线）
    if (trackLatLngs.length > 1) {
      L.polyline(trackLatLngs, {
        color: '#aaaaaa',
        weight: 2,
        opacity: 0.6,
      }).addTo(map);
    }

    // 分段彩色渲染
    if (mode === 'segments') {
      const useOverlay = Array.isArray(overlaySegments) && overlaySegments.length > 0;
      segments.forEach((seg, i) => {
        const slice = getSegmentSlice(seg);
        if (slice.length < 2) return;
        const color = seg.color || getSegColor(i);
        // 有叠加细分段时，主线用粗半透明“底色带”表示天，细实线留给坡度段
        const line = L.polyline(slice, {
          color,
          weight: useOverlay ? 9 : 5,
          opacity: useOverlay ? 0.35 : 0.9,
        }).addTo(map);
        line.bindPopup(
          `<b><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>${seg.name || `路段${i + 1}`}</b><br/>` +
          `${seg.distance ? `距离 ${seg.distance} km<br/>` : ''}` +
          `${seg.elevation_gain ? `爬升 ${seg.elevation_gain} m<br/>` : ''}` +
          `${seg.status === 'draft' ? '状态: AI建议' : '状态: 已采纳'}`
        );
        segLineRefs.current[seg.id] = line;
        segBoundsRefs.current[seg.id] = L.latLngBounds(slice);
      });
      // 叠加细分段（如按天视图下的坡度段）：细实线 + 调色板颜色，可定位
      if (useOverlay) {
        overlaySegments.forEach((seg, i) => {
          const slice = getSegmentSlice(seg);
          if (slice.length < 2) return;
          const color = getSegColor(i);
          const line = L.polyline(slice, {
            color,
            weight: 4,
            opacity: 0.95,
          }).addTo(map);
          line.bindPopup(
            `<b><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};margin-right:6px;"></span>${seg.name || `路段${i + 1}`}</b><br/>` +
            `${seg.distance ? `距离 ${seg.distance} km<br/>` : ''}` +
            `${seg.elevation_gain ? `爬升 ${seg.elevation_gain} m<br/>` : ''}`
          );
          segLineRefs.current[seg.id] = line;
          segBoundsRefs.current[seg.id] = L.latLngBounds(slice);
        });
      }
      if (segBoundsRefs.current && Object.keys(segBoundsRefs.current).length > 0) {
        const all = Object.values(segBoundsRefs.current);
        const bounds = all[0];
        all.slice(1).forEach((b) => bounds.extend(b));
        map.fitBounds(bounds.pad(0.1));
      } else if (trackLatLngs.length > 1) {
        map.fitBounds(L.latLngBounds(trackLatLngs).pad(0.1));
      }
    }

    // POI 标记
    if (mode === 'pois') {
      pois.forEach((p) => {
        const meta = CATEGORY_META[p.category] || { mapColor: '#8c8c8c', label: p.category };
        const m = L.circleMarker([p.latitude, p.longitude], {
          radius: 6,
          color: '#fff',
          weight: 1,
          fillColor: meta.mapColor,
          fillOpacity: 0.95,
        }).addTo(map);
        m.bindPopup(
          `<b>${meta.label} ${p.name}</b><br/>` +
          `${p.elevation != null ? `海拔 ${p.elevation}m<br/>` : ''}` +
          `${p.source ? `来源: ${p.source}<br/>` : ''}` +
          `${p.description || ''}`
        );
        markerRefs.current[p.id] = m;
      });
      if (trackLatLngs.length > 1) {
        map.fitBounds(L.latLngBounds(trackLatLngs).pad(0.1));
      }
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current = {};
      segLineRefs.current = {};
      segBoundsRefs.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  // 外部定位触发
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !focus.id || !focus.ts) return;
    if (focus.type === 'poi') {
      const poi = pois.find((p) => p.id === focus.id);
      if (!poi || poi.latitude == null) return;
      map.flyTo([poi.latitude, poi.longitude], 15, { duration: 0.8 });
      const m = markerRefs.current[poi.id];
      if (m) setTimeout(() => m.openPopup(), 850);
    } else if (focus.type === 'segment') {
      const bounds = segBoundsRefs.current[focus.id];
      if (!bounds) return;
      map.flyToBounds(bounds, { duration: 0.8 });
      const line = segLineRefs.current[focus.id];
      if (line) {
        line.openPopup();
        line.setStyle({ weight: 8 });
        setTimeout(() => line.setStyle({ weight: 5 }), 1600);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.ts]);

  return <div ref={containerRef} style={{ height: 340, borderRadius: 8, border: '1px solid #d9d9d9' }} />;
};

// 分段标签内容：默认平铺列表；按天方案且存在坡度方案时，按"天分组 + 组内坡度路段"嵌套展示
const CombinedDaySegments = ({
  route, days, slopeSegs = [], isDayScheme, schemeKey, focus, onFocus,
  onAdopt, onRename, onSplit, renderStatusTag, selectedSegIds = [], onToggleSegSelect,
}) => {
  const combine = isDayScheme && slopeSegs.length > 0;

  const segRow = (seg, i, opts = {}) => ({
    key: seg.id || `s${i}`,
    label: (
      <span onClick={(e) => e.stopPropagation()}>
        {!opts.noCheckbox && (
          <Checkbox
            checked={selectedSegIds.includes(seg.id)}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onToggleSegSelect(seg.id, e.target.checked)}
            style={{ marginRight: 8 }}
          />
        )}
        <span
          style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: opts.color || seg.color || getSegColor(i), marginRight: 6, cursor: 'pointer' }}
          onClick={(e) => { e.stopPropagation(); onFocus({ type: 'segment', id: seg.id, ts: Date.now() }); }}
          title="在地图上定位"
        />
        {renderStatusTag(seg.status)}
        <span style={{ fontWeight: opts.bold ? 600 : 500 }}>{seg.name || `路段${i + 1}`}</span>
        <span style={{ color: '#999', marginLeft: 8 }}>
          {seg.distance ? seg.distance + ' km' : ''} {seg.elevation_gain ? '↑' + seg.elevation_gain + 'm' : ''}
        </span>
        {!opts.noActions && (
          <span style={{ float: 'right' }} onClick={(e) => e.stopPropagation()}>
            <Button size="small" type="link" icon={<AimOutlined />} onClick={() => onFocus({ type: 'segment', id: seg.id, ts: Date.now() })}>
              定位
            </Button>
            {onRename && (
              <Button size="small" type="link" icon={<EditOutlined />} onClick={() => onRename(seg)}>
                改名
              </Button>
            )}
            {seg.status === 'draft' && onAdopt && (
              <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => onAdopt(seg)}>
                采纳
              </Button>
            )}
            {onSplit && seg.track_start_index != null && seg.track_end_index != null && seg.track_end_index > seg.track_start_index && (
              <Button size="small" type="link" icon={<ScissorOutlined />} onClick={() => onSplit(seg)}>
                拆分
              </Button>
            )}
          </span>
        )}
      </span>
    ),
    children: (
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="距离">{seg.distance ? `${seg.distance} km` : '-'}</Descriptions.Item>
        <Descriptions.Item label="爬升">{seg.elevation_gain ? `${seg.elevation_gain} m` : '-'}</Descriptions.Item>
        <Descriptions.Item label="下降">{seg.elevation_loss ? `${seg.elevation_loss} m` : '-'}</Descriptions.Item>
        <Descriptions.Item label="预计用时">{seg.estimated_time ? `${seg.estimated_time} 分钟` : '-'}</Descriptions.Item>
        {seg.slope_type && <Descriptions.Item label="坡度类型">{seg.slope_type}</Descriptions.Item>}
        {seg.terrain_type && <Descriptions.Item label="地形">{seg.terrain_type}</Descriptions.Item>}
        <Descriptions.Item label="轨迹范围" span={2}>
          {seg.track_start_index != null ? `#${seg.track_start_index} ~ #${seg.track_end_index}` : '-'}
        </Descriptions.Item>
        {seg.description && <Descriptions.Item label="描述" span={2}>{seg.description}</Descriptions.Item>}
        {seg.notes && <Descriptions.Item label="备注" span={2}>{seg.notes}</Descriptions.Item>}
      </Descriptions>
    ),
  });

  const items = combine
    ? days.map((day, di) => {
        const inner = slopeSegs
          .map((s, si) => ({ s, si }))
          .filter(({ s }) =>
            s.track_start_index != null &&
            day.track_start_index != null &&
            day.track_end_index != null &&
            s.track_start_index >= day.track_start_index &&
            s.track_start_index <= day.track_end_index
          );
        return {
          ...segRow(day, di, { color: day.color || getSegColor(di), bold: true, noCheckbox: true, noActions: false }),
          children: (
            <>
              {inner.length > 0 ? (
                <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
                  该天包含 {inner.length} 个坡度路段
                </div>
              ) : (
                <div style={{ marginBottom: 8, color: '#999', fontSize: 12 }}>该天范围内无坡度路段</div>
              )}
              <Collapse
                size="small"
                items={inner.map(({ s, si }) => segRow(s, si, { color: s.color || getSegColor(si) }))}
              />
            </>
          ),
        };
      })
    : days.map((seg, i) => segRow(seg, i, { color: seg.color || getSegColor(i) }));

  return (
    <div>
      <div style={{ marginBottom: 10 }}>
        <RouteMap
          key={`${schemeKey}-${combine ? 'combine' : 'flat'}`}
          route={route}
          mode="segments"
          segments={days}
          overlaySegments={combine ? slopeSegs : null}
          focus={focus}
        />
      </div>
      {combine && (
        <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
          结合展示：地图上粗半透明色带为按天区间，细实线为坡度路段；点击色点或"定位"可在地图上聚焦。
        </div>
      )}
      <Collapse size="small" items={items} />
    </div>
  );
};

const Routes = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState(undefined);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);

  // 手动创建路线
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', region: '', difficulty: 2, is_loop: false });

  // KML 分析
  const [kmlUrl, setKmlUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const pollTimerRef = useRef(null);

  // 路段拆分
  const [splitModal, setSplitModal] = useState(null);
  const [splitIndex, setSplitIndex] = useState(null);
  const [splitPointId, setSplitPointId] = useState(null);
  const [splitSubmitting, setSplitSubmitting] = useState(false);

  // 分段方案切换 + 多选合并
  const [activeSchemeId, setActiveSchemeId] = useState(null);
  const schemeSelectionRef = useRef({}); // routeId -> 最后选择的方案ID，关闭弹窗后仍记住
  const [selectedSegIds, setSelectedSegIds] = useState([]);
  const [merging, setMerging] = useState(false);
  const [segFocus, setSegFocus] = useState(null); // { type, id, ts }

  // POI 勾选采纳
  const [selectedPoiIds, setSelectedPoiIds] = useState([]);

  // POI AI 筛选入库
  const [poiFiltering, setPoiFiltering] = useState(false);
  const [poiFilterOpen, setPoiFilterOpen] = useState(false);
  const [poiFilterRows, setPoiFilterRows] = useState([]); // {poi_id,name,...,action,reason,selected}
  const [poiSaving, setPoiSaving] = useState(false);
  const [poiFocus, setPoiFocus] = useState(null);

  // 改名
  const [renameTarget, setRenameTarget] = useState(null); // { type: 'segment'|'poi', id, name }
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);

  // 编辑路线（管理端）
  const [editRoute, setEditRoute] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', region: '', difficulty: 2, is_loop: false });
  const [editSubmitting, setEditSubmitting] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, [currentPage, pageSize]);

  // 卸载时清理轮询定时器
  useEffect(() => () => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);
  }, []);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await routeApi.getRoutes(currentPage - 1, pageSize, searchText, selectedDifficulty);

      if (response && response.content) {
        setData(response.content);
        setTotal(response.totalElements || 0);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('加载路线列表失败:', error);
      message.error('加载路线列表失败');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const stopPolling = () => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  };

  const reloadRouteDetail = async (routeId) => {
    try {
      const detail = await routeApi.getRouteById(routeId || selectedRoute.id);
      setSelectedRoute(detail);
      if (activeSchemeId && !(detail.segment_schemes || []).some((s) => s.id === activeSchemeId)) {
        setActiveSchemeId(null);
      }
      // 清理已不存在的选择项
      setSelectedSegIds((prev) => prev.filter((id) =>
        (detail.segment_schemes || []).some((s) => (s.segments || []).some((x) => x.id === id))
      ));
      setSelectedPoiIds((prev) => prev.filter((id) => (detail.poi_points || []).some((p) => p.id === id)));
    } catch (error) {
      console.error('刷新路线详情失败:', error);
    }
  };

  const showRouteDetail = async (route) => {
    setDetailModalVisible(true);
    setSelectedRoute(route);
    setDetailLoading(true);
    setAnalysisProgress(null);
    setKmlUrl('');
    setActiveSchemeId(schemeSelectionRef.current[route.id] || null);
    setSelectedSegIds([]);
    setSelectedPoiIds([]);
    try {
      const detail = await routeApi.getRouteById(route.id);
      setSelectedRoute(detail);
      setKmlUrl(detail.kml_url || '');
    } catch (error) {
      console.error('加载路线详情失败:', error);
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  // ===================== 手动创建路线 =====================
  const handleCreateRoute = async () => {
    if (!createForm.name.trim()) {
      message.warning('请输入路线名称');
      return;
    }
    setCreating(true);
    try {
      const user = JSON.parse(localStorage.getItem('walk_admin_user') || '{}');
      await routeApi.createRoute({
        name: createForm.name.trim(),
        description: createForm.description.trim() || null,
        region: createForm.region.trim() || null,
        difficulty: createForm.difficulty,
        created_by: user.id || 'admin',
      });
      message.success('路线创建成功，可在详情中绑定 KML 并发起分析');
      setCreateModalVisible(false);
      setCreateForm({ name: '', description: '', region: '', difficulty: 2, is_loop: false });
      setCurrentPage(1);
      loadRoutes();
    } catch (error) {
      console.error('创建路线失败:', error);
      message.error(error.response?.data?.message || '创建路线失败');
    } finally {
      setCreating(false);
    }
  };

  // ===================== 编辑路线（管理端） =====================
  const openEditModal = (route) => {
    setEditRoute(route);
    setEditForm({
      name: route.name || '',
      description: route.description || '',
      region: route.region || '',
      difficulty: route.difficulty || 2,
      is_loop: !!route.is_loop,
    });
  };

  const handleEditSubmit = async () => {
    if (!editForm.name.trim()) {
      message.warning('请输入路线名称');
      return;
    }
    setEditSubmitting(true);
    try {
      await routeApi.updateRoute(editRoute.id, {
        name: editForm.name.trim(),
        description: editForm.description.trim() || null,
        region: editForm.region.trim() || null,
        difficulty: editForm.difficulty,
        is_loop: editForm.is_loop,
      });
      message.success('路线已更新');
      setEditRoute(null);
      loadRoutes();
    } catch (error) {
      console.error('更新路线失败:', error);
      message.error(error.response?.data?.message || '更新路线失败');
    } finally {
      setEditSubmitting(false);
    }
  };

  // ===================== 路线状态流转 / 删除（管理端） =====================
  const handleStatusChange = async (route, targetStatus) => {
    try {
      await routeApi.changeRouteStatus(route.id, targetStatus);
      message.success(`路线已${getRouteStatusText(targetStatus)}`);
      loadRoutes();
    } catch (error) {
      console.error('状态流转失败:', error);
      const msg = error.response?.data?.message || '状态流转失败';
      // 发布前检查失败等场景，弹窗展示完整原因
      Modal.warning({ title: '操作未完成', content: msg });
    }
  };

  const doDeleteRoute = async (route, force) => {
    try {
      await routeApi.deleteRoute(route.id, force);
      message.success('路线已删除');
      loadRoutes();
    } catch (error) {
      console.error('删除路线失败:', error);
      const msg = error.response?.data?.message || '';
      // 被未取消行程引用时，后端返回 409，提供强制删除入口
      if (error.response?.status === 409 && !force) {
        Modal.confirm({
          title: '路线被行程引用',
          content: msg,
          okText: '强制删除',
          okButtonProps: { danger: true },
          cancelText: '取消',
          onOk: () => doDeleteRoute(route, true),
        });
        return;
      }
      message.error(msg || '删除路线失败');
    }
  };

  const handleDeleteRoute = (route) => doDeleteRoute(route, false);

  // ===================== KML 分析 =====================
  const startAnalysis = async () => {
    if (!kmlUrl.trim()) {
      message.warning('请输入 KML 文件 URL');
      return;
    }
    setAnalyzing(true);
    setAnalysisProgress({ progress: 0, current_step: '提交中', message: '' });
    try {
      const result = await agentServiceApi.submitAnalysis({
        kml_source: kmlUrl.trim(),
        route_id: selectedRoute.id,
        enable_content_generation: true,
        enable_poi_query: true,
        poi_search_radius: 500,
        region_name: selectedRoute.region || undefined,
      });
      const taskId = result.task_id;
      message.success('分析任务已提交');
      stopPolling();
      pollTimerRef.current = setInterval(async () => {
        try {
          const status = await agentServiceApi.getTaskStatus(taskId);
          setAnalysisProgress({
            progress: status.progress || 0,
            current_step: status.current_step || '',
            message: status.message || '',
          });
          if (status.status === 'completed') {
            stopPolling();
            setAnalyzing(false);
            setAnalysisProgress(null);
            message.success('KML 分析完成，结果已写入草稿，请采纳或调整');
            setActiveSchemeId(null);
            setSelectedSegIds([]);
            reloadRouteDetail(selectedRoute.id);
          } else if (status.status === 'failed') {
            stopPolling();
            setAnalyzing(false);
            message.error(`分析失败: ${status.error || '未知错误'}`);
            setAnalysisProgress(null);
            reloadRouteDetail(selectedRoute.id);
          }
        } catch (err) {
          console.error('查询任务状态失败:', err);
        }
      }, 5000);
    } catch (error) {
      console.error('提交分析任务失败:', error);
      message.error(error.response?.data?.message || '提交分析任务失败');
      setAnalyzing(false);
      setAnalysisProgress(null);
    }
  };

  // ===================== 采纳 / 拆分 / 合并 / 改名 =====================
  const handleAdoptSegment = async (seg) => {
    try {
      await routeApi.adoptSegment(selectedRoute.id, seg.id);
      message.success(`路段「${seg.name}」已采纳`);
      reloadRouteDetail();
    } catch (error) {
      console.error('采纳路段失败:', error);
      message.error('采纳路段失败');
    }
  };

  const handleAdoptAllSegments = async () => {
    try {
      const result = await routeApi.adoptAllSegments(selectedRoute.id);
      message.success(`已批量采纳 ${result.adopted} 个路段`);
      reloadRouteDetail();
    } catch (error) {
      console.error('批量采纳路段失败:', error);
      message.error('批量采纳路段失败');
    }
  };

  const handleMergeSegments = async () => {
    if (selectedSegIds.length < 2) {
      message.warning('请至少选择两个路段进行合并');
      return;
    }
    Modal.confirm({
      title: `合并 ${selectedSegIds.length} 个路段`,
      content: '将按轨迹顺序合并为一个路段：轨迹区间取并集，距离/爬升/用时累加，名称默认取第一个路段（合并后可改名）。是否继续？',
      okText: '合并',
      cancelText: '取消',
      onOk: async () => {
        setMerging(true);
        try {
          await routeApi.mergeSegments(selectedRoute.id, selectedSegIds);
          message.success('路段合并成功');
          setSelectedSegIds([]);
          reloadRouteDetail();
        } catch (error) {
          console.error('合并路段失败:', error);
          message.error(error.response?.data?.message || '合并路段失败');
        } finally {
          setMerging(false);
        }
      },
    });
  };

  const handleAdoptPoi = async (poi) => {
    try {
      await routeApi.adoptPoi(selectedRoute.id, poi.id);
      message.success(`POI「${poi.name}」已采纳`);
      reloadRouteDetail();
    } catch (error) {
      console.error('采纳 POI 失败:', error);
      message.error('采纳 POI 失败');
    }
  };

  const handleAdoptSelectedPois = async () => {
    if (selectedPoiIds.length === 0) {
      message.warning('请先勾选要采纳的 POI');
      return;
    }
    try {
      for (const id of selectedPoiIds) {
        await routeApi.adoptPoi(selectedRoute.id, id);
      }
      message.success(`已采纳所选 ${selectedPoiIds.length} 个 POI`);
      setSelectedPoiIds([]);
      reloadRouteDetail();
    } catch (error) {
      console.error('批量采纳 POI 失败:', error);
      message.error('批量采纳 POI 失败');
      reloadRouteDetail();
    }
  };

  const handleAdoptAllPois = async () => {
    try {
      const result = await routeApi.adoptAllPois(selectedRoute.id);
      message.success(`已批量采纳 ${result.adopted} 个 POI`);
      setSelectedPoiIds([]);
      reloadRouteDetail();
    } catch (error) {
      console.error('批量采纳 POI 失败:', error);
      message.error('批量采纳 POI 失败');
    }
  };

  // AI 筛选 POI：调后端代理 → LLM 逐个判断 → 打开预览弹窗（默认勾选 AI 保留项）
  const startPoiFilter = async () => {
    setPoiFiltering(true);
    try {
      const result = await routeApi.filterPoisPreview(selectedRoute.id);
      const rows = (result.items || []).map((it) => ({
        ...it,
        selected: it.action !== 'reject',
      }));
      if (rows.length === 0) {
        message.info('当前路线没有可筛选的 POI');
        return;
      }
      setPoiFilterRows(rows);
      setPoiFilterOpen(true);
      if (result.degraded) {
        message.warning('部分 POI 筛选失败已默认保留，请人工确认');
      }
    } catch (error) {
      console.error('AI 筛选 POI 失败:', error);
      message.error(error.response?.data?.message || 'AI 筛选 POI 失败');
    } finally {
      setPoiFiltering(false);
    }
  };

  // 确认入库：勾选项存入全局 POI 库并回写为已采纳
  const confirmPoiLibrarySave = async () => {
    const selected = poiFilterRows.filter((r) => r.selected);
    if (selected.length === 0) {
      message.warning('请至少勾选一个要入库的 POI');
      return;
    }
    setPoiSaving(true);
    try {
      const result = await routeApi.savePoiLibrary(
        selectedRoute.id,
        selected.map((r) => ({
          poi_id: r.poi_id,
          name: r.name,
          latitude: r.latitude,
          longitude: r.longitude,
          elevation: r.elevation,
          category: r.category,
          sub_category: r.sub_category,
          description: r.description,
          ai_reason: r.reason,
        }))
      );
      message.success(`已入库 ${result.saved + result.updated} 个 POI，采纳 ${result.confirmed_pois} 个`);
      setPoiFilterOpen(false);
      reloadRouteDetail();
    } catch (error) {
      console.error('POI 入库失败:', error);
      message.error(error.response?.data?.message || 'POI 入库失败');
    } finally {
      setPoiSaving(false);
    }
  };

  const openSplitModal = (seg) => {
    setSplitModal(seg);
    setSplitIndex(null);
    setSplitPointId(null);
  };

  const handleSplitSubmit = async () => {
    if (splitIndex === null || splitIndex === undefined) {
      message.warning('请输入拆分索引');
      return;
    }
    setSplitSubmitting(true);
    try {
      const point = splitPointId
        ? (selectedRoute.track_points || []).find((tp) => tp.id === splitPointId)
        : null;
      const splitPoint = point
        ? { latitude: point.latitude, longitude: point.longitude, elevation: point.elevation, name: point.name || undefined }
        : null;
      await routeApi.splitSegment(selectedRoute.id, splitModal.id, splitIndex, splitPoint);
      message.success('路段拆分成功');
      setSplitModal(null);
      reloadRouteDetail();
    } catch (error) {
      console.error('拆分路段失败:', error);
      message.error(error.response?.data?.message || '拆分路段失败');
    } finally {
      setSplitSubmitting(false);
    }
  };

  const openRenameModal = (type, item) => {
    setRenameTarget({ type, id: item.id });
    setRenameValue(item.name || '');
  };

  const handleRenameSubmit = async () => {
    if (!renameValue.trim()) {
      message.warning('名称不能为空');
      return;
    }
    setRenaming(true);
    try {
      if (renameTarget.type === 'segment') {
        await routeApi.renameSegment(selectedRoute.id, renameTarget.id, renameValue.trim());
      } else {
        await routeApi.renamePoi(selectedRoute.id, renameTarget.id, renameValue.trim());
      }
      message.success('改名成功');
      setRenameTarget(null);
      reloadRouteDetail();
    } catch (error) {
      console.error('改名失败:', error);
      message.error('改名失败');
    } finally {
      setRenaming(false);
    }
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 120,
    },
    {
      title: '路线名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status) => (
        <Tag color={getRouteStatusColor(status)}>{getRouteStatusText(status)}</Tag>
      ),
    },
    {
      title: '区域',
      dataIndex: 'region',
      key: 'region',
      render: (text) => text || '-',
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      render: (difficulty) => (
        <Tag color={getDifficultyTagColor(difficulty)}>
          {getDifficultyText(difficulty)}
        </Tag>
      ),
    },
    {
      title: '人气',
      dataIndex: 'popularity',
      key: 'popularity',
      render: (popularity) => popularity || 0,
    },
    {
      title: '创建者',
      dataIndex: 'createdBy',
      key: 'createdBy',
      render: (createdBy) => createdBy || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (timestamp) => formatTimestamp(timestamp),
    },
    {
      title: '操作',
      key: 'action',
      width: 280,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showRouteDetail(record)}
          >
            查看
          </Button>
          {record.status !== 3 && (
            <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)}>
              编辑
            </Button>
          )}
          {record.status === 0 && (
            <Popconfirm
              title="发布该路线？"
              description="发布前会自动检查轨迹数据与未采纳草稿"
              onConfirm={() => handleStatusChange(record, 1)}
            >
              <Button size="small" type="primary" ghost icon={<SendOutlined />}>
                发布
              </Button>
            </Popconfirm>
          )}
          {record.status === 1 && (
            <Popconfirm title="下线该路线？下线后 C 端不可见，路线回到规划中。" onConfirm={() => handleStatusChange(record, 0)}>
              <Button size="small" icon={<StopOutlined />}>
                下线
              </Button>
            </Popconfirm>
          )}
          {record.status === 2 && (
            <Popconfirm title="重新发布该路线？" onConfirm={() => handleStatusChange(record, 1)}>
              <Button size="small" type="primary" ghost icon={<SendOutlined />}>
                重新发布
              </Button>
            </Popconfirm>
          )}
          {record.status !== 3 && (
            <Popconfirm
              title="删除该路线？"
              description="软删除后列表与 C 端均不可见，且不可恢复"
              onConfirm={() => handleDeleteRoute(record)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  // 分段方案辅助
  const getSchemes = () => selectedRoute?.segment_schemes || [];
  const getActiveScheme = () => {
    const schemes = getSchemes();
    if (!schemes.length) return null;
    if (activeSchemeId) {
      const found = schemes.find((s) => s.id === activeSchemeId);
      if (found) return found; // 被重新分析替换后自动回退到默认方案
    }
    return schemes.slice().sort((a, b) => (b.segments?.length || 0) - (a.segments?.length || 0))[0];
  };
  const activeScheme = getActiveScheme();
  const activeSegments = activeScheme?.segments || [];
  const draftSegCount = activeSegments.filter((s) => s.status === 'draft').length;
  const draftPoiCount = (selectedRoute?.poi_points || []).filter((p) => p.status === 'draft').length;

  const renderStatusTag = (status) => (
    status === 'draft'
      ? <Tag color="orange" style={{ marginRight: 4 }}>AI建议</Tag>
      : <Tag color="green" style={{ marginRight: 4 }}>已采纳</Tag>
  );

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>路线管理</h2>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Search
            placeholder="搜索路线名称..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => {
              setCurrentPage(1);
              loadRoutes();
            }}
          />
          <Select
            placeholder="选择难度"
            allowClear
            style={{ width: 150 }}
            value={selectedDifficulty}
            onChange={(value) => {
              setSelectedDifficulty(value);
              setCurrentPage(1);
              loadRoutes();
            }}
          >
            <Option value="1">简单</Option>
            <Option value="2">较易</Option>
            <Option value="3">中等</Option>
            <Option value="4">较难</Option>
            <Option value="5">困难</Option>
          </Select>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setCreateModalVisible(true)}
          >
            手动创建路线
          </Button>
          <Button icon={<ReloadOutlined />} onClick={loadRoutes}>
            刷新
          </Button>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          pagination={{
            current: currentPage,
            pageSize: pageSize,
            total: total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
            onChange: (page, size) => {
              setCurrentPage(page);
              setPageSize(size);
            },
          }}
        />
      </Spin>

      {/* 手动创建路线 Modal */}
      <Modal
        title="手动创建路线"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onOk={handleCreateRoute}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 4 }}>路线名称 <span style={{ color: 'red' }}>*</span></div>
            <Input
              placeholder="如：五台山顺朝"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>区域</div>
            <Input
              placeholder="如：山西五台山"
              value={createForm.region}
              onChange={(e) => setCreateForm({ ...createForm, region: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>难度</div>
            <Select
              style={{ width: '100%' }}
              value={createForm.difficulty}
              onChange={(value) => setCreateForm({ ...createForm, difficulty: value })}
            >
              <Option value={1}>简单</Option>
              <Option value={2}>较易</Option>
              <Option value={3}>中等</Option>
              <Option value={4}>较难</Option>
              <Option value={5}>困难</Option>
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>是否环线</div>
            <Select
              style={{ width: '100%' }}
              value={createForm.is_loop}
              onChange={(value) => setCreateForm({ ...createForm, is_loop: value })}
            >
              <Option value={false}>否</Option>
              <Option value={true}>是</Option>
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>描述</div>
            <Input.TextArea
              rows={3}
              placeholder="路线简介（可选）"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      {/* 编辑路线 Modal */}
      <Modal
        title={`编辑路线: ${editRoute?.name || ''}`}
        open={!!editRoute}
        onCancel={() => setEditRoute(null)}
        onOk={handleEditSubmit}
        confirmLoading={editSubmitting}
        okText="保存"
        cancelText="取消"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ marginBottom: 4 }}>路线名称 <span style={{ color: 'red' }}>*</span></div>
            <Input
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>区域</div>
            <Input
              value={editForm.region}
              onChange={(e) => setEditForm({ ...editForm, region: e.target.value })}
            />
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>难度</div>
            <Select
              style={{ width: '100%' }}
              value={editForm.difficulty}
              onChange={(value) => setEditForm({ ...editForm, difficulty: value })}
            >
              <Option value={1}>简单</Option>
              <Option value={2}>较易</Option>
              <Option value={3}>中等</Option>
              <Option value={4}>较难</Option>
              <Option value={5}>困难</Option>
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>是否环线</div>
            <Select
              style={{ width: '100%' }}
              value={editForm.is_loop}
              onChange={(value) => setEditForm({ ...editForm, is_loop: value })}
            >
              <Option value={false}>否</Option>
              <Option value={true}>是</Option>
            </Select>
          </div>
          <div>
            <div style={{ marginBottom: 4 }}>描述</div>
            <Input.TextArea
              rows={3}
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
            />
          </div>
        </div>
      </Modal>

      <Modal
        title="路线详情"
        open={detailModalVisible}
        onCancel={() => {
          stopPolling();
          setAnalyzing(false);
          setDetailModalVisible(false);
        }}
        footer={[
          <Button key="close" onClick={() => {
            stopPolling();
            setAnalyzing(false);
            setDetailModalVisible(false);
          }}>
            关闭
          </Button>,
        ]}
        width={860}
      >
        <Spin spinning={detailLoading}>
        {selectedRoute && (
          <div>
            {/* KML 分析区 */}
            <div style={{ marginBottom: 16, padding: 12, background: '#f6f8fa', borderRadius: 8 }}>
              <div style={{ marginBottom: 8, fontWeight: 600 }}>
                <RocketOutlined /> KML 分析（结果仅作参考草稿，需人工采纳）
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  placeholder="KML 文件 URL，如 /walkbg/static/kml/wutaishan.kml"
                  value={kmlUrl}
                  onChange={(e) => setKmlUrl(e.target.value)}
                  disabled={analyzing}
                />
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  loading={analyzing}
                  onClick={startAnalysis}
                  disabled={!kmlUrl.trim() || analyzing}
                >
                  开始分析
                </Button>
              </Space.Compact>
              {analysisProgress && (
                <div style={{ marginTop: 8 }}>
                  <Progress percent={analysisProgress.progress} size="small" status="active" />
                  <div style={{ color: '#666', fontSize: 12 }}>
                    {analysisProgress.current_step} {analysisProgress.message ? `- ${analysisProgress.message}` : ''}
                  </div>
                </div>
              )}
            </div>

            <Tabs
              defaultActiveKey="basic"
              items={[
              {
                key: 'basic',
                label: '基本信息',
                children: (
                  <Descriptions bordered column={2} size="small">
                    <Descriptions.Item label="路线ID" span={2}>{selectedRoute.id}</Descriptions.Item>
                    <Descriptions.Item label="路线名称">{selectedRoute.name || '-'}</Descriptions.Item>
                    <Descriptions.Item label="区域">{selectedRoute.region || '-'}</Descriptions.Item>
                    <Descriptions.Item label="难度">
                      <Tag color={getDifficultyTagColor(selectedRoute.difficulty)}>{getDifficultyText(selectedRoute.difficulty)}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="是否环线">{selectedRoute.is_loop ? '是' : '否'}</Descriptions.Item>
                    <Descriptions.Item label="距离">{selectedRoute.distance ? `${selectedRoute.distance} km` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="爬升">{selectedRoute.elevation_gain ? `${selectedRoute.elevation_gain} m` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="下降">{selectedRoute.elevation_loss ? `${selectedRoute.elevation_loss} m` : '-'}</Descriptions.Item>
                    <Descriptions.Item label="人气值">{selectedRoute.popularity || 0}</Descriptions.Item>
                    <Descriptions.Item label="状态">
                      {selectedRoute.status === 0 && <Tag color="default">规划中</Tag>}
                      {selectedRoute.status === 1 && <Tag color="success">已发布</Tag>}
                      {selectedRoute.status === 2 && <Tag color="default">已关闭</Tag>}
                      {selectedRoute.status === 3 && <Tag color="processing">分析中</Tag>}
                    </Descriptions.Item>
                    <Descriptions.Item label="创建时间">{formatTimestamp(selectedRoute.created_at || selectedRoute.createdAt)}</Descriptions.Item>
                    <Descriptions.Item label="描述" span={2}>{selectedRoute.description || '-'}</Descriptions.Item>
                  </Descriptions>
                )
              },
              {
                key: 'segments',
                label: (() => {
                  const segCount = activeSegments.length;
                  return <span><ThunderboltOutlined /> 分段 <Badge count={segCount} style={{ backgroundColor: '#1677ff' }} /></span>;
                })(),
                children: (() => {
                  const schemes = getSchemes();
                  if (schemes.length === 0 || activeSegments.length === 0) {
                    // 按天方案无数据：KML 缺少时间戳等关键信息，无法判断
                    let emptyMsg = <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>暂无路段数据，可绑定 KML 并点击"开始分析"生成建议分段</div>;
                    if (activeScheme?.scheme_type === 'day') {
                      emptyMsg = <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>无法判断：KML 轨迹无时间戳信息，无法按天拆分</div>;
                    }
                    return (
                      <div>
                        {schemes.length > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 8 }}>
                            <Select
                              style={{ minWidth: 220 }}
                              value={activeScheme?.id}
                              onChange={(v) => { setActiveSchemeId(v); schemeSelectionRef.current[selectedRoute.id] = v; setSelectedSegIds([]); }}
                              size="small"
                            >
                              {schemes.map((s) => (
                                <Option key={s.id} value={s.id}>
                                  {`${s.label || s.scheme_type} (${s.segments?.length || 0} 个路段${s.segments?.some((x) => x.status === 'draft') ? '，含草稿' : ''})`}
                                </Option>
                              ))}
                            </Select>
                          </div>
                        )}
                    {emptyMsg}
                  </div>
                );
              }
              // 按天方案下尝试取坡度方案做结合展示
              const slopeScheme = activeScheme?.scheme_type === 'day'
                ? schemes
                    .filter((s) => s.scheme_type === 'slope')
                    .sort((a, b) => (b.segments?.length || 0) - (a.segments?.length || 0))[0]
                : null;
              return (
                <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, gap: 8, flexWrap: 'wrap' }}>
                        <Select
                          style={{ minWidth: 220 }}
                          value={activeScheme?.id}
                          onChange={(v) => { setActiveSchemeId(v); schemeSelectionRef.current[selectedRoute.id] = v; setSelectedSegIds([]); }}
                          size="small"
                        >
                          {schemes.map((s) => (
                            <Option key={s.id} value={s.id}>
                              {`${s.label || s.scheme_type} (${s.segments?.length || 0} 个路段${s.segments?.some((x) => x.status === 'draft') ? '，含草稿' : ''})`}
                            </Option>
                          ))}
                        </Select>
                        <Space size="small">
                          {selectedSegIds.length >= 2 && (
                            <Button size="small" type="primary" icon={<MergeCellsOutlined />} loading={merging} onClick={handleMergeSegments}>
                              合并所选 ({selectedSegIds.length})
                            </Button>
                          )}
                          {draftSegCount > 0 && (
                            <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={handleAdoptAllSegments}>
                              全部采纳
                            </Button>
                          )}
                        </Space>
                      </div>
                      <CombinedDaySegments
                        route={selectedRoute}
                        days={activeSegments}
                        slopeSegs={slopeScheme?.segments || []}
                        isDayScheme={activeScheme?.scheme_type === 'day'}
                        schemeKey={activeScheme?.id}
                        focus={segFocus}
                        onFocus={setSegFocus}
                        onAdopt={handleAdoptSegment}
                        onRename={(seg) => openRenameModal('segment', seg)}
                        onSplit={(seg) => openSplitModal(seg)}
                        renderStatusTag={renderStatusTag}
                        selectedSegIds={selectedSegIds}
                        onToggleSegSelect={(id, checked) => setSelectedSegIds((prev) => checked ? [...prev, id] : prev.filter((x) => x !== id))}
                      />
                    </div>
                  );
                })(),
              },
              {
                key: 'pois',
                label: <span><EnvironmentOutlined /> POI <Badge count={selectedRoute.poi_points?.length || 0} style={{ backgroundColor: '#52c41a' }} /></span>,
                children: (() => {
                  const poiPoints = selectedRoute.poi_points || [];
                  if (poiPoints.length === 0) {
                    return <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>暂无 POI 数据</div>;
                  }
                  const poiColumns = [
                    { title: '名称', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
                    {
                      title: '分类',
                      dataIndex: 'category',
                      key: 'category',
                      width: 110,
                      filters: Object.entries(CATEGORY_META).map(([value, meta]) => ({ text: meta.label, value })),
                      onFilter: (value, record) => record.category === value,
                      render: (cat) => {
                        const meta = CATEGORY_META[cat] || { label: `📍 ${cat}`, color: 'default' };
                        return <Tag color={meta.color}>{meta.label}</Tag>;
                      },
                    },
                    { title: '海拔(m)', dataIndex: 'elevation', key: 'elevation', width: 90, sorter: (a, b) => (a.elevation || 0) - (b.elevation || 0), render: (v) => v ?? '-' },
                    {
                      title: '状态',
                      dataIndex: 'status',
                      key: 'status',
                      width: 90,
                      filters: [{ text: 'AI建议', value: 'draft' }, { text: '已采纳', value: 'confirmed' }],
                      onFilter: (value, record) => (record.status || 'confirmed') === value,
                      render: (status) => (status === 'draft' ? <Tag color="orange">AI建议</Tag> : <Tag color="green">已采纳</Tag>),
                    },
                    { title: '来源', dataIndex: 'source', key: 'source', width: 90, render: (v) => v || '-' },
                    {
                      title: '操作',
                      key: 'action',
                      width: 180,
                      render: (_, record) => (
                        <Space size="small">
                          <Button size="small" type="link" icon={<AimOutlined />} onClick={() => setPoiFocus({ type: 'poi', id: record.id, ts: Date.now() })}>
                            定位
                          </Button>
                          <Button size="small" type="link" icon={<EditOutlined />} onClick={() => openRenameModal('poi', record)}>
                            改名
                          </Button>
                          {record.status === 'draft' && (
                            <Button size="small" type="link" icon={<CheckOutlined />} onClick={() => handleAdoptPoi(record)}>
                              采纳
                            </Button>
                          )}
                        </Space>
                      ),
                    },
                  ];
                  return (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
                        <Button
                          size="small"
                          icon={<RobotOutlined />}
                          loading={poiFiltering}
                          onClick={startPoiFilter}
                        >
                          AI 筛选入库
                        </Button>
                        {selectedPoiIds.length > 0 && (
                          <Button size="small" type="primary" icon={<CheckOutlined />} onClick={handleAdoptSelectedPois}>
                            采纳所选 ({selectedPoiIds.length})
                          </Button>
                        )}
                        {draftPoiCount > 0 && (
                          <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={handleAdoptAllPois}>
                            全部采纳 ({draftPoiCount} 个待采纳)
                          </Button>
                        )}
                      </div>
                      <div style={{ marginBottom: 10 }}>
                        <RouteMap
                          route={selectedRoute}
                          mode="pois"
                          pois={poiPoints}
                          focus={poiFocus}
                        />
                      </div>
                      <Table
                        size="small"
                        columns={poiColumns}
                        dataSource={poiPoints}
                        rowKey="id"
                        pagination={{ pageSize: 8, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
                        rowSelection={{
                          selectedRowKeys: selectedPoiIds,
                          onChange: (keys) => setSelectedPoiIds(keys),
                          selections: true,
                        }}
                        onRow={(record) => ({
                          onClick: () => setPoiFocus({ type: 'poi', id: record.id, ts: Date.now() }),
                          style: { cursor: 'pointer' },
                        })}
                      />
                    </div>
                  );
                })(),
              }
            ]}
          />
          </div>
        )}
        </Spin>
      </Modal>

      {/* 拆分路段 Modal */}
      <Modal
        title={`拆分路段: ${splitModal?.name || ''}`}
        open={!!splitModal}
        onCancel={() => setSplitModal(null)}
        onOk={handleSplitSubmit}
        confirmLoading={splitSubmitting}
        okText="拆分"
        cancelText="取消"
      >
        {splitModal && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ color: '#666', fontSize: 12 }}>
              该路段覆盖轨迹索引 #{splitModal.track_start_index} ~ #{splitModal.track_end_index}。
              拆分索引为新路段（后段）的起始索引，范围 ({splitModal.track_start_index}, {splitModal.track_end_index}]。
              距离/海拔将按索引比例估算。
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>拆分索引 <span style={{ color: 'red' }}>*</span></div>
              <InputNumber
                style={{ width: '100%' }}
                min={splitModal.track_start_index + 1}
                max={splitModal.track_end_index}
                value={splitIndex}
                onChange={(v) => setSplitIndex(v)}
                placeholder={`输入 ${splitModal.track_start_index + 1} ~ ${splitModal.track_end_index} 之间的索引`}
              />
            </div>
            <div>
              <div style={{ marginBottom: 4 }}>拆分点坐标（可选，从轨迹点中选择）</div>
              <Select
                style={{ width: '100%' }}
                allowClear
                placeholder="选择轨迹点作为拆分点坐标"
                value={splitPointId}
                onChange={(v) => setSplitPointId(v)}
              >
                {(selectedRoute?.track_points || []).map((tp) => (
                  <Option key={tp.id} value={tp.id}>
                    {`#${tp.sequence_number} ${tp.name || ''} (${tp.latitude?.toFixed(4)}, ${tp.longitude?.toFixed(4)}) ${tp.elevation ? tp.elevation + 'm' : ''}`}
                  </Option>
                ))}
              </Select>
            </div>
          </div>
        )}
      </Modal>

      {/* 改名 Modal */}
      <Modal
        title={renameTarget?.type === 'segment' ? '路段改名' : 'POI 改名'}
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={handleRenameSubmit}
        confirmLoading={renaming}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="输入新名称"
          onPressEnter={handleRenameSubmit}
        />
      </Modal>

      {/* POI AI 筛选预览 Modal */}
      <Modal
        title={
          <span>
            <RobotOutlined /> AI 筛选预览
            <span style={{ fontWeight: 400, fontSize: 12, color: '#888', marginLeft: 8 }}>
              共 {poiFilterRows.length} 个：保留 {poiFilterRows.filter((r) => r.action === 'keep').length} / 建议剔除{' '}
              {poiFilterRows.filter((r) => r.action === 'reject').length}
            </span>
          </span>
        }
        open={poiFilterOpen}
        onCancel={() => setPoiFilterOpen(false)}
        width={860}
        footer={[
          <Button key="cancel" onClick={() => setPoiFilterOpen(false)}>
            取消
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<CheckOutlined />}
            loading={poiSaving}
            onClick={confirmPoiLibrarySave}
          >
            入库并采纳所选 ({poiFilterRows.filter((r) => r.selected).length})
          </Button>,
        ]}
      >
        <div style={{ marginBottom: 8, color: '#888', fontSize: 12 }}>
          勾选的 POI 将存入全局 POI 库并回写为“已采纳”；未勾选的保持不变。后续路线分析时会优先匹配库内 POI 自动复用。
        </div>
        <Table
          size="small"
          rowKey="poi_id"
          dataSource={poiFilterRows}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          rowSelection={{
            selectedRowKeys: poiFilterRows.filter((r) => r.selected).map((r) => r.poi_id),
            onChange: (keys) => {
              setPoiFilterRows((prev) => prev.map((r) => ({ ...r, selected: keys.includes(r.poi_id) })));
            },
          }}
          columns={[
            {
              title: '名称',
              dataIndex: 'name',
              width: 180,
              ellipsis: true,
            },
            {
              title: 'AI 建议',
              dataIndex: 'action',
              width: 90,
              render: (action) =>
                action === 'reject' ? <Tag color="red">建议剔除</Tag> : <Tag color="green">保留</Tag>,
            },
            {
              title: '类别',
              dataIndex: 'category',
              width: 100,
              render: (cat, record) => {
                const meta = CATEGORY_META[cat] || { label: cat, color: 'default' };
                const changed = record.original_category && record.original_category !== cat;
                return (
                  <span>
                    <Tag color={meta.color}>{meta.label}</Tag>
                    {changed && <span style={{ color: '#fa8c16', fontSize: 12 }}>（原：{record.original_category}）</span>}
                  </span>
                );
              },
            },
            {
              title: '海拔(m)',
              dataIndex: 'elevation',
              width: 80,
              render: (v) => v ?? '-',
            },
            {
              title: 'AI 理由',
              dataIndex: 'reason',
              ellipsis: true,
              render: (text, record) => (
                <span title={text} style={{ color: record.action === 'reject' ? '#999' : undefined }}>
                  {text || '-'}
                </span>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default Routes;
