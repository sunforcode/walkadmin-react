import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  message,
  Progress,
  Tag,
  Divider,
  Space,
  Alert,
  Typography,
  Upload,
  Radio,
} from 'antd';

const { Text } = Typography;
import {
  CloudServerOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  LinkOutlined,
  UploadOutlined,
  EyeOutlined,
  WifiOutlined,
  DeleteOutlined,
  DownOutlined,
  UpOutlined,
} from '@ant-design/icons';
import { agentServiceApi, routeApi, API_BASE_URL } from '../services/api';
import {
  appendExecutionEvent,
  closeEventSourceAfterError,
  formatExecutionEventTime,
  getCompletionPresentation,
  getExecutionEventIdentity,
  normalizeTaskEvent,
} from './agentServiceHelpers';
import { useNavigate } from 'react-router-dom';

const { Option } = Select;

// 后端 base URL 统一复用 api.js 的定义，避免两处配置漂移。
// EventSource 无法使用 axios 实例，因此这里直接拼接 URL。

const AgentService = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [currentRouteId, setCurrentRouteId] = useState(null);
  const [kmlInputMode, setKmlInputMode] = useState('url'); // 'url' | 'file'
  const [uploadedKmlContent, setUploadedKmlContent] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState(null);

  // SSE 进度状态
  const [taskProgress, setTaskProgress] = useState(null);
  // taskProgress 结构: { status, progress, currentStep, routeId, error, executionEvent, degraded }

  // 当前页面会话的实时 Console，不持久化
  const [executionEvents, setExecutionEvents] = useState([]);
  const [consoleCollapsed, setConsoleCollapsed] = useState(false);
  const [consoleUnread, setConsoleUnread] = useState(false);
  const consoleCollapsedRef = useRef(false);
  const consoleEndRef = useRef(null);

  // SSE 连接状态
  const [sseConnected, setSseConnected] = useState(false);
  const [sseDisconnected, setSseDisconnected] = useState(false);

  // 模拟进度动画（processing 中从 10 缓慢增长到 90）
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const progressAnimRef = useRef(null);

  // SSE EventSource 引用（cleanup 使用）
  const eventSourceRef = useRef(null);

  // 路线搜索相关
  const [routeOptions, setRouteOptions] = useState([]);
  const [routeSearchLoading, setRouteSearchLoading] = useState(false);

  useEffect(() => {
    checkHealth();
    loadDefaultRoutes();
    return () => {
      // 组件 unmount 时关闭 SSE 连接，防止内存泄漏（4.6）
      closeEventSource();
      if (progressAnimRef.current) {
        clearInterval(progressAnimRef.current);
      }
    };
  }, []);

  // 监听 taskProgress 变化，同步 animatedProgress
  useEffect(() => {
    if (!taskProgress) return;

    if (taskProgress.status === 'completed') {
      // 分析完成，跳到 100%
      if (progressAnimRef.current) clearInterval(progressAnimRef.current);
      setAnimatedProgress(100);
      setCurrentRouteId(taskProgress.routeId);
    } else if (taskProgress.status === 'failed') {
      // 失败，停止动画
      if (progressAnimRef.current) clearInterval(progressAnimRef.current);
    } else if (taskProgress.status === 'processing') {
      // 收到初始 processing 事件（progress=10），启动缓慢动画到 90%
      setAnimatedProgress(taskProgress.progress || 10);
      startProgressAnimation(taskProgress.progress || 10);
    }
  }, [taskProgress]);

  useEffect(() => {
    if (executionEvents.length > 0 && !consoleCollapsed) {
      consoleEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [executionEvents, consoleCollapsed]);

  /**
   * 启动缓慢进度条动画
   * processing 阶段：从 startVal 缓慢爬到 90（每 2 秒 +1），等待 completed 跳 100
   */
  const startProgressAnimation = (startVal) => {
    if (progressAnimRef.current) clearInterval(progressAnimRef.current);
    let current = startVal;
    progressAnimRef.current = setInterval(() => {
      if (current < 90) {
        current += 1;
        setAnimatedProgress(current);
      } else {
        clearInterval(progressAnimRef.current);
      }
    }, 2000);
  };

  const closeEventSource = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
      setSseConnected(false);
    }
  };

  const loadDefaultRoutes = async () => {
    setRouteSearchLoading(true);
    try {
      const result = await routeApi.getRoutes(0, 20);
      const content = result?.content || result || [];
      setRouteOptions(
        content.map((r) => ({
          value: r.id,
          label: `${r.name}${r.region ? ` · ${r.region}` : ''}`,
        }))
      );
    } catch (error) {
      console.error('加载路线列表失败:', error);
    } finally {
      setRouteSearchLoading(false);
    }
  };

  const checkHealth = async () => {
    setHealthLoading(true);
    try {
      const response = await agentServiceApi.healthCheck();
      setHealthStatus(response);
      message.success('Agent 服务连接正常');
    } catch (error) {
      console.error('健康检查失败:', error);
      setHealthStatus(null);
      message.error('无法连接到 Agent 服务，请检查服务是否启动');
    } finally {
      setHealthLoading(false);
    }
  };

  const handleRouteSearch = async (keyword) => {
    if (!keyword || keyword.length < 1) {
      loadDefaultRoutes();
      return;
    }
    setRouteSearchLoading(true);
    try {
      const result = await routeApi.getRoutes(0, 20, keyword);
      const content = result?.content || result || [];
      setRouteOptions(
        content.map((r) => ({
          value: r.id,
          label: `${r.name}${r.region ? ` · ${r.region}` : ''}`,
        }))
      );
    } catch (error) {
      console.error('搜索路线失败:', error);
      setRouteOptions([]);
    } finally {
      setRouteSearchLoading(false);
    }
  };

  const handleSseTaskEvent = (rawData) => {
    const nextTaskProgress = normalizeTaskEvent(rawData);
    setTaskProgress(nextTaskProgress);
    setExecutionEvents((events) => appendExecutionEvent(events, nextTaskProgress));
    if (nextTaskProgress.executionEvent && consoleCollapsedRef.current) {
      setConsoleUnread(true);
    }

    if (nextTaskProgress.status === 'completed') {
      const completion = getCompletionPresentation(nextTaskProgress);
      if (nextTaskProgress.degraded) {
        message.warning(completion.message);
      } else {
        message.success('分析任务完成！路线数据已更新');
      }
      closeEventSource();
    } else if (nextTaskProgress.status === 'failed') {
      message.error(`分析任务失败: ${nextTaskProgress.error || '未知错误'}`);
      closeEventSource();
    }
  };

  const parseSseEvent = (event, eventName) => {
    try {
      const data = JSON.parse(event.data);
      console.log(`[SSE] 收到 ${eventName} 事件:`, data);
      handleSseTaskEvent(data);
    } catch (error) {
      console.error(`[SSE] 解析 ${eventName} 事件失败:`, error);
    }
  };

  /**
   * 建立 SSE 连接，订阅分析进度（4.1）
   */
  const connectSse = (taskId) => {
    // 关闭旧连接（如有）
    closeEventSource();

    setSseDisconnected(false);
    setAnimatedProgress(0);
    setExecutionEvents([]);
    consoleCollapsedRef.current = false;
    setConsoleCollapsed(false);
    setConsoleUnread(false);
    setTaskProgress({ status: 'pending', progress: 0, currentStep: '等待分析任务启动...', degraded: false });

    const sseUrl = `${API_BASE_URL}/api/v1/route-analysis/tasks/${taskId}/stream`;
    console.log('[SSE] 建立连接:', sseUrl);

    const es = new EventSource(sseUrl);
    eventSourceRef.current = es;

    // 连接建立
    es.onopen = () => {
      setSseConnected(true);
      console.log('[SSE] 连接已建立');
    };

    // execution_event 和 degraded 作为 progress data 的可选字段处理
    es.addEventListener('progress', (event) => parseSseEvent(event, 'progress'));

    // 兼容默认 message 事件（无 event name 时）
    es.onmessage = (event) => parseSseEvent(event, 'message');

    // SSE 连接断开（4.5）
    es.onerror = (e) => {
      console.warn('[SSE] 连接出错或断开:', e);
      closeEventSourceAfterError(es, () => {
        if (eventSourceRef.current === es) {
          eventSourceRef.current = null;
        }
        setSseConnected(false);
        setSseDisconnected(true);
        console.log('[SSE] 连接已关闭，等待手动刷新状态');
      });
    };
  };

  /**
   * 手动刷新任务状态（降级轮询，4.5）
   */
  const handleManualRefresh = async () => {
    if (!currentTaskId) return;
    try {
      const response = await agentServiceApi.getTaskStatus(currentTaskId);
      if (response) {
        const nextTaskProgress = normalizeTaskEvent(response);
        setTaskProgress(nextTaskProgress);
        if (response.status === 'completed') {
          const completion = getCompletionPresentation(nextTaskProgress);
          if (nextTaskProgress.degraded) {
            message.warning(completion.message);
          } else {
            message.success('任务已完成');
          }
          setSseDisconnected(false);
        }
      }
    } catch {
      message.error('查询状态失败');
    }
  };

  const handleFileUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setUploadedKmlContent(e.target.result);
      setUploadedFileName(file.name);
      message.success(`已加载文件: ${file.name}`);
    };
    reader.onerror = () => {
      message.error('文件读取失败');
    };
    reader.readAsText(file, 'UTF-8');
    return false;
  };

  const handleSubmit = async (values) => {
    if (!healthStatus) {
      message.warning('Agent 服务未连接，请先检查服务状态');
      return;
    }

    if (kmlInputMode === 'url' && !values.kml_source) {
      message.error('请输入 KML 文件 URL');
      return;
    }
    if (kmlInputMode === 'file' && !uploadedKmlContent) {
      message.error('请选择 KML 文件');
      return;
    }

    setSubmitLoading(true);
    try {
      const requestData = {
        kml_source: kmlInputMode === 'url' ? values.kml_source : (uploadedFileName || 'uploaded.kml'),
        enable_content_generation: values.enable_content_generation,
        enable_poi_query: values.enable_poi_query,
        poi_search_radius: values.poi_search_radius,
      };

      if (kmlInputMode === 'file' && uploadedKmlContent) {
        requestData.kml_content = uploadedKmlContent;
      }

      // 关联路线：有选择则传 route_id，否则后端自动创建
      if (values.route_id) {
        requestData.route_id = values.route_id;
      }

      if (values.region_name) {
        requestData.region_name = values.region_name;
      }
      if (values.estimated_difficulty) {
        requestData.estimated_difficulty = values.estimated_difficulty;
      }
      if (values.user_notes) {
        requestData.user_notes = values.user_notes;
      }

      const response = await agentServiceApi.submitAnalysis(requestData);
      const taskId = response.task_id;

      setCurrentTaskId(taskId);
      setCurrentRouteId(null); // 等待 SSE completed 事件携带 routeId

      const routeHint = values.route_id ? `已绑定路线 ${values.route_id}` : '将自动创建新路线';
      message.success(`任务已提交（${routeHint}），任务ID: ${taskId}`);

      // 4.1: 提交成功后立即建立 SSE 连接
      connectSse(taskId);
    } catch (error) {
      console.error('提交任务失败:', error);
      message.error('提交分析任务失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getProgressStatus = () => {
    if (!taskProgress) return 'active';
    if (taskProgress.status === 'completed') return 'success';
    if (taskProgress.status === 'failed') return 'exception';
    return 'active';
  };

  const getStatusTag = () => {
    if (!taskProgress) return null;
    switch (taskProgress.status) {
      case 'pending':
        return <Tag color="default">等待中</Tag>;
      case 'processing':
        return <Tag color="processing">分析中</Tag>;
      case 'completed': {
        const completion = getCompletionPresentation(taskProgress);
        return (
          <Tag color={taskProgress.degraded ? 'warning' : 'success'} icon={<CheckCircleOutlined />}>
            {completion.label}
          </Tag>
        );
      }
      case 'failed':
        return <Tag color="error" icon={<CloseCircleOutlined />}>失败</Tag>;
      default:
        return <Tag color="default">{taskProgress.status}</Tag>;
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Agent 服务</h2>
        <Button
          type="primary"
          icon={<ReloadOutlined />}
          onClick={checkHealth}
          loading={healthLoading}
        >
          检查服务状态
        </Button>
      </div>

      {/* 服务状态卡片 */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CloudServerOutlined style={{ fontSize: 32, color: healthStatus ? '#52c41a' : '#ff4d4f' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              Agent 服务状态:
              {healthStatus ? (
                <Tag color="success" icon={<CheckCircleOutlined />} style={{ marginLeft: 8 }}>
                  在线
                </Tag>
              ) : (
                <Tag color="error" icon={<CloseCircleOutlined />} style={{ marginLeft: 8 }}>
                  离线
                </Tag>
              )}
            </div>
            {healthStatus && (
              <div style={{ fontSize: 14, color: '#666', marginTop: 4 }}>
                版本: {healthStatus.version} | 环境: {healthStatus.checks?.orchestrator || 'unknown'}
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* 任务进度卡片（提交任务后显示） */}
      {currentTaskId && (
        <Card
          title={
            <Space>
              <span>分析进度</span>
              {sseConnected && (
                <Tag color="green" icon={<WifiOutlined />}>SSE 实时连接</Tag>
              )}
              {sseDisconnected && (
                <Tag color="warning">连接已断开</Tag>
              )}
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <div style={{ marginBottom: 12 }}>
            <Space>
              <span style={{ color: '#666' }}>任务 ID:</span>
              <Text code>{currentTaskId}</Text>
              {getStatusTag()}
            </Space>
          </div>

          {/* 进度条（4.7） */}
          <Progress
            percent={animatedProgress}
            status={getProgressStatus()}
            strokeColor={taskProgress?.status === 'processing' ? { from: '#108ee9', to: '#87d068' } : undefined}
            style={{ marginBottom: 12 }}
          />

          {/* 当前步骤 */}
          {taskProgress?.currentStep && (
            <div style={{ color: '#666', fontSize: 13, marginBottom: 12 }}>
              {taskProgress.currentStep}
            </div>
          )}

          {/* SSE 连接断开降级提示（4.5） */}
          {sseDisconnected && taskProgress?.status !== 'completed' && taskProgress?.status !== 'failed' && (
            <Alert
              type="warning"
              showIcon
              message="SSE 连接已断开"
              description={
                <Space>
                  <span>实时进度推送已中断，可手动刷新查看最新状态。</span>
                  <Button size="small" onClick={handleManualRefresh}>手动刷新状态</Button>
                </Space>
              }
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 失败提示（4.4） */}
          {taskProgress?.status === 'failed' && (
            <Alert
              type="error"
              showIcon
              message="分析任务失败"
              description={taskProgress.error || '未知错误'}
              style={{ marginBottom: 12 }}
            />
          )}

          {/* 完成提示 + 查看路线按钮（4.3） */}
          {taskProgress?.status === 'completed' && (() => {
            const completion = getCompletionPresentation(taskProgress);
            return (
              <Alert
                type={completion.alertType}
                showIcon
                message={completion.message}
                description={
                  <Space>
                    <Text>
                      {taskProgress.degraded
                        ? '路线数据已写入，但请检查 Console 中的降级警告。'
                        : '路线数据已更新，可前往路线管理页查看分析结果。'}
                    </Text>
                    <Button
                      type="primary"
                      size="small"
                      icon={<EyeOutlined />}
                      onClick={() => navigate('/routes' + (currentRouteId ? `?highlight=${currentRouteId}` : ''))}
                    >
                      查看路线
                    </Button>
                  </Space>
                }
                style={{ marginBottom: 12 }}
              />
            );
          })()}

          <Divider style={{ margin: '16px 0' }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Space>
              <Text strong>实时 Console</Text>
              <Tag>{executionEvents.length} 条</Tag>
              {consoleUnread && <Tag color="blue">有新事件</Tag>}
            </Space>
            <Space>
              <Button
                size="small"
                icon={<DeleteOutlined />}
                disabled={executionEvents.length === 0}
                onClick={() => {
                  setExecutionEvents([]);
                  setConsoleUnread(false);
                }}
              >
                清空
              </Button>
              <Button
                size="small"
                icon={consoleCollapsed ? <DownOutlined /> : <UpOutlined />}
                onClick={() => {
                  const nextCollapsed = !consoleCollapsedRef.current;
                  consoleCollapsedRef.current = nextCollapsed;
                  setConsoleCollapsed(nextCollapsed);
                  setConsoleUnread(false);
                }}
              >
                {consoleCollapsed ? '展开' : '收起'}
              </Button>
            </Space>
          </div>

          {!consoleCollapsed && (
            <div
              role="log"
              aria-live="polite"
              style={{
                marginTop: 12,
                maxHeight: 280,
                overflowY: 'auto',
                padding: 12,
                borderRadius: 6,
                background: '#141414',
                color: '#d9d9d9',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12,
              }}
            >
              {executionEvents.length === 0 ? (
                <div style={{ color: '#8c8c8c' }}>等待 Agent 执行事件...</div>
              ) : (
                executionEvents.map((event, index) => (
                  <div
                    key={getExecutionEventIdentity(event)}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '72px minmax(100px, 150px) 86px 1fr',
                      gap: 8,
                      padding: '5px 0',
                      borderBottom: index === executionEvents.length - 1 ? 'none' : '1px solid #303030',
                      color: event.level === 'error'
                        ? '#ff7875'
                        : event.level === 'warning' || event.phase === 'degraded'
                          ? '#ffc53d'
                          : '#d9d9d9',
                    }}
                  >
                    <span>{formatExecutionEventTime(event.timestamp)}</span>
                    <span>{event.node || '-'}</span>
                    <span>{event.phase || event.level || '-'}</span>
                    <span>{event.message || '-'}</span>
                  </div>
                ))
              )}
              <div ref={consoleEndRef} />
            </div>
          )}
        </Card>
      )}

      {/* 提交任务表单 */}
      <Card title="KML 分析任务配置">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            enable_content_generation: true,
            enable_poi_query: true,
            poi_search_radius: 500,
          }}
        >
          {/* KML 输入模式切换 */}
          <Form.Item label="KML 来源">
            <Radio.Group
              value={kmlInputMode}
              onChange={(e) => {
                setKmlInputMode(e.target.value);
                setUploadedKmlContent(null);
                setUploadedFileName(null);
              }}
              style={{ marginBottom: 12 }}
            >
              <Radio.Button value="url"><LinkOutlined /> URL</Radio.Button>
              <Radio.Button value="file"><UploadOutlined /> 上传文件</Radio.Button>
            </Radio.Group>

            {kmlInputMode === 'url' ? (
              <Form.Item
                name="kml_source"
                noStyle
                rules={kmlInputMode === 'url' ? [{ required: true, message: '请输入 KML 文件 URL' }] : []}
              >
                <Input placeholder="例如: https://example.com/path/to/route.kml" />
              </Form.Item>
            ) : (
              <div>
                <Upload
                  accept=".kml,.xml"
                  beforeUpload={handleFileUpload}
                  showUploadList={false}
                  maxCount={1}
                >
                  <Button icon={<UploadOutlined />}>选择 KML 文件</Button>
                </Upload>
                {uploadedFileName && (
                  <div style={{ marginTop: 8, color: '#52c41a' }}>
                    <CheckCircleOutlined /> 已选择：{uploadedFileName}
                    <Button
                      type="link"
                      size="small"
                      danger
                      onClick={() => { setUploadedKmlContent(null); setUploadedFileName(null); }}
                      style={{ marginLeft: 8 }}
                    >
                      移除
                    </Button>
                  </div>
                )}
              </div>
            )}
          </Form.Item>

          {/* 关联路线选择 */}
          <Form.Item
            name="route_id"
            label="关联路线（可选）"
            extra="选择已有路线，分析结果将更新该路线数据；不选则自动创建新路线"
          >
            <Select
              showSearch
              placeholder="搜索路线名称，或不选以自动创建新路线"
              filterOption={false}
              onSearch={handleRouteSearch}
              loading={routeSearchLoading}
              allowClear
              notFoundContent={routeSearchLoading ? <span>搜索中...</span> : '未找到匹配路线'}
            >
              {routeOptions.map((opt) => (
                <Option key={opt.value} value={opt.value}>
                  {opt.label}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Divider />

          <Form.Item
            name="region_name"
            label="区域名称（可选）"
            extra="自动创建新路线时用作路线名称，提供区域名称可提高分析质量"
          >
            <Input placeholder="例如: 五台山" />
          </Form.Item>

          <Form.Item
            name="estimated_difficulty"
            label="预估难度（可选）"
          >
            <Select placeholder="请选择预估难度" allowClear style={{ width: 200 }}>
              <Option value={1}>1 - 简单</Option>
              <Option value={2}>2 - 较易</Option>
              <Option value={3}>3 - 中等</Option>
              <Option value={4}>4 - 较难</Option>
              <Option value={5}>5 - 困难</Option>
            </Select>
          </Form.Item>

          <Space size="large">
            <Form.Item
              name="enable_content_generation"
              label="启用内容生成"
              valuePropName="checked"
              extra="使用 LLM 生成路线描述、亮点等"
            >
              <Switch />
            </Form.Item>
            <Form.Item
              name="enable_poi_query"
              label="启用 POI 查询"
              valuePropName="checked"
              extra="查询路线附近水源、营地等"
            >
              <Switch />
            </Form.Item>
          </Space>

          <Form.Item
            name="poi_search_radius"
            label="POI 搜索半径（米）"
          >
            <InputNumber min={100} max={2000} step={100} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            name="user_notes"
            label="用户备注（可选）"
          >
            <Input.TextArea rows={3} placeholder="输入关于此路线的额外说明..." />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              size="large"
              htmlType="submit"
              icon={<PlayCircleOutlined />}
              loading={submitLoading}
              disabled={!healthStatus}
            >
              提交分析任务
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default AgentService;
