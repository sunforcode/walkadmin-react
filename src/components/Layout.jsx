import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Menu, Dropdown, Avatar } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  CompassOutlined,
  RocketOutlined,
  BookOutlined,
  LogoutOutlined,
  UserOutlined,
  ShoppingOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const { Header, Sider, Content } = AntLayout;

const menuItems = [
  {
    key: '/dashboard',
    icon: <DashboardOutlined />,
    label: '仪表盘',
  },
  {
    key: '/users',
    icon: <TeamOutlined />,
    label: '用户管理',
  },
  {
    key: '/routes',
    icon: <CompassOutlined />,
    label: '路线管理',
  },
  {
    key: '/poi-library',
    icon: <DatabaseOutlined />,
    label: 'POI 库',
  },
  {
    key: '/trips',
    icon: <RocketOutlined />,
    label: '行程管理',
  },
  {
    key: '/guides',
    icon: <BookOutlined />,
    label: '攻略管理',
  },
  {
    key: '/equipment',
    icon: <ShoppingOutlined />,
    label: '装备管理',
  },
  {
    key: '/agent-service',
    icon: <CloudServerOutlined />,
    label: 'Agent 服务',
  },
];

const Layout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: user?.username || user?.email || '管理员',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  return (
    <AntLayout>
      <Sider width={240} theme="dark">
        <div className="logo">
          <h2>Walk Admin</h2>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          theme="dark"
        />
      </Sider>
      
      <AntLayout>
        <Header>
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <div style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <Avatar icon={<UserOutlined />} style={{ marginRight: 8 }} />
              <span>{user?.username || user?.email || '管理员'}</span>
            </div>
          </Dropdown>
        </Header>
        
        <Content>
          <Outlet />
        </Content>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
