import { useState, useEffect } from 'react';
import { Table, Button, Space, Tag, Modal, Descriptions, Input, Select, message, Spin, Popconfirm, Tabs, Card, Statistic, Row, Col, Form, InputNumber } from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  DeleteOutlined,
  PlusOutlined,
  EditOutlined,
  AppstoreOutlined,
  UnorderedListOutlined,
  FileTextOutlined,
  ShoppingOutlined,
} from '@ant-design/icons';
import {
  equipmentItemApi,
  equipmentListApi,
  equipmentTemplateApi,
  getEquipmentCategoryText,
  getEquipmentTypeText,
  getEquipmentListStatusText,
  getEquipmentListStatusColor,
  mockDataGenerator,
  formatTimestamp,
} from '../services/api';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

const generateMockEquipmentItems = (count = 10) => {
  const names = [
    '登山背包', '帐篷', '睡袋', '防潮垫', '登山杖', '头灯', '水壶',
    '徒步鞋', '冲锋衣', '速干裤', '帽子', '手套', '墨镜', '防晒霜',
    '急救包', '刀具', '炉具', '气罐', '餐具', '洗漱用品'
  ];
  
  const items = [];
  for (let i = 0; i < count; i++) {
    items.push({
      id: `item_${i + 1}`,
      name: names[i % names.length],
      category: i % 11,
      categoryName: getEquipmentCategoryText(i % 11),
      weight: Math.floor(Math.random() * 5000) + 100,
      weightUnit: 0,
      weightUnitName: '克',
      quantity: Math.floor(Math.random() * 3) + 1,
      createdAt: Math.floor(Date.now() / 1000) - i * 86400,
      updatedAt: Math.floor(Date.now() / 1000) - i * 3600,
    });
  }
  
  return {
    content: items,
    totalElements: 56,
    totalPages: 6,
    number: 0,
    size: 10,
  };
};

const generateMockEquipmentLists = (count = 10) => {
  const names = [
    '周末一日徒步装备', '三天两夜露营装备', '冬季雪山攀登装备',
    '夏季溯溪装备', '秋季摄影徒步装备', '亲子徒步装备',
    '团队穿越装备', '高海拔徒步装备', '轻量化徒步装备', '重装徒步装备'
  ];
  
  const lists = [];
  for (let i = 0; i < count; i++) {
    lists.push({
      id: `list_${i + 1}`,
      name: names[i % names.length],
      type: i % 3,
      typeName: getEquipmentTypeText(i % 3),
      personCount: Math.floor(Math.random() * 4) + 1,
      status: i % 4,
      statusName: getEquipmentListStatusText(i % 4),
      totalWeight: Math.floor(Math.random() * 20000) + 1000,
      itemCount: Math.floor(Math.random() * 15) + 5,
      createdAt: Math.floor(Date.now() / 1000) - i * 86400,
      updatedAt: Math.floor(Date.now() / 1000) - i * 3600,
    });
  }
  
  return {
    content: lists,
    totalElements: 32,
    totalPages: 4,
    number: 0,
    size: 10,
  };
};

const generateMockTemplates = (count = 10) => {
  const names = [
    '标准一日徒步模板', '标准露营模板', '冬季登山模板',
    '轻量化徒步模板', '重装穿越模板', '团队活动模板',
    '摄影徒步模板', '亲子活动模板', '高海拔模板', '溯溪活动模板'
  ];
  
  const templates = [];
  for (let i = 0; i < count; i++) {
    templates.push({
      id: `template_${i + 1}`,
      name: names[i % names.length],
      category: i % 11,
      categoryName: getEquipmentCategoryText(i % 11),
      type: i % 3,
      typeName: getEquipmentTypeText(i % 3),
      isOfficial: i < 3,
      creatorId: `user_${(i % 5) + 1}`,
      creatorName: `用户${(i % 5) + 1}`,
      usageCount: Math.floor(Math.random() * 100) + 1,
      rating: (Math.random() * 2 + 3).toFixed(1),
      createdAt: Math.floor(Date.now() / 1000) - i * 86400 * 2,
      updatedAt: Math.floor(Date.now() / 1000) - i * 86400,
    });
  }
  
  return {
    content: templates,
    totalElements: 24,
    totalPages: 3,
    number: 0,
    size: 10,
  };
};

