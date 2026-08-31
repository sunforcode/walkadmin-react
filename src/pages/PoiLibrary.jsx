import { useEffect, useMemo, useState } from 'react';
import { Card, Table, Button, Space, Tag, Input, Select, message, Popconfirm, Tooltip } from 'antd';
import { ReloadOutlined, SearchOutlined, DeleteOutlined, DatabaseOutlined } from '@ant-design/icons';
import { poiLibraryApi, formatTimestamp } from '../services/api';

const CATEGORY_META = {
  water: { label: '💧 水源', color: 'blue' },
  camp: { label: '⛺ 营地', color: 'green' },
  supply: { label: '🛒 补给点', color: 'orange' },
  photo: { label: '📷 观景点', color: 'purple' },
  pass: { label: '⛰️ 垭口', color: 'geekblue' },
  valley: { label: '🏞️ 河谷', color: 'cyan' },
  weather: { label: '🌤️ 气象点', color: 'default' },
  danger: { label: '⚠️ 危险点', color: 'red' },
  start: { label: '🚩 起点', color: 'red' },
  end: { label: '🏁 终点', color: 'red' },
};

const PoiLibrary = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState(null);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await poiLibraryApi.list();
      setItems(data || []);
    } catch (error) {
      console.error('获取 POI 库失败:', error);
      message.error('获取 POI 库失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (keyword && !(it.name || '').toLowerCase().includes(keyword.toLowerCase())) return false;
      return true;
    });
  }, [items, keyword, category]);

  const handleRemove = async (item) => {
    try {
      await poiLibraryApi.remove(item.id);
      message.success(`「${item.name}」已从库中移除`);
      loadItems();
    } catch (error) {
      console.error('移除失败:', error);
      message.error('移除失败');
    }
  };

  const columns = [
    { title: '名称', dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
    {
      title: '类别',
      dataIndex: 'category',
      key: 'category',
      width: 110,
      filters: Object.entries(CATEGORY_META).map(([value, meta]) => ({ text: meta.label, value })),
      onFilter: (value, record) => record.category === value,
      render: (cat) => {
        const meta = CATEGORY_META[cat] || { label: cat, color: 'default' };
        return <Tag color={meta.color}>{meta.label}</Tag>;
      },
    },
    {
      title: '地区',
      dataIndex: 'region_name',
      key: 'region_name',
      width: 130,
      ellipsis: true,
      filters: Array.from(new Set(items.map((it) => it.region_name).filter(Boolean))).map((r) => ({ text: r, value: r })),
      onFilter: (value, record) => record.region_name === value,
      render: (v) => v || <span style={{ color: '#ccc' }}>未指定</span>,
    },
    { title: '海拔(m)', dataIndex: 'elevation', key: 'elevation', width: 90, sorter: (a, b) => (a.elevation || 0) - (b.elevation || 0), render: (v) => v ?? '-' },
    {
      title: '坐标',
      key: 'coord',
      width: 170,
      render: (_, record) => (
        <span style={{ color: '#888', fontSize: 12 }}>
          {record.latitude?.toFixed(4)}, {record.longitude?.toFixed(4)}
        </span>
      ),
    },
    {
      title: 'AI 理由',
      dataIndex: 'ai_reason',
      key: 'ai_reason',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span style={{ color: '#888' }}>{text || '-'}</span>
        </Tooltip>
      ),
    },
    { title: '来源路线', dataIndex: 'source_route_id', key: 'source_route_id', width: 200, ellipsis: true, render: (v) => v || '-' },
    { title: '入库时间', dataIndex: 'created_at', key: 'created_at', width: 160, render: (v) => formatTimestamp(v ? Math.floor(v / 1000) : null) || '-' },
    {
      title: '操作',
      key: 'action',
      width: 90,
      render: (_, record) => (
        <Popconfirm
          title="确认从库中移除该 POI？"
          description="移除后，后续路线分析将不再自动匹配该条目。"
          onConfirm={() => handleRemove(record)}
          okText="移除"
          cancelText="取消"
        >
          <Button size="small" type="link" danger icon={<DeleteOutlined />}>
            移除
          </Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Card
        title={
          <span>
            <DatabaseOutlined /> POI 库
            <span style={{ fontWeight: 400, fontSize: 12, color: '#888', marginLeft: 8 }}>
              AI 筛选 + 人工确认沉淀的全局兴趣点，路线分析时同名且距离 300m 内自动复用
            </span>
          </span>
        }
        extra={
          <Space>
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="搜索名称..."
              style={{ width: 200 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
            />
            <Select
              allowClear
              placeholder="全部类别"
              style={{ width: 140 }}
              value={category}
              onChange={(v) => setCategory(v || null)}
              options={Object.entries(CATEGORY_META).map(([value, meta]) => ({ value, label: meta.label }))}
            />
            <Button icon={<ReloadOutlined />} onClick={loadItems} loading={loading}>
              刷新
            </Button>
          </Space>
        }
      >
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={filteredItems}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (total) => `共 ${total} 条` }}
        />
      </Card>
    </div>
  );
};

export default PoiLibrary;
