import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, message, Spin } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import './Login.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const response = await authApi.login(values.username, values.password);
      
      if (response.code === 0 || response.success) {
        const data = response.data || response;
        const token = data.token || data.accessToken;
        // 后端登录响应把用户字段平铺在 data 上（无 data.user），
        // 因此优先取 data 自身，最后才回落到表单里的用户名。
        const user = data.user || { username: data.username || values.username, email: data.email };
        
        login(token, user);
        message.success('登录成功');
        navigate('/dashboard');
      } else {
        message.error(response.message || '登录失败');
      }
    } catch (error) {
      console.error('登录错误:', error);
      message.error('登录失败，请检查账号密码或网络连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-header">
          <h1>Walk Admin</h1>
          <p>徒步应用管理平台</p>
        </div>
        
        <Spin spinning={loading}>
          <Form
            name="login"
            onFinish={onFinish}
            autoComplete="off"
            size="large"
          >
            {/* 后端以 username 作为登录标识（见 UserLoginRequest），
                不接受邮箱登录，故此处不能再做邮箱格式校验。 */}
            <Form.Item
              name="username"
              rules={[
                { required: true, message: '请输入用户名' },
                { min: 3, max: 50, message: '用户名长度必须在3-50字符之间' }
              ]}
            >
              <Input
                prefix={<UserOutlined />}
                placeholder="请输入用户名"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined />}
                placeholder="请输入密码"
              />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" block className="login-button">
                登录
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default Login;
