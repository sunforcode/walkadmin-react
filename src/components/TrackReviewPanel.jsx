import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Descriptions, Input, Select, Space, Spin, Tag } from 'antd';
import { routeApi } from '../services/api';

const PUBLIC_STATES = {
  missing: '缺少主轨迹', pending_review: '待审核', valid: '有效', invalidated: '已驳回或失效', processing: '处理中',
};

/** A review records a decision; only a later explicit publication changes public data. */
export default function TrackReviewPanel({ routeId, MapComponent, onReviewed, analysisActive = false, candidateRevision = null }) {
  const [view, setView] = useState(null);
  const [loading, setLoading] = useState(!analysisActive);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [referenceSystem, setReferenceSystem] = useState(null);
  const [reason, setReason] = useState('');
  const requestRef = useRef(null);
  const sessionRef = useRef(0);
  const [reload, setReload] = useState(0);
  const [scope, setScope] = useState({ routeId, analysisActive, candidateRevision, reload });
  const candidateRoute = useMemo(() => ({ id: routeId, track_path: view?.candidate_path || [] }), [routeId, view?.candidate_path]);

  // Reset before committing a different candidate context, not after painting its old form.
  if (scope.routeId !== routeId || scope.analysisActive !== analysisActive
    || scope.candidateRevision !== candidateRevision || scope.reload !== reload) {
    setScope({ routeId, analysisActive, candidateRevision, reload });
    setView(null);
    setLoading(!analysisActive);
    setSaving(false);
    setError('');
    setConfirmed(false);
    setReferenceSystem(null);
    setReason('');
    setSaved(false);
    setStale(false);
  }

  useEffect(() => {
    const session = ++sessionRef.current;
    requestRef.current = null;
    if (!analysisActive) {
      routeApi.getMainTrackReview(routeId).then((data) => {
        if (sessionRef.current === session) setView(data);
      }).catch((failure) => {
        if (sessionRef.current === session) setError(failure.response?.data?.message || failure.message || '审核资料读取失败');
      }).finally(() => {
        if (sessionRef.current === session) setLoading(false);
      });
    }
    return () => { sessionRef.current = session + 1; };
  }, [routeId, reload, analysisActive, candidateRevision]);

  const submit = async (decision) => {
    if (!view || loading || saving || stale || analysisActive || view.analysis_active || !view.geometry_valid) return;
    const session = sessionRef.current;
    const payload = {
      candidate_id: view.candidate_id,
      expected_revision: view.review_revision,
      decision,
      confirm_complete_hiking_range: decision === 'approved' && confirmed,
      reference_system: decision === 'approved' ? referenceSystem : null,
      reason: reason.trim() || null,
    };
    const signature = JSON.stringify(payload);
    if (!requestRef.current || requestRef.current.signature !== signature) {
      requestRef.current = { signature, id: crypto.randomUUID() };
    }
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const result = await routeApi.submitMainTrackReview(routeId, { ...payload, request_id: requestRef.current.id });
      if (sessionRef.current !== session) return;
      setView(result);
      setConfirmed(false);
      setReferenceSystem(null);
      setReason('');
      requestRef.current = null;
      setSaved(true);
      onReviewed?.(routeId);
    } catch (failure) {
      if (sessionRef.current !== session) return;
      const detail = failure.response?.data?.message || failure.message || '审核保存失败';
      if (failure.response?.status === 409) {
        setStale(true);
        setConfirmed(false);
        setReferenceSystem(null);
        requestRef.current = null;
      }
      setError(failure.response?.status === 409 ? `${detail}。请刷新候选后重新查看和确认。` : detail);
    } finally {
      if (sessionRef.current === session) setSaving(false);
    }
  };

  const available = Boolean(view?.candidate_id && view.geometry_valid && !view.analysis_active && !analysisActive && !stale && !loading && !saving);
  const decision = view?.review?.decision;
  const reviewedLabel = decision === 'approved' ? '已通过，等待发布生效' : decision === 'rejected' ? '已驳回' : '待人工审核';

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Alert type="info" showIcon title="候选审核与公开发布是两步"
        description="审核不修改已发布版本。审核通过后，请在路线操作中发布或重新发布，公共主轨迹才会生效。" />
      <Button onClick={() => setReload((value) => value + 1)} disabled={saving || analysisActive} loading={loading}>刷新候选</Button>
      {analysisActive && <Alert type="warning" title="路线正在分析，旧确认已失效，完成后重新读取候选" />}
      {error && <Alert type="error" showIcon title={error} />}
      {saved && <Alert type="success" showIcon title="审核已保存，需发布或重新发布后公开生效" />}
      <Spin spinning={loading}>
        {view && (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            <Descriptions size="small" bordered column={1}>
              <Descriptions.Item label="当前候选审核"><Tag color={decision === 'approved' ? 'green' : decision === 'rejected' ? 'red' : 'orange'}>{reviewedLabel}</Tag></Descriptions.Item>
              <Descriptions.Item label="当前公开版本主轨迹">{PUBLIC_STATES[view.published_main_track_availability] || '尚未公开'}</Descriptions.Item>
              <Descriptions.Item label="候选轨迹点数">{view.candidate_path?.length ?? 0}</Descriptions.Item>
              <Descriptions.Item label="审核版本">{view.review_revision}</Descriptions.Item>
              {view.review?.reason && <Descriptions.Item label="已保存审核说明">{view.review.reason}</Descriptions.Item>}
              {view.review?.reference_system && <Descriptions.Item label="已审核坐标参考系统">{view.review.reference_system}</Descriptions.Item>}
            </Descriptions>
            {view.analysis_active && <Alert type="warning" title="路线正在分析，完成后请刷新候选再审核" />}
            {view.validation_error && <Alert type="warning" title={view.validation_error} />}
            {view.geometry_valid && MapComponent && (
              <MapComponent key={view.candidate_id} route={candidateRoute} mode="segments" />
            )}
            <Checkbox checked={confirmed} disabled={!available} onChange={(event) => setConfirmed(event.target.checked)}>
              我已查看整条候选轨迹，确认它表达从起点到终点的完整徒步范围，不把车辆接驳或未知缺口当作徒步轨迹。
            </Checkbox>
            <Select aria-label="坐标参考系统" placeholder="明确选择候选坐标参考系统，不自动推断" style={{ width: '100%' }}
              value={referenceSystem} disabled={!available} onChange={setReferenceSystem}
              options={[{ value: 'WGS84', label: 'WGS84（GPS / KML 常用）' }, { value: 'GCJ02', label: 'GCJ02（需确认原数据）' }]} />
            <Input.TextArea aria-label="审核说明" placeholder="审核说明；驳回必须说明原因" maxLength={1000} rows={3}
              value={reason} disabled={!available} onChange={(event) => setReason(event.target.value)} />
            <Space>
              <Button type="primary" disabled={!available || !confirmed || !referenceSystem} loading={saving}
                onClick={() => submit('approved')}>确认通过</Button>
              <Button danger disabled={!available || !reason.trim()} loading={saving}
                onClick={() => submit('rejected')}>驳回候选</Button>
            </Space>
          </Space>
        )}
      </Spin>
    </Space>
  );
}
