import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { routeApi, mockDataGenerator, formatTimestamp, getDifficultyText, getDifficultyTagColor } from '../services/api';

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
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    loadRoutes();
  }, [currentPage, pageSize]);

  const loadRoutes = async () => {
    setLoading(true);
    try {
      const response = await routeApi.getRoutes(currentPage - 1, pageSize, searchText, selectedDifficulty);
      
      if (response && response.content && response.content.length > 0) {
        setData(response.content);
        setTotal(response.totalElements || 0);
        setUseMockData(false);
      } else {
        const mockData = mockDataGenerator.generateMockRoutes(pageSize);
        setData(mockData.content);
        setTotal(mockData.totalElements);
        setUseMockData(true);
      }
    } catch (error) {
      console.error('加载路线列表失败:', error);
      const mockData = mockDataGenerator.generateMockRoutes(pageSize);
      setData(mockData.content);
      setTotal(mockData.totalElements);
      setUseMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const showRouteDetail = (route) => {
    setSelectedRoute(route);
    setDetailModalVisible(true);
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
        {useMockData && <Tag color="orange">演示模式</Tag>}
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
            onSearch={(value) => {
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

      <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
        <p style={{ margin: 0, color: '#52c41a' }}>
          <strong>说明：</strong>路线本身没有"状态"字段（如发布/审核状态），路线只是用户创建的内容。后台管理中路线展示的是路线的基本信息（名称、区域、难度、人气等）。
        </p>
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
        width={600}
      >
        {selectedRoute && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="路线ID">{selectedRoute.id}</Descriptions.Item>
            <Descriptions.Item label="路线名称">{selectedRoute.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="区域">{selectedRoute.region || '-'}</Descriptions.Item>
            <Descriptions.Item label="难度">{getDifficultyText(selectedRoute.difficulty) || '-'}</Descriptions.Item>
            <Descriptions.Item label="人气值">{selectedRoute.popularity || 0}</Descriptions.Item>
            <Descriptions.Item label="创建者">{selectedRoute.createdBy || '-'}</Descriptions.Item>
            <Descriptions.Item label="描述">{selectedRoute.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTimestamp(selectedRoute.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Routes;