const Equipment = () => {
  const [activeTab, setActiveTab] = useState('items');
  
  const [itemLoading, setItemLoading] = useState(false);
  const [itemData, setItemData] = useState([]);
  const [itemTotal, setItemTotal] = useState(0);
  const [itemPage, setItemPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(10);
  const [itemSearchText, setItemSearchText] = useState('');
  const [itemCategory, setItemCategory] = useState(undefined);
  const [selectedItem, setSelectedItem] = useState(null);
  const [itemDetailModal, setItemDetailModal] = useState(false);
  const [itemEditModal, setItemEditModal] = useState(false);
  const [itemForm] = Form.useForm();
  const [useItemMockData, setUseItemMockData] = useState(false);
  
  const [listLoading, setListLoading] = useState(false);
  const [listData, setListData] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [listType, setListType] = useState(undefined);
  const [listStatus, setListStatus] = useState(undefined);
  const [selectedList, setSelectedList] = useState(null);
  const [listDetailModal, setListDetailModal] = useState(false);
  const [useListMockData, setUseListMockData] = useState(false);
  
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateData, setTemplateData] = useState([]);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState(10);
  const [templateSearchText, setTemplateSearchText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetailModal, setTemplateDetailModal] = useState(false);
  const [useTemplateMockData, setUseTemplateMockData] = useState(false);
  
  const [stats, setStats] = useState({
    totalItems: 0,
    totalLists: 0,
    totalTemplates: 0,
    officialTemplates: 0,
  });

  useEffect(() => {
    if (activeTab === 'items') {
      loadItems();
    } else if (activeTab === 'lists') {
      loadLists();
    } else if (activeTab === 'templates') {
      loadTemplates();
    }
    loadStats();
  }, [activeTab, itemPage, itemPageSize, listPage, listPageSize, templatePage, templatePageSize]);

  const loadStats = () => {
    setStats({
      totalItems: 56,
      totalLists: 32,
      totalTemplates: 24,
      officialTemplates: 8,
    });
  };

  const loadItems = async () => {
    setItemLoading(true);
    try {
      const response = await equipmentItemApi.getEquipmentItems(
        itemPage - 1,
        itemPageSize,
        itemSearchText || null,
        itemCategory
      );
      
      if (response && response.content && response.content.length > 0) {
        setItemData(response.content);
        setItemTotal(response.totalElements || 0);
        setUseItemMockData(false);
      } else {
        const mockData = generateMockEquipmentItems(itemPageSize);
        setItemData(mockData.content);
        setItemTotal(mockData.totalElements);
        setUseItemMockData(true);
      }
    } catch (error) {
      console.error('加载装备列表失败:', error);
      const mockData = generateMockEquipmentItems(itemPageSize);
      setItemData(mockData.content);
      setItemTotal(mockData.totalElements);
      setUseItemMockData(true);
    } finally {
      setItemLoading(false);
    }
  };

  const loadLists = async () => {
    setListLoading(true);
    try {
      const response = await equipmentListApi.getEquipmentLists(
        listPage - 1,
        listPageSize,
        listType,
        listStatus
      );
      
      if (response && response.content && response.content.length > 0) {
        setListData(response.content);
        setListTotal(response.totalElements || 0);
        setUseListMockData(false);
      } else {
        const mockData = generateMockEquipmentLists(listPageSize);
        setListData(mockData.content);
        setListTotal(mockData.totalElements);
        setUseListMockData(true);
      }
    } catch (error) {
      console.error('加载装备清单列表失败:', error);
      const mockData = generateMockEquipmentLists(listPageSize);
      setListData(mockData.content);
      setListTotal(mockData.totalElements);
      setUseListMockData(true);
    } finally {
      setListLoading(false);
    }
  };

  const loadTemplates = async () => {
    setTemplateLoading(true);
    try {
      const response = await equipmentTemplateApi.getTemplates(
        templatePage - 1,
        templatePageSize,
        templateSearchText || null
      );
      
      if (response && response.content && response.content.length > 0) {
        setTemplateData(response.content);
        setTemplateTotal(response.totalElements || 0);
        setUseTemplateMockData(false);
      } else {
        const mockData = generateMockTemplates(templatePageSize);
        setTemplateData(mockData.content);
        setTemplateTotal(mockData.totalElements);
        setUseTemplateMockData(true);
      }
    } catch (error) {
      console.error('加载装备模板列表失败:', error);
      const mockData = generateMockTemplates(templatePageSize);
      setTemplateData(mockData.content);
      setTemplateTotal(mockData.totalElements);
      setUseTemplateMockData(true);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
    if (useItemMockData) {
      message.warning('演示模式下无法删除数据');
      return;
    }
    
    try {
      await equipmentItemApi.deleteEquipmentItem(id);
      message.success('删除成功');
      loadItems();
    } catch (error) {
      console.error('删除装备失败:', error);
      message.error('删除失败');
    }
  };

  const handleDeleteList = async (id) => {
    if (useListMockData) {
      message.warning('演示模式下无法删除数据');
      return;
    }
    
    try {
      await equipmentListApi.deleteEquipmentList(id);
      message.success('删除成功');
      loadLists();
    } catch (error) {
      console.error('删除装备清单失败:', error);
      message.error('删除失败');
    }
  };

  const handleCreateItem = async (values) => {
    if (useItemMockData) {
      message.warning('演示模式下无法创建数据');
      return;
    }
    
    try {
      await equipmentItemApi.createEquipmentItem(values);
      message.success('创建成功');
      setItemEditModal(false);
      itemForm.resetFields();
      loadItems();
    } catch (error) {
      console.error('创建装备失败:', error);
      message.error('创建失败');
    }
  };

  const itemColumns = [
    {
      title: '装备名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (_, record) => (
        <Tag color="blue">{record.categoryName || getEquipmentCategoryText(record.category)}</Tag>
      ),
    },
    {
      title: '重量',
      dataIndex: 'weight',
      key: 'weight',
      render: (weight, record) => {
        const unit = record.weightUnitName || '克';
        return weight >= 1000 ? `${(weight / 1000).toFixed(2)}kg` : `${weight}${unit}`;
      },
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
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
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedItem(record);
              setItemDetailModal(true);
            }}
          >
            查看
          </Button>
          <Button
            type="default"
            size="small"
            icon={<EditOutlined />}
            onClick={() => {
              setSelectedItem(record);
              itemForm.setFieldsValue(record);
              setItemEditModal(true);
            }}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定要删除这个装备吗？"
            onConfirm={() => handleDeleteItem(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="default" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const listColumns = [
    {
      title: '清单名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (_, record) => (
        <Tag color="blue">{record.typeName || getEquipmentTypeText(record.type)}</Tag>
      ),
    },
    {
      title: '人数',
      dataIndex: 'personCount',
      key: 'personCount',
    },
    {
      title: '总重量',
      dataIndex: 'totalWeight',
      key: 'totalWeight',
      render: (weight) => {
        return weight >= 1000 ? `${(weight / 1000).toFixed(2)}kg` : `${weight}g`;
      },
    },
    {
      title: '装备数量',
      dataIndex: 'itemCount',
      key: 'itemCount',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (_, record) => (
        <Tag color={getEquipmentListStatusColor(record.status)}>
          {record.statusName || getEquipmentListStatusText(record.status)}
        </Tag>
      ),
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
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="primary"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => {
              setSelectedList(record);
              setListDetailModal(true);
            }}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这个装备清单吗？"
            onConfirm={() => handleDeleteList(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="default" size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const templateColumns = [
    {
      title: '模板名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (_, record) => (
        <Tag color="blue">{record.categoryName || getEquipmentCategoryText(record.category)}</Tag>
      ),
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (_, record) => (
        <Tag color="green">{record.typeName || getEquipmentTypeText(record.type)}</Tag>
      ),
    },
    {
      title: '官方模板',
      dataIndex: 'isOfficial',
      key: 'isOfficial',
      render: (isOfficial) => (
        isOfficial ? <Tag color="gold">官方</Tag> : <Tag>用户</Tag>
      ),
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
    },
    {
      title: '评分',
      dataIndex: 'rating',
      key: 'rating',
      render: (rating) => `${rating} ★`,
    },
    {
      title: '创建者',
      dataIndex: 'creatorName',
      key: 'creatorName',
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
      width: 100,
      render: (_, record) => (
        <Button
          type="primary"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedTemplate(record);
            setTemplateDetailModal(true);
          }}
        >
          查看
        </Button>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>装备管理</h2>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="装备总数"
              value={stats.totalItems}
              prefix={<ShoppingOutlined style={{ color: '#f093fb' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="装备清单"
              value={stats.totalLists}
              prefix={<UnorderedListOutlined style={{ color: '#4facfe' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="装备模板"
              value={stats.totalTemplates}
              prefix={<FileTextOutlined style={{ color: '#43e97b' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="官方模板"
              value={stats.officialTemplates}
              prefix={<AppstoreOutlined style={{ color: '#fa709a' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="装备物品" key="items">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Search
                  placeholder="搜索装备名称..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  style={{ width: 250 }}
                  value={itemSearchText}
                  onChange={(e) => setItemSearchText(e.target.value)}
                  onSearch={() => {
                    setItemPage(1);
                    loadItems();
                  }}
                />
                <Select
                  placeholder="装备分类"
                  allowClear
                  style={{ width: 150 }}
                  value={itemCategory}
                  onChange={(value) => {
                    setItemCategory(value);
                    setItemPage(1);
                    loadItems();
                  }}
                >
                  <Option value={0}>住宿装备</Option>
                  <Option value={1}>饮食装备</Option>
                  <Option value={2}>保暖装备</Option>
                  <Option value={3}>背包装备</Option>
                  <Option value={4}>导航装备</Option>
                  <Option value={5}>照明装备</Option>
                  <Option value={6}>急救装备</Option>
                  <Option value={7}>工具装备</Option>
                  <Option value={8}>电子装备</Option>
                  <Option value={9}>个人护理</Option>
                  <Option value={10}>其他装备</Option>
                </Select>
              </div>
              <Space>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedItem(null);
                    itemForm.resetFields();
                    setItemEditModal(true);
                  }}
                >
                  添加装备
                </Button>
                <Button icon={<ReloadOutlined />} onClick={loadItems}>
                  刷新
                </Button>
              </Space>
            </div>

            {useItemMockData && (
              <div style={{ marginBottom: 16 }}>
                <Tag color="orange">演示模式</Tag>
              </div>
            )}

            <Spin spinning={itemLoading}>
              <Table
                columns={itemColumns}
                dataSource={itemData}
                rowKey="id"
                pagination={{
                  current: itemPage,
                  pageSize: itemPageSize,
                  total: itemTotal,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  onChange: (page, size) => {
                    setItemPage(page);
                    setItemPageSize(size);
                  },
                }}
              />
            </Spin>
          </TabPane>

          <TabPane tab="装备清单" key="lists">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Select
                  placeholder="清单类型"
                  allowClear
                  style={{ width: 150 }}
                  value={listType}
                  onChange={(value) => {
                    setListType(value);
                    setListPage(1);
                    loadLists();
                  }}
                >
                  <Option value={0}>个人装备</Option>
                  <Option value={1}>团队装备</Option>
                  <Option value={2}>模板装备</Option>
                </Select>
                <Select
                  placeholder="清单状态"
                  allowClear
                  style={{ width: 150 }}
                  value={listStatus}
                  onChange={(value) => {
                    setListStatus(value);
                    setListPage(1);
                    loadLists();
                  }}
                >
                  <Option value={0}>规划中</Option>
                  <Option value={1}>准备中</Option>
                  <Option value={2}>已完成</Option>
                  <Option value={3}>已归档</Option>
                </Select>
              </div>
              <Button icon={<ReloadOutlined />} onClick={loadLists}>
                刷新
              </Button>
            </div>

            {useListMockData && (
              <div style={{ marginBottom: 16 }}>
                <Tag color="orange">演示模式</Tag>
              </div>
            )}

            <Spin spinning={listLoading}>
              <Table
                columns={listColumns}
                dataSource={listData}
                rowKey="id"
                pagination={{
                  current: listPage,
                  pageSize: listPageSize,
                  total: listTotal,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  onChange: (page, size) => {
                    setListPage(page);
                    setListPageSize(size);
                  },
                }}
              />
            </Spin>
          </TabPane>

          <TabPane tab="装备模板" key="templates">
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Search
                  placeholder="搜索模板名称..."
                  allowClear
                  enterButton={<SearchOutlined />}
                  style={{ width: 250 }}
                  value={templateSearchText}
                  onChange={(e) => setTemplateSearchText(e.target.value)}
                  onSearch={() => {
                    setTemplatePage(1);
                    loadTemplates();
                  }}
                />
              </div>
              <Button icon={<ReloadOutlined />} onClick={loadTemplates}>
                刷新
              </Button>
            </div>

            {useTemplateMockData && (
              <div style={{ marginBottom: 16 }}>
                <Tag color="orange">演示模式</Tag>
              </div>
            )}

            <Spin spinning={templateLoading}>
              <Table
                columns={templateColumns}
                dataSource={templateData}
                rowKey="id"
                pagination={{
                  current: templatePage,
                  pageSize: templatePageSize,
                  total: templateTotal,
                  showSizeChanger: true,
                  showQuickJumper: true,
                  showTotal: (total, range) => `第 ${range[0]}-${range[1]} 条，共 ${total} 条`,
                  onChange: (page, size) => {
                    setTemplatePage(page);
                    setTemplatePageSize(size);
                  },
                }}
              />
            </Spin>
          </TabPane>
        </Tabs>
      </Card>

      <Modal
        title="装备详情"
        open={itemDetailModal}
        onCancel={() => setItemDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setItemDetailModal(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedItem && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="装备ID">{selectedItem.id}</Descriptions.Item>
            <Descriptions.Item label="装备名称">{selectedItem.name}</Descriptions.Item>
            <Descriptions.Item label="分类">
              <Tag color="blue">{selectedItem.categoryName || getEquipmentCategoryText(selectedItem.category)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="重量">
              {selectedItem.weight >= 1000
                ? `${(selectedItem.weight / 1000).toFixed(2)}kg`
                : `${selectedItem.weight}${selectedItem.weightUnitName || '克'}`}
            </Descriptions.Item>
            <Descriptions.Item label="数量">{selectedItem.quantity}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTimestamp(selectedItem.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTimestamp(selectedItem.updatedAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title={selectedItem ? '编辑装备' : '添加装备'}
        open={itemEditModal}
        onCancel={() => setItemEditModal(false)}
        footer={null}
        width={500}
      >
        <Form
          form={itemForm}
          layout="vertical"
          onFinish={handleCreateItem}
        >
          <Form.Item
            name="name"
            label="装备名称"
            rules={[{ required: true, message: '请输入装备名称' }]}
          >
            <Input placeholder="请输入装备名称" />
          </Form.Item>
          <Form.Item
            name="category"
            label="装备分类"
            rules={[{ required: true, message: '请选择装备分类' }]}
          >
            <Select placeholder="请选择装备分类">
              <Option value={0}>住宿装备</Option>
              <Option value={1}>饮食装备</Option>
              <Option value={2}>保暖装备</Option>
              <Option value={3}>背包装备</Option>
              <Option value={4}>导航装备</Option>
              <Option value={5}>照明装备</Option>
              <Option value={6}>急救装备</Option>
              <Option value={7}>工具装备</Option>
              <Option value={8}>电子装备</Option>
              <Option value={9}>个人护理</Option>
              <Option value={10}>其他装备</Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="weight"
            label="重量 (克)"
            rules={[{ required: true, message: '请输入重量' }]}
          >
            <InputNumber
              placeholder="请输入重量"
              style={{ width: '100%' }}
              min={0}
            />
          </Form.Item>
          <Form.Item
            name="quantity"
            label="数量"
            rules={[{ required: true, message: '请输入数量' }]}
          >
            <InputNumber
              placeholder="请输入数量"
              style={{ width: '100%' }}
              min={1}
              defaultValue={1}
            />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {selectedItem ? '保存' : '创建'}
              </Button>
              <Button onClick={() => setItemEditModal(false)}>
                取消
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="装备清单详情"
        open={listDetailModal}
        onCancel={() => setListDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setListDetailModal(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedList && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="清单ID">{selectedList.id}</Descriptions.Item>
            <Descriptions.Item label="清单名称">{selectedList.name}</Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color="blue">{selectedList.typeName || getEquipmentTypeText(selectedList.type)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="人数">{selectedList.personCount} 人</Descriptions.Item>
            <Descriptions.Item label="总重量">
              {selectedList.totalWeight >= 1000
                ? `${(selectedList.totalWeight / 1000).toFixed(2)}kg`
                : `${selectedList.totalWeight}g`}
            </Descriptions.Item>
            <Descriptions.Item label="装备数量">{selectedList.itemCount} 件</Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={getEquipmentListStatusColor(selectedList.status)}>
                {selectedList.statusName || getEquipmentListStatusText(selectedList.status)}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTimestamp(selectedList.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTimestamp(selectedList.updatedAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        title="装备模板详情"
        open={templateDetailModal}
        onCancel={() => setTemplateDetailModal(false)}
        footer={[
          <Button key="close" onClick={() => setTemplateDetailModal(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTemplate && (
          <Descriptions bordered column={1}>
            <Descriptions.Item label="模板ID">{selectedTemplate.id}</Descriptions.Item>
            <Descriptions.Item label="模板名称">{selectedTemplate.name}</Descriptions.Item>
            <Descriptions.Item label="分类">
              <Tag color="blue">{selectedTemplate.categoryName || getEquipmentCategoryText(selectedTemplate.category)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color="green">{selectedTemplate.typeName || getEquipmentTypeText(selectedTemplate.type)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="官方模板">
              {selectedTemplate.isOfficial ? <Tag color="gold">是</Tag> : <Tag>否</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="创建者">{selectedTemplate.creatorName || selectedTemplate.creatorId}</Descriptions.Item>
            <Descriptions.Item label="使用次数">{selectedTemplate.usageCount} 次</Descriptions.Item>
            <Descriptions.Item label="评分">{selectedTemplate.rating} ★</Descriptions.Item>
            <Descriptions.Item label="创建时间">{formatTimestamp(selectedTemplate.createdAt)}</Descriptions.Item>
            <Descriptions.Item label="更新时间">{formatTimestamp(selectedTemplate.updatedAt)}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Equipment;
