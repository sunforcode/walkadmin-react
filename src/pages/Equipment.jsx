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
  formatTimestamp,
} from '../services/api';

const { Search } = Input;
const { Option } = Select;
const { TabPane } = Tabs;

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
  
  const [listLoading, setListLoading] = useState(false);
  const [listData, setListData] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);
  const [listType, setListType] = useState(undefined);
  const [listStatus, setListStatus] = useState(undefined);
  const [selectedList, setSelectedList] = useState(null);
  const [listDetailModal, setListDetailModal] = useState(false);
  
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateData, setTemplateData] = useState([]);
  const [templateTotal, setTemplateTotal] = useState(0);
  const [templatePage, setTemplatePage] = useState(1);
  const [templatePageSize, setTemplatePageSize] = useState(10);
  const [templateSearchText, setTemplateSearchText] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateDetailModal, setTemplateDetailModal] = useState(false);
  
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

  const loadStats = async () => {
    try {
      const results = await Promise.allSettled([
        equipmentItemApi.getEquipmentItems(0, 1),
        equipmentListApi.getEquipmentLists(0, 1),
        equipmentTemplateApi.getTemplates(0, 1),
      ]);
      const [itemsRes, listsRes, templatesRes] = results;
      
      const failed = results.filter(r => r.status === 'rejected');
      if (failed.length > 0) {
        message.error(`装备统计部分加载失败（${failed.length}/${results.length}）`);
      }
      
      setStats({
        totalItems: itemsRes.status === 'fulfilled' ? (itemsRes.value?.totalElements || 0) : 0,
        totalLists: listsRes.status === 'fulfilled' ? (listsRes.value?.totalElements || 0) : 0,
        totalTemplates: templatesRes.status === 'fulfilled' ? (templatesRes.value?.totalElements || 0) : 0,
        officialTemplates: 0,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载装备统计数据失败');
    }
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
      
      if (response && response.content) {
        setItemData(response.content);
        setItemTotal(response.totalElements || 0);
      } else {
        setItemData([]);
        setItemTotal(0);
      }
    } catch (error) {
      console.error('加载装备列表失败:', error);
      message.error('加载装备列表失败');
      setItemData([]);
      setItemTotal(0);
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
      
      if (response && response.content) {
        setListData(response.content);
        setListTotal(response.totalElements || 0);
      } else {
        setListData([]);
        setListTotal(0);
      }
    } catch (error) {
      console.error('加载装备清单列表失败:', error);
      message.error('加载装备清单列表失败');
      setListData([]);
      setListTotal(0);
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
      
      if (response && response.content) {
        setTemplateData(response.content);
        setTemplateTotal(response.totalElements || 0);
      } else {
        setTemplateData([]);
        setTemplateTotal(0);
      }
    } catch (error) {
      console.error('加载装备模板列表失败:', error);
      message.error('加载装备模板列表失败');
      setTemplateData([]);
      setTemplateTotal(0);
    } finally {
      setTemplateLoading(false);
    }
  };

  const handleDeleteItem = async (id) => {
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
