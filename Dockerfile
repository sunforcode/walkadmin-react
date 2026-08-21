# walkadmin-react 前端镜像
#
# 构建产物是纯静态文件，由 Nginx 提供服务，并由同一个 Nginx
# 反向代理后端接口。这样浏览器只与一个源通信：
# 前端产物中不含任何后端地址，同一份镜像可部署到任意环境。

# ---------- 构建阶段 ----------
FROM node:20-alpine AS builder

WORKDIR /build

# 先复制依赖清单，命中缓存后改代码无需重装依赖。
# 用 npm ci 而非 npm install：严格依据 lock 文件安装，保证可复现。
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# 不注入任何 VITE_API_BASE_URL：
# 让前端使用同源相对路径 /walkbg，由下面的 Nginx 转发。
# 一旦在构建时注入具体地址，就会被固化进 bundle，
# 换环境必须重新构建，违背「一次构建，多处部署」。
RUN npm run build

# ---------- 运行阶段 ----------
FROM nginx:1.27-alpine

# 移除默认站点配置，避免与自定义配置冲突
RUN rm -f /etc/nginx/conf.d/default.conf

COPY --from=builder /build/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/app.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
