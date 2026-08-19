# Render 部署调研要点

调研日期：2026-08-19。

## Blueprint

Render Blueprint 使用仓库根目录的 `render.yaml`，可以声明一组相互连接的服务、PostgreSQL 数据库和环境变量组。服务类型包含 web service、private service 和 background worker；Blueprint 支持 Docker runtime、健康检查、磁盘、环境变量以及服务属性引用。

来源：[Blueprint YAML Reference](https://render.com/docs/blueprint-spec)

## 多服务架构

Render 的多服务架构支持把前端、后端、数据库等组件拆成独立服务，并通过环境变量和私有网络相互连接；可用基础设施即代码方式维护服务集合。

来源：[Multi-Service Architectures on Render](https://render.com/docs/multi-service-architecture)

## 对本项目的影响

本项目包含多个 Python Docker 服务、PostgreSQL、Redis、MongoDB、n8n、Metabase 和管理后台。Render 可以承载 Docker 微服务，但需要将仓库的 Compose 配置转换为 Render Blueprint；不能直接依赖沙盒中的主机网络方案。RAG 服务的机器学习依赖和管理后台需要单独评估资源与构建时间。闲鱼适配器可以先部署但不配置真实凭据。
