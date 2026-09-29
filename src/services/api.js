import axios from 'axios';
import { prepareKmlUpload } from './kmzInput.js';

/**
 * 后端 API 基地址。
 *
 * 默认使用同源相对路径 '/walkbg'，由部署环境的反向代理转发到真实后端，
 * 因此构建产物不含任何环境相关地址，同一份 dist 可部署到任意环境。
 *
 * 本地开发通过 vite.config.js 的 server.proxy 转发到本地后端。
 * 如需指向独立域名的后端（跨域部署），构建时设置 VITE_API_BASE_URL。
 */
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/walkbg';

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
    if (token) {
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
      localStorage.removeItem('walk_admin_token');
      localStorage.removeItem('walk_admin_user');
      // 使用 BASE_URL 拼接，保证部署在子路径下时也能正确跳转
      const base = import.meta.env.BASE_URL || '/';
      window.location.href = `${base.replace(/\/$/, '')}/login`;
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

export const getRouteStatusText = (status) => {
  const map = { 0: '规划中', 1: '已发布', 2: '已关闭', 3: '分析中' };
  return map[status] ?? '未知';
};

export const getRouteStatusColor = (status) => {
  const map = { 0: 'orange', 1: 'green', 2: 'red', 3: 'blue' };
  return map[status] ?? 'default';
};

export const extractApiData = (response) => {
  if (!response) return null;
  const data = response.data;
  if (!data) return null;
  
  // 后端标准响应格式: { success: true, data: {...}, message: "..." }
  if (data.success === true && data.data !== undefined) {
    return data.data;
  }
  
  // 兼容 code 格式: { code: 0, data: {...} }
  if (data.code === 0 && data.data) {
    return data.data;
  }
  
  // 直接返回分页数据 { content: [...], totalElements: ... }
  if (data.content !== undefined) {
    return data;
  }
  
  return data;
};

export const authApi = {
  // 后端 username/password 登录位于 /api/v1/legacy/auth（AuthController），
  // 新 /api/v1/auth（AccountAuthController）只有验证码 + session，无 /login 端点。
  login: async (username, password) => {
    try {
      const response = await api.post('/api/v1/legacy/auth/login', { username, password });
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export const userApi = {
  getUsers: async (page = 0, size = 10, keyword = null, status = null) => {
    const params = { page, size };
    if (keyword) params.keyword = keyword;
    if (status !== null) params.status = status;
    
    const response = await api.get('/api/v1/users', { params });
    return extractApiData(response);
  },
  
  getUserById: async (id) => {
    const response = await api.get(`/api/v1/users/${id}`);
    return extractApiData(response);
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
  getRoutes: async (page = 0, size = 10, keyword = null, difficulty = null, status = null) => {
    const params = { page, size };
    if (keyword) params.keyword = keyword;
    if (difficulty !== null) params.difficulty = difficulty;
    if (status !== null && status !== undefined) params.status = status;

    // 管理端专用接口：返回全部状态，支持按状态筛选；公共接口只返回已发布
    const response = await api.get('/api/v1/admin/routes', { params });
    return extractApiData(response);
  },
  
  getRouteById: async (id) => {
    const response = await api.get(`/api/v1/routes/${id}`);
    return extractApiData(response);
  },
  
  getPopularRoutes: async (limit = 10) => {
    const response = await api.get('/api/v1/routes/popular', { params: { limit } });
    return extractApiData(response);
  },

  createRoute: async (data) => {
    const response = await api.post('/api/v1/routes', data);
    return extractApiData(response);
  },

  // 更新路线基本信息（管理端，仅更新传入字段）
  updateRoute: async (routeId, data) => {
    const response = await api.put(`/api/v1/routes/${routeId}`, data);
    return extractApiData(response);
  },

  getMainTrackReview: async (routeId) => {
    const response = await api.get(`/api/v1/routes/${routeId}/main-track-review`);
    return extractApiData(response);
  },

  submitMainTrackReview: async (routeId, request) => {
    if (!request?.candidate_id?.trim() || !request.request_id?.trim() || request.request_id.length > 64
      || !Number.isInteger(request.expected_revision) || request.expected_revision < 0) {
      throw new Error('缺少有效候选、审核版本或请求身份，请刷新审核资料');
    }
    if (request.decision === 'approved') {
      if (request.confirm_complete_hiking_range !== true || !request.reference_system?.trim()
        || request.reference_system.length > 64) {
        throw new Error('请明确确认完整徒步范围并选择坐标参考系统');
      }
    } else if (request.decision === 'rejected') {
      if (request.confirm_complete_hiking_range !== false || request.reference_system != null || !request.reason?.trim()) {
        throw new Error('驳回需填写原因，不能携带通过确认或坐标声明');
      }
    } else {
      throw new Error('请选择通过或驳回');
    }
    if (request.reason != null && (!request.reason.trim() || request.reason.length > 1000)) {
      throw new Error('审核原因必须为非空文字且不超过1000字');
    }
    const response = await api.post(`/api/v1/routes/${routeId}/main-track-review`, request);
    return extractApiData(response);
  },

  // 发布必须提供显式类型和可重试身份，并核验公共读取结果。
  changeRouteStatus: async (routeId, targetStatus, reason = null, publication = null) => {
    const body = { target_status: targetStatus, reason };
    if (targetStatus === 1) {
      if (!['one_day', 'multi_day'].includes(publication?.public_route_type)) {
        throw new Error('请选择公共路线类型');
      }
      if (!publication?.publication_id?.trim() || publication.publication_id.length > 64) {
        throw new Error('缺少有效的发布请求身份');
      }
      body.public_route_type = publication.public_route_type;
      body.publication_id = publication.publication_id;
    }
    const response = await api.post(`/api/v1/routes/${routeId}/status`, body);
    const result = extractApiData(response);
    if (targetStatus === 1) {
      if (result?.is_public !== true || !result.published_version_id) {
        throw new Error('未取得公开版本，发布尚未验证');
      }
      const publicResponse = await api.get(`/api/v1/public-routes/${routeId}`);
      const detail = publicResponse.data?.data;
      if (detail?.routeId !== routeId || detail.currentVersion?.versionId !== result.published_version_id) {
        throw new Error('公共版本核验未通过，请使用原请求重试');
      }
    }
    return result;
  },

  // 删除路线（软删除），被未取消行程引用时后端会拒绝
  deleteRoute: async (routeId, force = false) => {
    const response = await api.delete(`/api/v1/routes/${routeId}`, {
      params: force ? { force: true } : undefined,
    });
    return extractApiData(response);
  },

  // KMZ is unpacked locally; the upload contract remains a single KML file.
  uploadKml: async (file) => {
    const kmlFile = await prepareKmlUpload(file);
    const formData = new FormData();
    formData.append('file', kmlFile);
    const response = await api.post('/api/v1/route-analysis/kml/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
    return extractApiData(response);
  },

  // 路段拆分：在指定轨迹索引处拆为两段
  splitSegment: async (routeId, segmentId, splitTrackIndex, splitPoint = null) => {
    const body = { split_track_index: splitTrackIndex };
    if (splitPoint) body.splitPoint = splitPoint;
    const response = await api.post(`/api/v1/routes/${routeId}/segments/${segmentId}/split`, body);
    return extractApiData(response);
  },

  // 采纳草稿数据
  adoptSegment: async (routeId, segmentId) => {
    const response = await api.post(`/api/v1/routes/${routeId}/segments/${segmentId}/adopt`);
    return extractApiData(response);
  },

  adoptAllSegments: async (routeId) => {
    const response = await api.post(`/api/v1/routes/${routeId}/segments/adopt-all`);
    return extractApiData(response);
  },

  adoptPoi: async (routeId, poiId) => {
    const response = await api.post(`/api/v1/routes/${routeId}/pois/${poiId}/adopt`);
    return extractApiData(response);
  },

  adoptAllPois: async (routeId) => {
    const response = await api.post(`/api/v1/routes/${routeId}/pois/adopt-all`);
    return extractApiData(response);
  },

  // 合并多个路段为一个
  mergeSegments: async (routeId, segmentIds, name = null) => {
    const response = await api.post(`/api/v1/routes/${routeId}/segments/merge`, {
      segment_ids: segmentIds,
      name,
    });
    return extractApiData(response);
  },

  // 路段改名
  renameSegment: async (routeId, segmentId, name) => {
    const response = await api.put(`/api/v1/routes/${routeId}/segments/${segmentId}/name`, { name });
    return extractApiData(response);
  },

  // POI 改名
  renamePoi: async (routeId, poiId, name) => {
    const response = await api.put(`/api/v1/routes/${routeId}/pois/${poiId}/name`, { name });
    return extractApiData(response);
  },

  // AI（LLM）筛选路线 POI，返回预览结果（保留/剔除+理由），不落库
  filterPoisPreview: async (routeId) => {
    const response = await api.post(
      '/api/v1/poi-library/filter-preview',
      { route_id: routeId },
      { timeout: 320000 }
    );
    return extractApiData(response);
  },

  // 把人工确认的 POI 存入全局库，并回写路线 POI 为已采纳
  savePoiLibrary: async (routeId, items) => {
    const response = await api.post(
      '/api/v1/poi-library/save',
      { route_id: routeId, items },
      { timeout: 30000 }
    );
    return extractApiData(response);
  },
};

// 全局 POI 库
export const poiLibraryApi = {
  list: async () => {
    const response = await api.get('/api/v1/poi-library');
    return extractApiData(response);
  },

  remove: async (id) => {
    const response = await api.delete(`/api/v1/poi-library/${id}`);
    return extractApiData(response);
  },
};

export const tripApi = {
  getTrips: async (page = 0, size = 10, keyword = null, status = null) => {
    const params = { page, size };
    if (keyword) params.keyword = keyword;
    if (status !== null) params.status = status;
    
    const response = await api.get('/api/v1/legacy/trips', { params });
    return extractApiData(response);
  },
  
  getTripById: async (id) => {
    const response = await api.get(`/api/v1/legacy/trips/${id}`);
    return extractApiData(response);
  },
  
  getTripStatistics: async () => {
    const response = await api.get('/api/v1/legacy/trips/statistics');
    return extractApiData(response);
  },
};

export const guideApi = {
  getGuides: async (page = 0, size = 10, tag = null) => {
    const params = { page, size };
    if (tag) params.tag = tag;
    
    const response = await api.get('/api/v1/guides', { params });
    return extractApiData(response);
  },
  
  getGuideById: async (id) => {
    const response = await api.get(`/api/v1/guides/${id}`);
    return extractApiData(response);
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
    const params = { page, size };
    if (keyword) params.keyword = keyword;
    if (category !== null) params.category = category;
    
    const response = await api.get('/api/v1/equipment/items', { params });
    return extractApiData(response);
  },
  
  getEquipmentItemById: async (id) => {
    const response = await api.get(`/api/v1/equipment/items/${id}`);
    return extractApiData(response);
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
    const response = await api.get('/api/v1/equipment/category-stats');
    return extractApiData(response);
  },
};

export const equipmentListApi = {
  getEquipmentLists: async (page = 0, size = 10, type = null, status = null) => {
    const params = { page, size };
    if (type !== null) params.type = type;
    if (status !== null) params.status = status;
    
    const response = await api.get('/api/v1/legacy/equipment-lists', { params });
    return extractApiData(response);
  },
  
  getEquipmentListById: async (id) => {
    const response = await api.get(`/api/v1/legacy/equipment-lists/${id}`);
    return extractApiData(response);
  },
  
  createEquipmentList: async (data) => {
    try {
      const response = await api.post('/api/v1/legacy/equipment-lists', data);
      return response.data;
    } catch (error) {
      console.error('创建装备清单失败:', error);
      throw error;
    }
  },
  
  updateEquipmentList: async (id, data) => {
    try {
      const response = await api.put(`/api/v1/legacy/equipment-lists/${id}`, data);
      return response.data;
    } catch (error) {
      console.error('更新装备清单失败:', error);
      throw error;
    }
  },
  
  deleteEquipmentList: async (id) => {
    try {
      const response = await api.delete(`/api/v1/legacy/equipment-lists/${id}`);
      return response.data;
    } catch (error) {
      console.error('删除装备清单失败:', error);
      throw error;
    }
  },
  
  getListItems: async (listId, page = 0, size = 20) => {
    const params = { page, size };
    const response = await api.get(`/api/v1/legacy/equipment-lists/${listId}/items`, { params });
    return extractApiData(response);
  },
  
  addItemToList: async (listId, data) => {
    try {
      const response = await api.post(`/api/v1/legacy/equipment-lists/${listId}/items`, data);
      return response.data;
    } catch (error) {
      console.error('添加装备到清单失败:', error);
      throw error;
    }
  },
  
  removeItemFromList: async (listId, itemId) => {
    try {
      const response = await api.delete(`/api/v1/legacy/equipment-lists/${listId}/items/${itemId}`);
      return response.data;
    } catch (error) {
      console.error('从清单移除装备失败:', error);
      throw error;
    }
  },
  
  getWeightStats: async (listId) => {
    const response = await api.get(`/api/v1/legacy/equipment-lists/${listId}/weight-stats`);
    return extractApiData(response);
  },
  
  updateListStatus: async (listId, status) => {
    try {
      const response = await api.patch(`/api/v1/legacy/equipment-lists/${listId}/status`, { status });
      return response.data;
    } catch (error) {
      console.error('更新清单状态失败:', error);
      throw error;
    }
  },
};

export const equipmentTemplateApi = {
  getTemplates: async (page = 0, size = 10, keyword = null, category = null, type = null, isOfficial = null) => {
    const params = { page, size };
    if (keyword) params.keyword = keyword;
    if (category !== null) params.category = category;
    if (type !== null) params.type = type;
    if (isOfficial !== null) params.isOfficial = isOfficial;
    
    const response = await api.get('/api/v1/equipment-templates', { params });
    return extractApiData(response);
  },
  
  getTemplateById: async (id) => {
    const response = await api.get(`/api/v1/equipment-templates/${id}`);
    return extractApiData(response);
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
    const params = { page, size };
    const response = await api.get('/api/v1/equipment-templates/official', { params });
    return extractApiData(response);
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

// 文件上传模式：直接传 KML 内容（优先级高于 URL）
if (data.kml_content) {
requestData.kml_content = data.kml_content;
}

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
