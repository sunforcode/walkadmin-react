import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined } from '@ant-design/icons';
import { guideApi, formatTimestamp, getGuideStatusText, getGuideStatusColor, getDifficultyText } from '../services/api';

const { Search } = Input;
const { Option } = Select;

const Guides = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedGuide, setSelectedGuide] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadGuides();
  }, [currentPage, pageSize]);

  const loadGuides = async () => {
    setLoading(true);
    try {
      const response = await guideApi.getGuides(currentPage - 1, pageSize);
      
      if (response && response.content) {
        setData(response.content);
        setTotal(response.totalElements || 0);
      } else {
        setData([]);
        setTotal(0);
      }
    } catch (error) {
      console.error('加载攻略列表失败:', error);
      message.error('加载攻略列表失败');
      setData([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  const showGuideDetail = (guide) => {
    setSelectedGuide(guide);
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
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      render: (author) => author || '-',
    },
    {
      title: '浏览量',
      dataIndex: 'views',
      key: 'views',
      render: (views) => views || 0,
    },
    {
      title: '点赞数',
      dataIndex: 'likes',
      key: 'likes',
      render: (likes) => likes || 0,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={getGuideStatusColor(status)}>
          {getGuideStatusText(status)}
        </Tag>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'publishDate',
      key: 'publishDate',
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
            onClick={() => showGuideDetail(record)}
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
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>攻略管理</h2>
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Search
            placeholder="搜索攻略标题..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={() => {
              setCurrentPage(1);
              loadGuides();
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
              loadGuides();
            }}
          >
            <Option value="0">草稿</Option>
            <Option value="1">已发布</Option>
            <Option value="2">已下线</Option>
          </Select>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadGuides}>
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
        title="攻略详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedGuide && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="攻略ID">{selectedGuide.id}</Descriptions.Item>
            <Descriptions.Item label="标题">{selectedGuide.title || '-'}</Descriptions.Item>
            <Descriptions.Item label="作者">{selectedGuide.author || '-'}</Descriptions.Item>
            <Descriptions.Item label="作者ID">{selectedGuide.authorId || '-'}</Descriptions.Item>
            <Descriptions.Item label="状态">{getGuideStatusText(selectedGuide.status) || '-'}</Descriptions.Item>
            <Descriptions.Item label="浏览量">{selectedGuide.views || 0}</Descriptions.Item>
            <Descriptions.Item label="点赞数">{selectedGuide.likes || 0}</Descriptions.Item>
            <Descriptions.Item label="难度">{getDifficultyText(selectedGuide.difficulty) || '-'}</Descriptions.Item>
            <Descriptions.Item label="标签">
              {selectedGuide.tags && selectedGuide.tags.length > 0 
                ? selectedGuide.tags.join(', ') 
                : '-'}
            </Descriptions.Item>
            <Descriptions.Item label="发布时间">{formatTimestamp(selectedGuide.publishDate)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTimestamp(selectedGuide.updateDate)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Guides;
