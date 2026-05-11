import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin, Tabs, Collapse, Badge } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, EnvironmentOutlined, ThunderboltOutlined, TeamOutlined, ShopOutlined, PushpinOutlined } from '@ant-design/icons';
import { routeApi, formatTimestamp, getDifficultyText, getDifficultyTagColor } from '../services/api';

const { Search } = Input;
const { Option } = Select;

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

  useEffect(() => {
    loadRoutes();
  }, [currentPage, pageSize]);

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

  const showRouteDetail = async (route) => {
    setDetailModalVisible(true);
    setSelectedRoute(route);
    setDetailLoading(true);
    try {
      const detail = await routeApi.getRouteById(route.id);
      setSelectedRoute(detail);
    } catch (error) {
      console.error('加载路线详情失败:', error);
      message.error('加载详情失败');
    } finally {
      setDetailLoading(false);
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
      width: 120,
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
        </Space>
      ),
    },
  ];

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
        <Button icon={<ReloadOutlined />} onClick={loadRoutes}>
          刷新
        </Button>
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

      <Modal
        title="路线详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <Spin spinning={detailLoading}>
        {selectedRoute && (
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
                label: (
                  <span><ThunderboltOutlined /> 路段 <Badge count={selectedRoute.segments?.length || 0} style={{ backgroundColor: '#1677ff' }} /></span>
                ),
                children: selectedRoute.segments?.length > 0 ? (
                  <Collapse
                    size="small"
                    items={selectedRoute.segments.map((seg, i) => ({
                      key: i,
                      label: `${seg.name || `路段${i + 1}`}  ${seg.distance ? seg.distance + ' km' : ''} ${seg.elevation_gain ? '↑' + seg.elevation_gain + 'm' : ''}`,
                      children: (
                        <Descriptions size="small" column={2}>
                          <Descriptions.Item label="距离">{seg.distance ? `${seg.distance} km` : '-'}</Descriptions.Item>
                          <Descriptions.Item label="爬升">{seg.elevation_gain ? `${seg.elevation_gain} m` : '-'}</Descriptions.Item>
                          <Descriptions.Item label="下降">{seg.elevation_loss ? `${seg.elevation_loss} m` : '-'}</Descriptions.Item>
                          <Descriptions.Item label="预计用时">{seg.estimated_time ? `${seg.estimated_time} 分钟` : '-'}</Descriptions.Item>
                          <Descriptions.Item label="难度">{getDifficultyText(seg.difficulty)}</Descriptions.Item>
                          <Descriptions.Item label="类型">{seg.segment_type || '-'}</Descriptions.Item>
                          {seg.description && <Descriptions.Item label="描述" span={2}>{seg.description}</Descriptions.Item>}
                        </Descriptions>
                      )
                    }))}
                  />
                ) : <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>暂无路段数据</div>
              },
              {
                key: 'pois',
                label: (
                  <span><EnvironmentOutlined /> POI</span>
                ),
                children: (
                  <div>
                    {(selectedRoute.water_sources?.length > 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>💧 水源 ({selectedRoute.water_sources.length})</div>
                        {selectedRoute.water_sources.map((ws, i) => (
                          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Tag color="blue">{ws.name}</Tag>
                            {ws.source_type && <Tag>{ws.source_type}</Tag>}
                            {ws.description && <span style={{ color: '#666', fontSize: 12 }}>{ws.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedRoute.campsites?.length > 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>⛺ 营地 ({selectedRoute.campsites.length})</div>
                        {selectedRoute.campsites.map((camp, i) => (
                          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Tag color="green">{camp.name}</Tag>
                            {camp.description && <span style={{ color: '#666', fontSize: 12 }}>{camp.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedRoute.supplies?.length > 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>🏪 补给点 ({selectedRoute.supplies.length})</div>
                        {selectedRoute.supplies.map((sup, i) => (
                          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Tag color="orange">{sup.name}</Tag>
                            {sup.supply_type && <Tag>{sup.supply_type}</Tag>}
                            {sup.description && <span style={{ color: '#666', fontSize: 12 }}>{sup.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {(selectedRoute.marker_points?.length > 0) && (
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>📍 标记点 ({selectedRoute.marker_points.length})</div>
                        {selectedRoute.marker_points.map((mp, i) => (
                          <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                            <Tag color="purple">{mp.name}</Tag>
                            {mp.marker_type && <Tag>{mp.marker_type}</Tag>}
                            {mp.elevation && <Tag>{mp.elevation}m</Tag>}
                            {mp.description && <span style={{ color: '#666', fontSize: 12 }}>{mp.description}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                    {!selectedRoute.water_sources?.length && !selectedRoute.campsites?.length && !selectedRoute.supplies?.length && !selectedRoute.marker_points?.length && (
                      <div style={{ color: '#999', textAlign: 'center', padding: 16 }}>暂无 POI 数据</div>
                    )}
                  </div>
                )
              }
            ]}
          />
        )}
        </Spin>
      </Modal>
    </div>
  );
};

export default Routes;
