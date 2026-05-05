import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Spin, message } from 'antd';
import {
  TeamOutlined,
  CompassOutlined,
  RocketOutlined,
  BookOutlined,
} from '@ant-design/icons';
import { userApi, routeApi, tripApi, guideApi, mockDataGenerator } from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({
    users: 0,
    routes: 0,
    trips: 0,
    guides: 0,
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    setLoading(true);
    try {
      const [usersRes, routesRes, tripsRes, guidesRes] = await Promise.all([
        userApi.getUsers(0, 1),
        routeApi.getRoutes(0, 1),
        tripApi.getTrips(0, 1),
        guideApi.getGuides(0, 1),
      ]);

      let userTotal = usersRes?.totalElements || 0;
      let routeTotal = routesRes?.totalElements || 0;
      let tripTotal = tripsRes?.totalElements || 0;
      let guideTotal = guidesRes?.totalElements || 0;

      if (userTotal === 0 && routeTotal === 0 && tripTotal === 0 && guideTotal === 0) {
        const mockUsers = mockDataGenerator.generateMockUsers(1);
        const mockRoutes = mockDataGenerator.generateMockRoutes(1);
        const mockTrips = mockDataGenerator.generateMockTrips(1);
        const mockGuides = mockDataGenerator.generateMockGuides(1);
        
        userTotal = mockUsers.totalElements;
        routeTotal = mockRoutes.totalElements;
        tripTotal = mockTrips.totalElements;
        guideTotal = mockGuides.totalElements;
        message.info('使用演示数据');
      }

      setStats({
        users: userTotal,
        routes: routeTotal,
        trips: tripTotal,
        guides: guideTotal,
      });
    } catch (error) {
      console.error('加载统计数据失败:', error);
      const mockUsers = mockDataGenerator.generateMockUsers(1);
      const mockRoutes = mockDataGenerator.generateMockRoutes(1);
      const mockTrips = mockDataGenerator.generateMockTrips(1);
      const mockGuides = mockDataGenerator.generateMockGuides(1);
      
      setStats({
        users: mockUsers.totalElements,
        routes: mockRoutes.totalElements,
        trips: mockTrips.totalElements,
        guides: mockGuides.totalElements,
      });
      message.info('使用演示数据');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24, fontSize: 24, fontWeight: 600 }}>仪表盘</h2>
      
      <Spin spinning={loading}>
        <Row gutter={[24, 24]}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="用户总数"
                value={stats.users}
                prefix={<TeamOutlined style={{ color: '#f093fb' }} />}
                valueStyle={{ color: '#333' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="路线总数"
                value={stats.routes}
                prefix={<CompassOutlined style={{ color: '#4facfe' }} />}
                valueStyle={{ color: '#333' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="行程总数"
                value={stats.trips}
                prefix={<RocketOutlined style={{ color: '#43e97b' }} />}
                valueStyle={{ color: '#333' }}
              />
            </Card>
          </Col>
          
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="攻略总数"
                value={stats.guides}
                prefix={<BookOutlined style={{ color: '#fa709a' }} />}
                valueStyle={{ color: '#333' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
          <Col xs={24} lg={12}>
            <Card title="系统说明">
              <p style={{ color: '#666' }}>
                欢迎使用 Walk Admin 后台管理系统。您可以通过左侧菜单管理用户、路线、行程和攻略等内容。
              </p>
              <p style={{ color: '#666', marginTop: 16 }}>
                系统功能包括：
              </p>
              <ul style={{ color: '#666', marginTop: 8, paddingLeft: 20 }}>
                <li>用户管理：查看和管理平台用户</li>
                <li>路线管理：查看和管理徒步路线（路线无状态字段）</li>
                <li>行程管理：查看和管理用户行程（状态：规划中/进行中/已完成/已取消）</li>
                <li>攻略管理：查看和管理用户攻略（状态：草稿/已发布/已下线）</li>
              </ul>
            </Card>
          </Col>
          
          <Col xs={24} lg={12}>
            <Card title="关于后台管理的状态说明">
              <p style={{ color: '#666' }}>
                在后台管理中，我们区分两种类型的状态：
              </p>
              <div style={{ marginTop: 16 }}>
                <h4 style={{ marginBottom: 8, color: '#333' }}>需要管理的状态：</h4>
                <ul style={{ color: '#666', paddingLeft: 20 }}>
                  <li><strong>用户状态</strong>：正常/禁用（管理员可以控制）</li>
                  <li><strong>行程状态</strong>：规划中/进行中/已完成/已取消（业务状态）</li>
                  <li><strong>攻略状态</strong>：草稿/已发布/已下线（内容审核状态）</li>
                </ul>
                <h4 style={{ marginTop: 16, marginBottom: 8, color: '#333' }}>不需要显示的"状态"：</h4>
                <ul style={{ color: '#666', paddingLeft: 20 }}>
                  <li><strong>路线无状态字段</strong>：路线本身没有发布/审核状态，它只是用户创建的内容</li>
                </ul>
              </div>
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};

export default Dashboard;
