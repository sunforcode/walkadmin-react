import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { tripApi, formatTimestamp, getTripStatusText, getTripStatusColor } from '../services/api';

const { Search } = Input;
const { Option } = Select;

const Trips = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadTrips();
  }, [currentPage, pageSize]);

  const loadTrips = async () => {
    setLoading(true);
    try {
      const response = await tripApi.getTrips(currentPage - 1, pageSize, searchText, selectedStatus);
      
      if (response && response.content) {
        setData(response.content);
        setTotal(response.totalElements || 0);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('加载行程列表失败:', error);
      message.error('加载行程列表失败');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const showTripDetail = (trip) => {
    setSelectedTrip(trip);
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
      title: '行程名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getTripStatusColor(status)}>
          {getTripStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '组织者ID',
      dataIndex: 'organizerId',
      key: 'organizerId',
      render: (id) => id || '-',
    },
    {
      title: '开始日期',
      dataIndex: 'startDate',
      key: 'startDate',
      render: (timestamp) => formatTimestamp(timestamp),
    },
    {
      title: '结束日期',
      dataIndex: 'endDate',
      key: 'endDate',
      render: (timestamp) => formatTimestamp(timestamp),
    },
    {
      title: '预算',
      dataIndex: 'budget',
      key: 'budget',
      render: (budget) => budget ? `¥${budget}` : '-',
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
            onClick={() => showTripDetail(record)}
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
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>行程管理</h2>
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Search
            placeholder="搜索行程名称..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => {
              setCurrentPage(1);
              loadTrips();
            }}
          />
          <Select
            placeholder="选择状态"
            allowClear
            style={{ width: 150 }}
            value={selectedStatus}
            onChange={(value) => {
              setSelectedStatus(value);
              setCurrentPage(1);
              loadTrips();
            }}
          >
            <Option value="0">规划中</Option>
            <Option value="1">进行中</Option>
            <Option value="2">已完成</Option>
            <Option value="3">已取消</Option>
          </Select>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadTrips}>
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
        title="行程详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTrip && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="行程ID">{selectedTrip.id}</Descriptions.Item>
            <Descriptions.Item label="行程名称">{selectedTrip.name || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{getTripStatusText(selectedTrip.status) || '-'}</Descriptions.Item>
            <Descriptions.Item label="组织者ID">{selectedTrip.organizerId || '-'}</Descriptions.Item>
            <Descriptions.Item label="开始日期">{formatTimestamp(selectedTrip.startDate)}</Descriptions.Item>
            <Descriptions.Item label="结束日期">{formatTimestamp(selectedTrip.endDate)}</Descriptions.Item>
            <Descriptions.Item label="预算">{selectedTrip.budget ? `¥${selectedTrip.budget}` : '-'}</Descriptions.Item>
            <Descriptions.Item label="描述">{selectedTrip.description || '-'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTimestamp(selectedTrip.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Trips;
