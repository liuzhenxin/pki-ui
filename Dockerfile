# ============================================
# Stage 1: 构建阶段
# ============================================
FROM node:18-alpine AS builder

WORKDIR /app

# 安装 yarn
RUN corepack enable && corepack prepare yarn@1.22.19 --activate

# 复制依赖文件
COPY package.json yarn.lock ./

# 安装依赖（使用国内镜像加速）
RUN yarn install --frozen-lockfile --registry=https://registry.npmmirror.com

# 复制源码和构建配置
COPY . .

# 生产构建
RUN yarn build:prod

# ============================================
# Stage 2: 运行阶段
# ============================================
FROM nginx:alpine

# 时区设置
RUN apk add --no-cache tzdata && \
    cp /usr/share/zoneinfo/Asia/Shanghai /etc/localtime && \
    echo "Asia/Shanghai" > /etc/timezone && \
    apk del tzdata

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置
COPY nginx.conf /etc/nginx/conf.d/default.conf

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
