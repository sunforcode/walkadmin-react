import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, DeleteOutlined } from '@ant-design/icons';
import { userApi, mockDataGenerator, formatTimestamp } from '../services/api';

const { Search } = Input;
const { Option } = Select;

const Users = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [searchText, setSearchText] = useState('');
  const [selectedStatus, setSelectedStatus] = useState(undefined);
  const [selectedUser, setSelectedUser] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [useMockData, setUseMockData] = useState(false);

  useEffect(() => {
    loadUsers();
  }, [currentPage, pageSize]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const response = await userApi.getUsers(currentPage - 1, pageSize, searchText, selectedStatus);
      
      if (response && response.content && response.content.length > 0) {
        setData(response.content);
        setTotal(response.totalElements || 0);
        setUseMockData(false);
      } else {
        const mockData = mockDataGenerator.generateMockUsers(pageSize);
        setData(mockData.content);
        setTotal(mockData.totalElements);
        setUseMockData(true);
      }
    } catch (error) {
      console.error('加载用户列表失败:', error);
      const mockData = mockDataGenerator.generateMockUsers(pageSize);
      setData(mockData.content);
      setTotal(mockData.totalElements);
      setUseMockData(true);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (useMockData) {
      message.warning('演示模式下无法删除数据');
      return;
    }
    
    try {
      await userApi.deleteUser(id);
      message.success('删除成功');
      loadUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除失败');
    }
  };

  const showUserDetail = (user) => {
    setSelectedUser(user);
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '昵称',
      dataIndex: 'nickname',
      key: 'nickname',
      render: (text) => text || '-',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => text || '-',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (timestamp) => formatTimestamp(timestamp),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => showUserDetail(record)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="default"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>用户管理</h2>
        {useMockData && <Tag color="orange">演示模式</Tag>}
      </div>
      
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Search
            placeholder="搜索用户名、邮箱..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 250 }}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => {
              setCurrentPage(1);
              loadUsers();
            }}
          />
          <Select
            placeholder="用户状态"
            allowClear
            style={{ width: 150 }}
            value={selectedStatus}
            onChange={(value) => {
              setSelectedStatus(value);
              setCurrentPage(1);
              loadUsers();
            }}
          >
            <Option value="0">正常</Option>
            <Option value="1">禁用</Option>
          </Select>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadUsers}>
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
        title="用户详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedUser && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="用户ID">{selectedUser.id}</Descriptions.Item>
            <Descriptions.Item label="用户名">{selectedUser.username || '-'}</Descriptions.Item>
            <Descriptions.Item label="昵称">{selectedUser.nickname || '-'}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedUser.email || '-'}</Descriptions.Item>
            <Descriptions.Item label="手机号">{selectedUser.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="注册时间">{formatTimestamp(selectedUser.createdAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Users;
