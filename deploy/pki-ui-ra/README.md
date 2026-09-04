# RA UI 部署基线

本目录是 FAW-VW RA 前端的唯一部署定义来源。不要使用仓库根目录旧的 `nginx.conf`；
它是历史通用配置，不能作为 `conf.d/default.conf` 使用。

## 当前 128 基线

| 项目 | 值 |
| --- | --- |
| UI 容器监听端口 | 80 |
| 宿主机访问端口 | 9083 |
| 网关容器/端口 | `pki-gateway:5555` |
| RA 容器/端口 | `pki-ra:5443` |
| Docker 网络 | `pki-cluster` |

网关请求经 `/api-gateway/` 转发；公网证书门户经
`/ra-public-cert-api/` 转发到 RA。生产构建使用相对路径，不依赖 Vite 的开发代理。

## 部署

```bash
cp deploy/pki-ui-ra/.env.example .env
docker compose build
docker compose up -d
```

如现场 Docker 网络名称不同，只修改 `.env` 中的 `DOCKER_NETWORK`；不要在 Nginx
配置里写死宿主机 IP 或任何账号、密码。
