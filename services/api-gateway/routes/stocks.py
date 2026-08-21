"""股票日周月扫描服务代理。"""
import os
from utils.proxy import create_proxy_router, resolve_service_url

router = create_proxy_router(
    target_base=resolve_service_url("STOCK_SCANNER_URL", "http://stock-scanner:8010/api/stocks"),
    service_name="stock-scanner",
    timeout=180.0,
)
