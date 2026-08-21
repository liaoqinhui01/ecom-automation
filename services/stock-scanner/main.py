from __future__ import annotations

import os
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from pydantic import BaseModel, Field

from scanner import MarketDataError, fetch_daily, fetch_universe, scan_market, scan_one, Quote

app = FastAPI(
    title="博主日周月技术体系扫描服务",
    description="严格依据用户提供的博主资料进行日周月技术筛选；数据不足不作猜测。",
    version="1.0.0",
)


class ScanRequest(BaseModel):
    limit: Optional[int] = Field(default=None, ge=1, le=6000)
    max_workers: int = Field(default=8, ge=1, le=32)
    exclude_risk: bool = False


@app.get("/")
def root():
    return {"service": "stock-scanner", "status": "running", "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "stock-scanner"}


@app.get("/api/stocks/universe")
def universe():
    try:
        stocks = fetch_universe()
        return {"count": len(stocks), "stocks": [q.__dict__ for q in stocks]}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"获取A股股票池失败: {exc}") from exc


@app.get("/api/stocks/{code}")
def single_stock(code: str):
    code = code.strip()
    if len(code) != 6 or not code.isdigit():
        raise HTTPException(status_code=400, detail="股票代码必须是6位数字")
    market = "SZ" if code.startswith(("000", "001", "002", "003", "300")) else "SS"
    try:
        return scan_one(Quote(code=code, name=code, market=market, symbol=f"{code}.{market}"))
    except MarketDataError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/stocks/scan")
def scan(request: ScanRequest):
    try:
        return scan_market(limit=request.limit, max_workers=request.max_workers, exclude_risk=request.exclude_risk)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"全市场扫描失败: {exc}") from exc


@app.get("/api/stocks/rules")
def rules():
    return {
        "priority": ["monthly", "weekly", "daily"],
        "automatic_required": [
            "monthly_above_60m",
            "monthly_bull_alignment",
            "monthly_three_closes_above_5m",
            "weekly_bull_alignment",
            "daily_bull_alignment",
        ],
        "manual_or_insufficient": [
            "month_10_turn_up", "month_rounding_bottom", "month_box_breakout_retest",
            "weekly_box_retest", "weekly_double_bottom", "intraday_support",
            "chip_distribution", "daily_exit_threshold",
        ],
        "disclaimer": "只对明确、可计算条件自动判定；未定义阈值、分时、筹码和模糊图形返回insufficient。",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", "8010")))
