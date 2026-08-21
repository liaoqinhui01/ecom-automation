"""
Hermes 多平台电商自动化系统 - API网关
统一入口，提供鉴权、路由转发、错误处理、请求追踪

服务路由映射:
  /api/auth        → 本地 OAuth 鉴权
  /api/shops        → 本地店铺管理（内存+未来接数据库）
  /api/products     → product-service:8006
  /api/customers    → product-service:8006
  /api/orders       → oms-service:8005
  /api/inventory    → oms-service:8005
  /api/tickets      → oms-service:8005
  /api/dashboard    → oms-service:8005
  /api/messages     → 本地客服消息（内存）
  /api/aftersales   → 本地售后服务（内存）
  /api/competitors  → 本地竞品分析（内存）
  /api/reports      → 本地报表统计（内存）
  /api/settings     → 本地系统设置（JSON文件）
"""
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn
from loguru import logger
import os
from dotenv import load_dotenv

# 加载环境变量
load_dotenv()

# 导入路由
from routes import shops, products, orders, messages, aftersales, competitors, reports, dashboard, settings, inventory, tickets, customers, stocks
from routes.auth import oauth

# 导入统一错误处理和中间件
from utils.errors import setup_error_handlers
from utils.middleware import request_tracking_middleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    logger.info("🚀 API网关启动中...")
    logger.info("📦 服务路由映射已加载:")
    logger.info("   /api/products   → product-service:8006")
    logger.info("   /api/customers  → product-service:8006")
    logger.info("   /api/orders     → oms-service:8005")
    logger.info("   /api/inventory  → oms-service:8005")
    logger.info("   /api/tickets    → oms-service:8005")
    logger.info("   /api/dashboard  → oms-service:8005")
    logger.info("   /api/stocks     → stock-scanner:8010")
    yield
    logger.info("🛑 API网关关闭")


# 创建FastAPI应用
app = FastAPI(
    title="Hermes 电商自动化 API",
    description="多平台电商自动化系统统一API网关",
    version="1.2.0",
    lifespan=lifespan,
)

# ============================================================
# CORS配置 — 支持跨域前端调用
# ============================================================
_cors_origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID", "X-Total-Count"],
)

# 请求追踪中间件（包含日志和 request_id 注入）
app.middleware("http")(request_tracking_middleware)

# ============================================================
# 注册统一异常处理器
# ============================================================
setup_error_handlers(app)

# ============================================================
# 注册路由
# ============================================================

# 本地路由（网关自身处理）
app.include_router(oauth.router, prefix="/api/auth", tags=["统一鉴权管理"])
app.include_router(shops.router, prefix="/api/shops", tags=["店铺管理"])
app.include_router(messages.router, prefix="/api/messages", tags=["客服消息"])
app.include_router(aftersales.router, prefix="/api/aftersales", tags=["售后服务"])
app.include_router(competitors.router, prefix="/api/competitors", tags=["竞品分析"])
app.include_router(reports.router, prefix="/api/reports", tags=["报表统计"])
app.include_router(settings.router, prefix="/api/settings", tags=["系统设置"])
app.include_router(stocks.router, prefix="/api/stocks", tags=["日周月全市场扫描"])

# 代理路由 → 转发到后端微服务
app.include_router(products.router, prefix="/api/products", tags=["商品管理 (→product-service)"])
app.include_router(customers.router, prefix="/api/customers", tags=["客户管理 (→product-service)"])
app.include_router(orders.router, prefix="/api/orders", tags=["订单管理 (→oms-service)"])
app.include_router(inventory.router, prefix="/api/inventory", tags=["库存管理 (→oms-service)"])
app.include_router(tickets.router, prefix="/api/tickets", tags=["工单管理 (→oms-service)"])
app.include_router(dashboard.router, prefix="/api/dashboard", tags=["运营看板 (→oms-service)"])


# ============================================================
# 健康检查 & 根路径 & 服务发现
# ============================================================
@app.get("/")
async def root():
    return {
        "service": "ecom-api-gateway",
        "version": "1.2.0",
        "status": "running",
        "routes": {
            "auth": "/api/auth",
            "shops": "/api/shops",
            "products": "/api/products → product-service:8006",
            "customers": "/api/customers → product-service:8006",
            "orders": "/api/orders → oms-service:8005",
            "inventory": "/api/inventory → oms-service:8005",
            "tickets": "/api/tickets → oms-service:8005",
            "dashboard": "/api/dashboard → oms-service:8005",
            "messages": "/api/messages",
            "aftersales": "/api/aftersales",
            "competitors": "/api/competitors",
            "reports": "/api/reports",
            "settings": "/api/settings",
            "stocks": "/api/stocks",
        },
    }


@app.get("/health")
async def health_check():
    """健康检查 — 同时探测下游服务可达性"""
    import httpx

    downstream = {}
    services = {
        "product-service": os.getenv("PRODUCT_SERVICE_URL", "http://product-service:8006") + "/health",
        "oms-service": os.getenv("OMS_SERVICE_URL", "http://oms-service:8005").replace("/api/orders", "") + "/health",
    }
    async with httpx.AsyncClient(timeout=3.0) as client:
        for name, url in services.items():
            try:
                resp = await client.get(url)
                downstream[name] = "healthy" if resp.status_code == 200 else f"error({resp.status_code})"
            except Exception:
                downstream[name] = "unreachable"

    return {
        "status": "healthy",
        "service": "ecom-api-gateway",
        "version": "1.2.0",
        "downstream": downstream,
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
