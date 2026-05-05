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
  Spin,
  Progress,
  Descriptions,
  Tag,
  Divider,
  Table,
  Tabs,
  Space,
  Row,
  Col,
  Statistic,
  Alert,
  Typography,
} from 'antd';

const { Text } = Typography;
import {
  CloudServerOutlined,
  PlayCircleOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ApiOutlined,
  FileTextOutlined,
  SafetyCertificateOutlined,
  ShoppingOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { agentServiceApi } from '../services/api';

const { TextArea } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const AgentService = () => {
  const [form] = Form.useForm();
  const [healthStatus, setHealthStatus] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState(null);
  const [taskStatus, setTaskStatus] = useState(null);
  const [taskResult, setTaskResult] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [activeTab, setActiveTab] = useState('submit');
  const pollingRef = useRef(null);

  useEffect(() => {
    checkHealth();
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

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

  const startPolling = (taskId) => {
    setIsPolling(true);
    pollingRef.current = setInterval(async () => {
      try {
        const response = await agentServiceApi.getTaskStatus(taskId);
        setTaskStatus(response);
        
        if (response.status === 'completed' || response.status === 'failed') {
          clearInterval(pollingRef.current);
          setIsPolling(false);
          if (response.status === 'completed' && response.result) {
            setTaskResult(response.result);
            message.success('分析任务完成！');
          } else if (response.status === 'failed') {
            message.error(`分析任务失败: ${response.error || '未知错误'}`);
          }
        }
      } catch (error) {
        console.error('轮询任务状态失败:', error);
        clearInterval(pollingRef.current);
        setIsPolling(false);
        message.error('查询任务状态失败');
      }
    }, 2000);
  };

  const handleSubmit = async (values) => {
    if (!healthStatus) {
      message.warning('Agent 服务未连接，请先检查服务状态');
      return;
    }

    setSubmitLoading(true);
    try {
      const requestData = {
        kml_source: values.kml_source,
        enable_content_generation: values.enable_content_generation,
        enable_poi_query: values.enable_poi_query,
        poi_search_radius: values.poi_search_radius,
      };

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
      setCurrentTaskId(response.task_id);
      setTaskStatus(response);
      setTaskResult(null);
      message.success(`任务已提交，任务ID: ${response.task_id}`);
      
      startPolling(response.task_id);
    } catch (error) {
      console.error('提交任务失败:', error);
      message.error('提交分析任务失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'default';
      case 'processing':
        return 'processing';
      case 'completed':
        return 'success';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'processing':
        return '处理中';
      case 'completed':
        return '已完成';
      case 'failed':
        return '失败';
      default:
        return '未知';
    }
  };

  const renderResultSummary = () => {
    if (!taskResult) return null;

    return (
      <Card title="分析结果概览" style={{ marginBottom: 24 }}>
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="总距离"
              value={taskResult.total_distance_km}
              suffix="公里"
              prefix={<ApiOutlined style={{ color: '#4facfe' }} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="总爬升"
              value={taskResult.total_elevation_gain_m}
              suffix="米"
              prefix={<ApiOutlined style={{ color: '#43e97b' }} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="总下降"
              value={taskResult.total_elevation_loss_m}
              suffix="米"
              prefix={<ApiOutlined style={{ color: '#fa709a' }} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="最高海拔"
              value={taskResult.max_elevation}
              suffix="米"
              prefix={<ApiOutlined style={{ color: '#f093fb' }} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="最低海拔"
              value={taskResult.min_elevation}
              suffix="米"
              prefix={<ApiOutlined style={{ color: '#feca57' }} />}
            />
          </Col>
          <Col xs={12} sm={8} lg={4}>
            <Statistic
              title="预估难度"
              value={taskResult.estimated_difficulty}
              suffix="/ 5"
              prefix={<ApiOutlined style={{ color: '#ff6b6b' }} />}
            />
          </Col>
        </Row>

        {taskResult.is_loop && (
          <div style={{ marginTop: 16 }}>
            <Tag color="blue">环线</Tag>
          </div>
        )}

        {taskResult.quality_score !== undefined && (
          <div style={{ marginTop: 16 }}>
            <Text>质量评分: {taskResult.quality_score.toFixed(1)} / 100</Text>
          </div>
        )}
      </Card>
    );
  };

  const renderSegments = () => {
    if (!taskResult || !taskResult.segments || taskResult.segments.length === 0) {
      return (
        <Alert message="暂无路段数据" type="info" showIcon />
      );
    }

    const columns = [
      {
        title: '路段名称',
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: '距离',
        dataIndex: 'distance_km',
        key: 'distance_km',
        render: (val) => `${val} 公里`,
      },
      {
        title: '爬升',
        dataIndex: 'elevation_gain_m',
        key: 'elevation_gain_m',
        render: (val) => `${val} 米`,
      },
      {
        title: '下降',
        dataIndex: 'elevation_loss_m',
        key: 'elevation_loss_m',
        render: (val) => `${val} 米`,
      },
      {
        title: '预计时间',
        dataIndex: 'estimated_time_minutes',
        key: 'estimated_time_minutes',
        render: (val) => `${val} 分钟`,
      },
      {
        title: '难度',
        dataIndex: 'difficulty',
        key: 'difficulty',
        render: (val) => (
          <Tag color={val <= 2 ? 'green' : val <= 3 ? 'orange' : 'red'}>
            {val} 级
          </Tag>
        ),
      },
    ];

    return (
      <Table
        columns={columns}
        dataSource={taskResult.segments}
        rowKey={(record, index) => `segment-${index}`}
        pagination={false}
      />
    );
  };

  const renderPOIs = () => {
    if (!taskResult) {
      return <Alert message="暂无POI数据" type="info" showIcon />;
    }

    const { water_sources, campsites, supplies, marker_points } = taskResult;

    return (
      <Tabs defaultActiveKey="water">
        <TabPane tab={`水源 (${water_sources?.length || 0})`} key="water">
          {water_sources && water_sources.length > 0 ? (
            <Table
              dataSource={water_sources}
              rowKey={(record, index) => `water-${index}`}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name' },
                { title: '类型', dataIndex: 'source_type', key: 'source_type' },
                { title: '可靠性', dataIndex: 'reliability', key: 'reliability', render: (val) => `${(val * 100).toFixed(0)}%` },
                { title: '纬度', dataIndex: 'latitude', key: 'latitude' },
                { title: '经度', dataIndex: 'longitude', key: 'longitude' },
              ]}
              pagination={false}
            />
          ) : (
            <Alert message="暂无水源数据" type="info" showIcon />
          )}
        </TabPane>
        
        <TabPane tab={`营地 (${campsites?.length || 0})`} key="campsite">
          {campsites && campsites.length > 0 ? (
            <Table
              dataSource={campsites}
              rowKey={(record, index) => `campsite-${index}`}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name' },
                { title: '容量', dataIndex: 'capacity', key: 'capacity' },
                { title: '有水源', dataIndex: 'has_water', key: 'has_water', render: (val) => val ? '是' : '否' },
                { title: '有设施', dataIndex: 'has_facilities', key: 'has_facilities', render: (val) => val ? '是' : '否' },
                { title: '纬度', dataIndex: 'latitude', key: 'latitude' },
                { title: '经度', dataIndex: 'longitude', key: 'longitude' },
              ]}
              pagination={false}
            />
          ) : (
            <Alert message="暂无营地数据" type="info" showIcon />
          )}
        </TabPane>
        
        <TabPane tab={`补给点 (${supplies?.length || 0})`} key="supply">
          {supplies && supplies.length > 0 ? (
            <Table
              dataSource={supplies}
              rowKey={(record, index) => `supply-${index}`}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name' },
                { title: '类型', dataIndex: 'supply_type', key: 'supply_type' },
                { title: '纬度', dataIndex: 'latitude', key: 'latitude' },
                { title: '经度', dataIndex: 'longitude', key: 'longitude' },
              ]}
              pagination={false}
            />
          ) : (
            <Alert message="暂无补给点数据" type="info" showIcon />
          )}
        </TabPane>
        
        <TabPane tab={`标记点 (${marker_points?.length || 0})`} key="marker">
          {marker_points && marker_points.length > 0 ? (
            <Table
              dataSource={marker_points}
              rowKey={(record, index) => `marker-${index}`}
              columns={[
                { title: '名称', dataIndex: 'name', key: 'name' },
                { title: '类型', dataIndex: 'type', key: 'type' },
                { title: '海拔', dataIndex: 'elevation', key: 'elevation', render: (val) => val ? `${val} 米` : '-' },
                { title: '纬度', dataIndex: 'latitude', key: 'latitude' },
                { title: '经度', dataIndex: 'longitude', key: 'longitude' },
              ]}
              pagination={false}
            />
          ) : (
            <Alert message="暂无标记点数据" type="info" showIcon />
          )}
        </TabPane>
      </Tabs>
    );
  };

  const renderGeneratedContent = () => {
    if (!taskResult) {
      return <Alert message="暂无生成内容" type="info" showIcon />;
    }

    const {
      generated_description,
      generated_highlights,
      generated_difficulties,
      generated_safety_notes,
      equipment_recommendations,
    } = taskResult;

    return (
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {generated_description && (
          <Card title="路线描述">
            <p>{generated_description}</p>
          </Card>
        )}
        
        {generated_highlights && generated_highlights.length > 0 && (
          <Card title="路线亮点">
            <ul>
              {generated_highlights.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Card>
        )}
        
        {generated_difficulties && generated_difficulties.length > 0 && (
          <Card title="难点提示">
            <ul>
              {generated_difficulties.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Card>
        )}
        
        {generated_safety_notes && generated_safety_notes.length > 0 && (
          <Card title="安全提示">
            <ul>
              {generated_safety_notes.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Card>
        )}
        
        {equipment_recommendations && equipment_recommendations.length > 0 && (
          <Card title="装备推荐">
            <ul>
              {equipment_recommendations.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </Card>
        )}
        
        {!generated_description && 
         (!generated_highlights || generated_highlights.length === 0) && 
         (!generated_difficulties || generated_difficulties.length === 0) && 
         (!generated_safety_notes || generated_safety_notes.length === 0) && 
         (!equipment_recommendations || equipment_recommendations.length === 0) && (
          <Alert message="暂无生成的内容" type="info" showIcon />
        )}
      </Space>
    );
  };

  const renderWarnings = () => {
    if (!taskResult || !taskResult.warnings || taskResult.warnings.length === 0) {
      return <Alert message="暂无警告信息" type="info" showIcon />;
    }

    return (
      <Table
        dataSource={taskResult.warnings}
        rowKey={(record, index) => `warning-${index}`}
        columns={[
          {
            title: '级别',
            dataIndex: 'level',
            key: 'level',
            render: (val) => (
              <Tag color={val === 'error' ? 'red' : val === 'warning' ? 'orange' : 'blue'}>
                {val}
              </Tag>
            ),
          },
          { title: '消息', dataIndex: 'message', key: 'message' },
          { title: '详细信息', dataIndex: 'detail', key: 'detail' },
        ]}
        pagination={false}
      />
    );
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

      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <CloudServerOutlined style={{ fontSize: 32, color: healthStatus ? '#52c41a' : '#ff4d4f' }} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 600 }}>
              Agent 服务状态:
              {healthStatus ? (
                <Tag color="success" icon={<CheckCircleOutlined />}>
                  在线
                </Tag>
              ) : (
                <Tag color="error" icon={<CloseCircleOutlined />}>
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

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        <TabPane tab="提交分析任务" key="submit" icon={<PlayCircleOutlined />}>
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
              <Form.Item
                name="kml_source"
                label="KML 文件 URL"
                rules={[{ required: true, message: '请输入 KML 文件 URL' }]}
                extra="例如: http://walkbg:8080/static/kml/wutaishan.kml"
              >
                <Input placeholder="请输入 KML 文件的 URL 地址" />
              </Form.Item>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="region_name"
                    label="区域名称（可选）"
                    extra="提供区域名称可以提高分析质量"
                  >
                    <Input placeholder="例如: 五台山" />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="estimated_difficulty"
                    label="预估难度（可选）"
                  >
                    <Select placeholder="请选择预估难度" allowClear>
                      <Option value={1}>1 - 简单</Option>
                      <Option value={2}>2 - 较易</Option>
                      <Option value={3}>3 - 中等</Option>
                      <Option value={4}>4 - 较难</Option>
                      <Option value={5}>5 - 困难</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="enable_content_generation"
                    label="启用内容生成"
                    valuePropName="checked"
                    extra="使用 LLM 生成路线描述、亮点等内容"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item
                    name="enable_poi_query"
                    label="启用 POI 查询"
                    valuePropName="checked"
                    extra="查询路线附近的水源、营地等 POI"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="poi_search_radius"
                label="POI 搜索半径（米）"
                extra="POI 查询的搜索范围"
              >
                <InputNumber min={100} max={2000} step={100} style={{ width: 200 }} />
              </Form.Item>

              <Form.Item
                name="user_notes"
                label="用户备注（可选）"
              >
                <TextArea rows={3} placeholder="输入关于此路线的额外说明..." />
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
        </TabPane>

        {taskStatus && (
          <TabPane tab="任务状态" key="status" icon={<ApiOutlined />}>
            <Card title="任务状态">
              <Descriptions bordered column={1}>
                <Descriptions.Item label="任务 ID">
                  {currentTaskId}
                </Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag color={getStatusColor(taskStatus.status)}>
                    {getStatusText(taskStatus.status)}
                  </Tag>
                  {isPolling && <Spin size="small" style={{ marginLeft: 8 }} />}
                </Descriptions.Item>
                <Descriptions.Item label="进度">
                  <Progress percent={taskStatus.progress || 0} status={taskStatus.status === 'failed' ? 'exception' : 'active'} />
                </Descriptions.Item>
                <Descriptions.Item label="当前步骤">
                  {taskStatus.current_step || '-'}
                </Descriptions.Item>
                <Descriptions.Item label="消息">
                  {taskStatus.message}
                </Descriptions.Item>
                {taskStatus.error && (
                  <Descriptions.Item label="错误信息">
                    <Tag color="error">{taskStatus.error}</Tag>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          </TabPane>
        )}

        {taskResult && (
          <TabPane tab="分析结果" key="result" icon={<FileTextOutlined />}>
            {renderResultSummary()}
            
            <Tabs defaultActiveKey="segments">
              <TabPane tab="路段详情" key="segments" icon={<ApiOutlined />}>
                <Card>{renderSegments()}</Card>
              </TabPane>
              
              <TabPane tab="POI 数据" key="pois" icon={<SafetyCertificateOutlined />}>
                <Card>{renderPOIs()}</Card>
              </TabPane>
              
              <TabPane tab="生成内容" key="generated" icon={<FileTextOutlined />}>
                <Card>{renderGeneratedContent()}</Card>
              </TabPane>
              
              <TabPane tab="装备推荐" key="equipment" icon={<ShoppingOutlined />}>
                <Card>
                  {taskResult.equipment_recommendations && taskResult.equipment_recommendations.length > 0 ? (
                    <div>
                      <h4 style={{ marginBottom: 16 }}>推荐装备列表</h4>
                      <ul>
                        {taskResult.equipment_recommendations.map((item, index) => (
                          <li key={index} style={{ marginBottom: 8 }}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <Alert message="暂无装备推荐" type="info" showIcon />
                  )}
                </Card>
              </TabPane>
              
              <TabPane tab="警告信息" key="warnings" icon={<WarningOutlined />}>
                <Card>{renderWarnings()}</Card>
              </TabPane>
            </Tabs>
          </TabPane>
        )}
      </Tabs>
    </div>
  );
};

export default AgentService;