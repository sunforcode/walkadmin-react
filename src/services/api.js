import axios from 'axios';

const API_BASE_URL = 'http://localhost:8080/walkbg';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('walk_admin_token');
    if (token && !token.startsWith('mock_')) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('walk_admin_token');
      if (!token || !token.startsWith('mock_')) {
        localStorage.removeItem('walk_admin_token');
        localStorage.removeItem('walk_admin_user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export const formatTimestamp = (timestamp) => {
  if (!timestamp) return '-';
  try {
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    return '-';
  }
};

export const getDifficultyText = (difficulty) => {
  const map = { 1: '简单', 2: '较易', 3: '中等', 4: '较难', 5: '困难' };
  return map[difficulty] || '未知';
};

export const getDifficultyTagColor = (difficulty) => {
  const map = { 1: 'green', 2: 'green', 3: 'orange', 4: 'red', 5: 'red' };
  return map[difficulty] || 'default';
};

export const getTripStatusText = (status) => {
  const map = { 0: '规划中', 1: '进行中', 2: '已完成', 3: '已取消' };
  return map[status] || '未知';
};

export const getTripStatusColor = (status) => {
  const map = { 0: 'blue', 1: 'green', 2: 'purple', 3: 'red' };
  return map[status] || 'default';
};

export const getGuideStatusText = (status) => {
  const map = { 0: '草稿', 1: '已发布', 2: '已下线' };
  return map[status] || '未知';
};

export const getGuideStatusColor = (status) => {
  const map = { 0: 'orange', 1: 'green', 2: 'red' };
  return map[status] || 'default';
};

export const extractApiData = (response) => {
  if (!response) return null;
  const data = response.data;
  if (data && data.code === 0 && data.data) {
    return data.data;
  }
  if (data && data.content !== undefined) {
    return data;
  }
  return data;
};

export const authApi = {
  login: async (email, password) => {
    try {
      const response = await api.post('/api/v1/auth/login', { email, password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export const userApi = {
  getUsers: async (page = 0, size = 10, keyword = null, status = null) => {
    try {
      const params = { page, size };
      if (keyword) params.keyword = keyword;
      if (status !== null) params.status = status;
      
      const response = await api.get('/api/v1/users', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取用户列表失败:', error);
      return null;
    }
  },
  
  getUserById: async (id) => {
    try {
      const response = await api.get(`/api/v1/users/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取用户详情失败:', error);
      return null;
    }
  },
  
  deleteUser: async (id) => {
    try {
      const response = await api.delete(`/api/v1/users/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除用户失败:', error);
      throw error;
    }
  },
};

export const routeApi = {
  getRoutes: async (page = 0, size = 10, keyword = null, difficulty = null) => {
    try {
      const params = { page, size };
      if (keyword) params.keyword = keyword;
      if (difficulty !== null) params.difficulty = difficulty;
      
      const response = await api.get('/api/v1/routes', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取路线列表失败:', error);
      return null;
    }
  },
  
  getRouteById: async (id) => {
    try {
      const response = await api.get(`/api/v1/routes/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取路线详情失败:', error);
      return null;
    }
  },
  
  getPopularRoutes: async (limit = 10) => {
    try {
      const response = await api.get('/api/v1/routes/popular', { params: { limit } });
      return extractApiData(response);
    } catch (error) {
      console.error('获取热门路线失败:', error);
      return null;
    }
  },
};

export const tripApi = {
  getTrips: async (page = 0, size = 10, keyword = null, status = null) => {
    try {
      const params = { page, size };
      if (keyword) params.keyword = keyword;
      if (status !== null) params.status = status;
      
      const response = await api.get('/api/v1/trips', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取行程列表失败:', error);
      return null;
    }
  },
  
  getTripById: async (id) => {
    try {
      const response = await api.get(`/api/v1/trips/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取行程详情失败:', error);
      return null;
    }
  },
  
  getTripStatistics: async () => {
    try {
      const response = await api.get('/api/v1/trips/statistics');
      return extractApiData(response);
    } catch (error) {
      console.error('获取行程统计失败:', error);
      return null;
    }
  },
};

export const guideApi = {
  getGuides: async (page = 0, size = 10, tag = null) => {
    try {
      const params = { page, size };
      if (tag) params.tag = tag;
      
      const response = await api.get('/api/v1/guides', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取攻略列表失败:', error);
      return null;
    }
  },
  
  getGuideById: async (id) => {
    try {
      const response = await api.get(`/api/v1/guides/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取攻略详情失败:', error);
      return null;
    }
  },
};

export const getEquipmentCategoryText = (category) => {
  const map = {
    0: '住宿装备',
    1: '饮食装备',
    2: '保暖装备',
    3: '背包装备',
    4: '导航装备',
    5: '照明装备',
    6: '急救装备',
    7: '工具装备',
    8: '电子装备',
    9: '个人护理',
    10: '其他装备'
  };
  return map[category] || '未知';
};

export const getEquipmentTypeText = (type) => {
  const map = { 0: '个人装备', 1: '团队装备', 2: '模板装备' };
  return map[type] || '未知';
};

export const getEquipmentListStatusText = (status) => {
  const map = { 0: '规划中', 1: '准备中', 2: '已完成', 3: '已归档' };
  return map[status] || '未知';
};

export const getEquipmentListStatusColor = (status) => {
  const map = { 0: 'blue', 1: 'orange', 2: 'green', 3: 'default' };
  return map[status] || 'default';
};

export const equipmentItemApi = {
  getEquipmentItems: async (page = 0, size = 10, keyword = null, category = null) => {
    try {
      const params = { page, size };
      if (keyword) params.keyword = keyword;
      if (category !== null) params.category = category;
      
      const response = await api.get('/api/v1/equipment/items', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备列表失败:', error);
      return null;
    }
  },
  
  getEquipmentItemById: async (id) => {
    try {
      const response = await api.get(`/api/v1/equipment/items/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备详情失败:', error);
      return null;
    }
  },
  
  createEquipmentItem: async (data) => {
    try {
      const response = await api.post('/api/v1/equipment/items', data);
      return response.data;
    } catch (error) {
      console.error('创建装备失败:', error);
      throw error;
    }
  },
  
  updateEquipmentItem: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/equipment/items/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新装备失败:', error);
      throw error;
    }
  },
  
  deleteEquipmentItem: async (id) => {
    try {
      const response = await api.delete(`/api/v1/equipment/items/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除装备失败:', error);
      throw error;
    }
  },
  
  getCategoryStats: async () => {
    try {
      const response = await api.get('/api/v1/equipment/category-stats');
      return extractApiData(response);
    } catch (error) {
      console.error('获取分类统计失败:', error);
      return null;
    }
  },
};

export const equipmentListApi = {
  getEquipmentLists: async (page = 0, size = 10, type = null, status = null) => {
    try {
      const params = { page, size };
      if (type !== null) params.type = type;
      if (status !== null) params.status = status;
      
      const response = await api.get('/api/v1/equipment-lists', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备清单列表失败:', error);
      return null;
    }
  },
  
  getEquipmentListById: async (id) => {
    try {
      const response = await api.get(`/api/v1/equipment-lists/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备清单详情失败:', error);
      return null;
    }
  },
  
  createEquipmentList: async (data) => {
    try {
      const response = await api.post('/api/v1/equipment-lists', data);
      return response.data;
    } catch (error) {
      console.error('创建装备清单失败:', error);
      throw error;
    }
  },
  
  updateEquipmentList: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/equipment-lists/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新装备清单失败:', error);
      throw error;
    }
  },
  
  deleteEquipmentList: async (id) => {
    try {
      const response = await api.delete(`/api/v1/equipment-lists/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除装备清单失败:', error);
      throw error;
    }
  },
  
  getListItems: async (listId, page = 0, size = 20) => {
    try {
      const params = { page, size };
      const response = await api.get(`/api/v1/equipment-lists/${listId}/items`, { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取清单装备列表失败:', error);
      return null;
    }
  },
  
  addItemToList: async (listId, data) => {
    try {
      const response = await api.post(`/api/v1/equipment-lists/${listId}/items`, data);
      return response.data;
    } catch (error) {
      console.error('添加装备到清单失败:', error);
      throw error;
    }
  },
  
  removeItemFromList: async (listId, itemId) => {
    try {
      const response = await api.delete(`/api/v1/equipment-lists/${listId}/items/${itemId}`);
      return response.data;
    } catch (error) {
      console.error('从清单移除装备失败:', error);
      throw error;
    }
  },
  
  getWeightStats: async (listId) => {
    try {
      const response = await api.get(`/api/v1/equipment-lists/${listId}/weight-stats`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取清单重量统计失败:', error);
      return null;
    }
  },
  
  updateListStatus: async (listId, status) => {
    try {
      const response = await api.patch(`/api/v1/equipment-lists/${listId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('更新清单状态失败:', error);
      throw error;
    }
  },
};

export const equipmentTemplateApi = {
  getTemplates: async (page = 0, size = 10, keyword = null, category = null, type = null, isOfficial = null) => {
    try {
      const params = { page, size };
      if (keyword) params.keyword = keyword;
      if (category !== null) params.category = category;
      if (type !== null) params.type = type;
      if (isOfficial !== null) params.isOfficial = isOfficial;
      
      const response = await api.get('/api/v1/equipment-templates', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备模板列表失败:', error);
      return null;
    }
  },
  
  getTemplateById: async (id) => {
    try {
      const response = await api.get(`/api/v1/equipment-templates/${id}`);
      return extractApiData(response);
    } catch (error) {
      console.error('获取装备模板详情失败:', error);
      return null;
    }
  },
  
  createTemplate: async (data) => {
    try {
      const response = await api.post('/api/v1/equipment-templates', data);
      return response.data;
    } catch (error) {
      console.error('创建装备模板失败:', error);
      throw error;
    }
  },
  
  getOfficialTemplates: async (page = 0, size = 10) => {
    try {
      const params = { page, size };
      const response = await api.get('/api/v1/equipment-templates/official', { params });
      return extractApiData(response);
    } catch (error) {
      console.error('获取官方模板失败:', error);
      return null;
    }
  },
};

export const mockDataGenerator = {
  generateMockUsers: (count = 10) => {
    const names = ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一', '冯十二'];
    const users = [];
    
    for (let i = 0; i < count; i++) {
      users.push({
        id: `user_${i + 1}`,
        username: `user${i + 1}`,
        nickname: names[i % names.length],
        email: `user${i + 1}@example.com`,
        phone: `1380000${String(1000 + i).padStart(4, '0')}`,
        avatarUrl: null,
        createdAt: Math.floor(Date.now() / 1000) - i * 86400,
      });
    }
    
    return {
      content: users,
      totalElements: 128,
      totalPages: 13,
      number: 0,
      size: 10,
    };
  },

  generateMockRoutes: (count = 10) => {
    const routeNames = ['五台山徒步路线', '武功山穿越路线', '稻城亚丁徒步', '雨崩徒步路线', '虎跳峡徒步', '贡嘎大环线', '四姑娘山徒步', '鳌太穿越', '洛克线徒步', '夏特古道'];
    const regions = ['山西', '江西', '四川', '云南', '云南', '四川', '四川', '陕西', '四川', '新疆'];
    
    const routes = [];
    
    for (let i = 0; i < count; i++) {
      routes.push({
        id: `route_${i + 1}`,
        name: routeNames[i % routeNames.length],
        description: `这是${routeNames[i % routeNames.length]}的详细描述，包含路线特点、注意事项等信息。`,
        region: regions[i % regions.length],
        difficulty: (i % 5) + 1,
        popularity: Math.floor(Math.random() * 1000),
        createdAt: Math.floor(Date.now() / 1000) - i * 86400 * 2,
        createdBy: `user_${(i % 5) + 1}`,
        coverUrl: null,
      });
    }
    
    return {
      content: routes,
      totalElements: 56,
      totalPages: 6,
      number: 0,
      size: 10,
    };
  },

  generateMockTrips: (count = 10) => {
    const tripNames = ['周末徒步活动', '国庆长假徒步', '春季踏青之旅', '夏季避暑徒步', '秋季赏叶行程', '冬季雪山攀登', '团队建设徒步', '亲子徒步活动', '摄影徒步之旅', '探险徒步行程'];
    
    const trips = [];
    
    for (let i = 0; i < count; i++) {
      trips.push({
        id: `trip_${i + 1}`,
        name: tripNames[i % tripNames.length],
        description: `这是${tripNames[i % tripNames.length]}的详细描述。`,
        status: i % 4,
        startDate: Math.floor(Date.now() / 1000) + i * 86400,
        endDate: Math.floor(Date.now() / 1000) + (i + 2) * 86400,
        organizerId: `user_${(i % 5) + 1}`,
        budget: (Math.floor(Math.random() * 10000) + 1000).toFixed(2),
        createdAt: Math.floor(Date.now() / 1000) - i * 86400,
        updatedAt: Math.floor(Date.now() / 1000) - i * 3600,
      });
    }
    
    return {
      content: trips,
      totalElements: 89,
      totalPages: 9,
      number: 0,
      size: 10,
    };
  },

  generateMockGuides: (count = 10) => {
    const guideTitles = ['新手徒步入门指南', '高海拔徒步注意事项', '徒步装备选择攻略', '户外急救知识大全', '徒步路线规划技巧', '摄影徒步技巧分享', '亲子徒步注意事项', '冬季徒步保暖攻略', '徒步饮食搭配建议', '徒步安全须知'];
    
    const guides = [];
    
    for (let i = 0; i < count; i++) {
      guides.push({
        id: `guide_${i + 1}`,
        title: guideTitles[i % guideTitles.length],
        content: `这是${guideTitles[i % guideTitles.length]}的详细内容。`,
        author: `用户${i + 1}`,
        authorId: `user_${(i % 5) + 1}`,
        views: Math.floor(Math.random() * 5000),
        likes: Math.floor(Math.random() * 500),
        status: i % 3,
        difficulty: (i % 5) + 1,
        tags: ['徒步', '攻略', '入门'],
        publishDate: Math.floor(Date.now() / 1000) - i * 86400 * 3,
        updateDate: Math.floor(Date.now() / 1000) - i * 3600,
      });
    }
    
    return {
      content: guides,
      totalElements: 42,
      totalPages: 5,
      number: 0,
      size: 10,
    };
  },
};

const extractApiResponseData = (response) => {
  if (!response) return null;
  const apiResponse = response.data;
  if (!apiResponse) return null;
  
  if (apiResponse.success === true && apiResponse.data !== undefined && apiResponse.data !== null) {
    return apiResponse.data;
  }
  
  if (apiResponse.success === false) {
    throw new Error(apiResponse.message || '请求失败');
  }
  
  if (apiResponse.code === 200 && apiResponse.data !== undefined && apiResponse.data !== null) {
    return apiResponse.data;
  }
  
  return apiResponse;
};

export const agentServiceApi = {
  healthCheck: async () => {
    try {
      const response = await api.get('/api/v1/route-analysis/health');
      const apiResponse = response.data;
      
      if (!apiResponse) {
        throw new Error('无法获取健康检查结果');
      }
      
      let result;
      if (apiResponse.success === true && apiResponse.data) {
        result = apiResponse.data;
      } else if (apiResponse.code === 200 && apiResponse.data) {
        result = apiResponse.data;
      } else {
        result = apiResponse;
      }
      
      if (!result) {
        throw new Error('无法获取健康检查结果');
      }
      
      if (result.available === true || result.status === 'healthy') {
        return {
          status: result.status || 'healthy',
          version: result.version || '1.0.0',
          checks: result.checks || {},
        };
      } else {
        throw new Error(result.message || 'Agent服务不可用');
      }
    } catch (error) {
      console.error('Agent服务健康检查失败:', error);
      throw error;
    }
  },

  submitAnalysis: async (data) => {
    try {
      const requestData = {
        kml_source: data.kml_source,
        enable_content_generation: data.enable_content_generation,
        enable_poi_query: data.enable_poi_query,
        poi_search_radius: data.poi_search_radius,
      };

      if (data.route_id) {
        requestData.route_id = data.route_id;
      }
      if (data.region_name) {
        requestData.region_name = data.region_name;
      }
      if (data.estimated_difficulty) {
        requestData.estimated_difficulty = data.estimated_difficulty;
      }
      if (data.user_notes) {
        requestData.user_notes = data.user_notes;
      }

      const response = await api.post('/api/v1/route-analysis/analyze', requestData);
      const result = extractApiResponseData(response);
      if (!result) {
        throw new Error('提交分析任务失败，无响应数据');
      }
      return result;
    } catch (error) {
      console.error('提交分析任务失败:', error);
      throw error;
    }
  },

  getTaskStatus: async (taskId) => {
    try {
      const response = await api.get(`/api/v1/route-analysis/tasks/${taskId}`);
      const result = extractApiResponseData(response);
      if (!result) {
        throw new Error('查询任务状态失败，无响应数据');
      }
      return result;
    } catch (error) {
      console.error('查询任务状态失败:', error);
      throw error;
    }
  },
};

export default api;
