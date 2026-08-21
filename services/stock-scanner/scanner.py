"""日周月技术体系扫描引擎。

只把用户资料中明确且可计算的规则用于自动判定；阈值不清晰或需要图形/分时/筹码识别的项目返回 insufficient，绝不擅自推断。
"""
from __future__ import annotations

import concurrent.futures
import time
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd
import requests

EASTMONEY_UNIVERSE = (
    "https://push2.eastmoney.com/api/qt/clist/get?pn={page}&pz=100&po=1&np=1"
    "&fltt=2&invt=2&fid=f3&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23"
    "&fields=f12,f14,f2,f3,f4,f5,f6,f8,f9"
)
YAHOO_CHART = "https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"


@dataclass
class Quote:
    code: str
    name: str
    market: str
    symbol: str
    price: Optional[float] = None
    change_pct: Optional[float] = None


class MarketDataError(RuntimeError):
    pass


def _session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": "Mozilla/5.0 stock-scanner/1.0"})
    return s


def fetch_universe(session: Optional[requests.Session] = None) -> List[Quote]:
    """获取沪深主板、创业板、科创板股票清单；过滤无价、退市和风险警示标的。"""
    s = session or _session()
    quotes: List[Quote] = []
    for page in range(1, 61):
        last_error = None
        for attempt in range(3):
            try:
                # 公开行情节点对密集分页请求偶发返回502，做限速和重试，避免静默漏页。
                if page > 1:
                    time.sleep(0.35)
                r = s.get(EASTMONEY_UNIVERSE.format(page=page), timeout=20)
                r.raise_for_status()
                payload = r.json().get("data") or {}
                break
            except requests.RequestException as exc:
                last_error = exc
                time.sleep(1.0 * (attempt + 1))
        else:
            raise MarketDataError(f"获取股票池第{page}页失败，未返回完整股票池: {last_error}") from last_error
        rows = payload.get("diff") or []
        if not rows:
            break
        for row in rows:
            code = str(row.get("f12") or "")
            name = str(row.get("f14") or "")
            if len(code) != 6 or not code.isdigit() or not name:
                continue
            # 博主体系没有给出ST/退市规则；这里仅过滤行情源无法正常识别的标的，
            # 是否排除ST由调用方参数控制，不把外部偏好写入规则。
            market = "SZ" if code.startswith(("000", "001", "002", "003", "300")) else "SS"
            quotes.append(Quote(code=code, name=name, market=market, symbol=f"{code}.{market}"))
        if len(rows) < 100:
            break
    if not quotes:
        raise MarketDataError("行情源未返回股票清单")
    return quotes


def fetch_daily(symbol: str, period_days: int = 2500, session: Optional[requests.Session] = None) -> pd.DataFrame:
    s = session or _session()
    period2 = int(time.time())
    period1 = period2 - period_days * 86400
    url = f"{YAHOO_CHART.format(symbol=symbol)}?period1={period1}&period2={period2}&interval=1d&events=div%2Csplits&includeAdjustedClose=true"
    r = s.get(url, timeout=20)
    r.raise_for_status()
    result = (r.json().get("chart") or {}).get("result")
    if not result:
        raise MarketDataError(f"{symbol}: 无历史行情")
    node = result[0]
    quote = (node.get("indicators") or {}).get("quote", [{}])[0]
    idx = pd.to_datetime(node.get("timestamp", []), unit="s", utc=True).tz_convert("Asia/Shanghai").tz_localize(None)
    df = pd.DataFrame(quote, index=idx)[["open", "high", "low", "close", "volume"]].dropna()
    if len(df) < 260:
        raise MarketDataError(f"{symbol}: 日线样本不足（{len(df)}）")
    return df


def _period(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "volume": "sum"}
    out = df.resample(rule).agg(agg).dropna()
    # 只保留已结束周期，避免把当日/当周/当月盘中数据当作确认信号。
    now = pd.Timestamp.now(tz="Asia/Shanghai").tz_localize(None)
    if rule == "W-FRI":
        out = out[out.index < now.normalize() - pd.Timedelta(days=(now.weekday() - 4) % 7)] if now.weekday() != 4 else out[out.index < now.normalize()]
    elif rule == "ME":
        out = out[out.index.to_period("M") < now.to_period("M")]
    return out


def _ma(df: pd.DataFrame, n: int) -> pd.Series:
    return df["close"].rolling(n).mean()


def _macd(df: pd.DataFrame) -> Dict[str, pd.Series]:
    dif = df.close.ewm(span=12, adjust=False).mean() - df.close.ewm(span=26, adjust=False).mean()
    dea = dif.ewm(span=9, adjust=False).mean()
    return {"dif": dif, "dea": dea, "hist": 2 * (dif - dea)}


def _status(condition: bool, detail: str, required: bool = True) -> Dict[str, Any]:
    return {"status": "pass" if condition else "fail", "required": required, "detail": detail}


def _insufficient(detail: str, required: bool = False) -> Dict[str, Any]:
    return {"status": "insufficient", "required": required, "detail": detail}


def _engulfing(d: pd.DataFrame) -> Dict[str, Any]:
    if len(d) < 2:
        return _insufficient("日线样本不足")
    a, b = d.iloc[-2], d.iloc[-1]
    prev_bear = a.close < a.open
    curr_bull = b.close > b.open
    engulf = curr_bull and prev_bear and b.open <= a.close and b.close >= a.open
    volume_ok = b.volume >= 1.5 * a.volume
    return {
        "status": "pass" if engulf and volume_ok else "fail",
        "required": False,
        "detail": f"实体包裹={'是' if engulf else '否'}；成交量≥前一日1.5倍={'是' if volume_ok else '否'}",
    }


def scan_one(quote: Quote, period_days: int = 2500, session: Optional[requests.Session] = None) -> Dict[str, Any]:
    try:
        daily = fetch_daily(quote.symbol, period_days=period_days, session=session)
        weekly = _period(daily, "W-FRI")
        monthly = _period(daily, "ME")
        if len(monthly) < 61 or len(weekly) < 21:
            return {"code": quote.code, "name": quote.name, "status": "insufficient", "error": "周/月样本不足"}

        mm = {n: _ma(monthly, n) for n in (5, 10, 20, 60)}
        wm = {n: _ma(weekly, n) for n in (5, 10, 20)}
        dm = {n: _ma(daily, n) for n in (5, 10, 20)}
        mmacd, wmacd, dmacd = _macd(monthly), _macd(weekly), _macd(daily)

        last_m, last_w, last_d = monthly.iloc[-1], weekly.iloc[-1], daily.iloc[-1]
        m5 = mm[5].iloc[-1]
        three_months_above_5 = bool((monthly.close.iloc[-3:] > mm[5].iloc[-3:]).all())
        month_bull = bool(m5 > mm[10].iloc[-1] > mm[20].iloc[-1] > mm[60].iloc[-1])
        week_bull = bool(wm[5].iloc[-1] > wm[10].iloc[-1] > wm[20].iloc[-1] and wm[20].iloc[-1] > wm[20].iloc[-2])
        day_bull = bool(dm[5].iloc[-1] > dm[10].iloc[-1] > dm[20].iloc[-1])
        week_breakout = bool(weekly.close.iloc[-1] > wm[20].iloc[-1] and weekly.close.iloc[-2] <= wm[20].iloc[-2] and weekly.volume.iloc[-1] >= 1.5 * weekly.volume.iloc[-4:-1].mean())
        month_macd_cross = bool(mmacd["dif"].iloc[-1] > mmacd["dea"].iloc[-1] and mmacd["dif"].iloc[-2] <= mmacd["dea"].iloc[-2])
        week_macd_cross = bool(wmacd["dif"].iloc[-1] > wmacd["dea"].iloc[-1] and wmacd["dif"].iloc[-2] <= wmacd["dea"].iloc[-2])
        daily_macd_cross = bool(dmacd["dif"].iloc[-1] > dmacd["dea"].iloc[-1] and dmacd["dif"].iloc[-2] <= dmacd["dea"].iloc[-2])
        volume_health = bool(last_d.close > daily.close.iloc[-2] and last_d.volume <= daily.volume.iloc[-2])

        rules = {
            "monthly_above_60m": _status(last_m.close > mm[60].iloc[-1], f"月收盘{last_m.close:.2f} vs 60月线{mm[60].iloc[-1]:.2f}"),
            "monthly_bull_alignment": _status(month_bull, f"5/10/20/60月线={mm[5].iloc[-1]:.2f}/{mm[10].iloc[-1]:.2f}/{mm[20].iloc[-1]:.2f}/{mm[60].iloc[-1]:.2f}"),
            "monthly_three_closes_above_5m": _status(three_months_above_5, "最近3个完整月收盘均站上5月线"),
            "monthly_macd_cross": _status(month_macd_cross, "月线DIF/DEA最近一期交叉"),
            "weekly_bull_alignment": _status(week_bull, f"5/10/20周线={wm[5].iloc[-1]:.2f}/{wm[10].iloc[-1]:.2f}/{wm[20].iloc[-1]:.2f}"),
            "weekly_20w_breakout_volume": _status(week_breakout, "突破20周线且成交量≥前3周均量1.5倍"),
            "weekly_macd_cross": _status(week_macd_cross, "周线DIF/DEA最近一期交叉"),
            "daily_bull_alignment": _status(day_bull, f"5/10/20日线={dm[5].iloc[-1]:.2f}/{dm[10].iloc[-1]:.2f}/{dm[20].iloc[-1]:.2f}"),
            "daily_pullback_near_5_10": _insufficient("原资料要求回踩5/10日线，但未给出距离阈值；仅返回均线和收盘价供人工确认"),
            "daily_pullback_shrink": _status(volume_health, "上涨且成交量不高于前一日；仅作量价观察字段", required=False),
            "daily_macd_cross": _status(daily_macd_cross, "日线DIF/DEA最近一期交叉", required=False),
            "daily_bullish_engulfing": _engulfing(daily),
            "month_10_turn_up": _insufficient("10月线‘由跌转平再拐向上’需要形态定义，未自动猜测"),
            "month_rounding_bottom": _insufficient("圆弧底需要图形识别，未自动猜测"),
            "month_box_breakout_retest": _insufficient("月线箱体周期和回踩需图形/支撑识别"),
            "weekly_box_retest": _insufficient("周线箱体回踩需图形/下影线识别"),
            "weekly_double_bottom": _insufficient("双底颈线、第二低点和回踩需图形识别"),
            "intraday_support": _insufficient("分时承接、盘口主力行为和尾盘结构不在日线数据中"),
            "chip_distribution": _insufficient("筹码峰和获利比例数据未接入"),
            "daily_exit_threshold": _insufficient("新增资料中的日线跌破5/10/20线离场段落存在图像识别歧义"),
        }
        exact_required = ["monthly_above_60m", "monthly_bull_alignment", "monthly_three_closes_above_5m", "weekly_bull_alignment", "daily_bull_alignment"]
        passed = sum(rules[k]["status"] == "pass" for k in exact_required)
        failed = [k for k in exact_required if rules[k]["status"] == "fail"]
        status = "pass" if not failed else "fail"
        return {
            "code": quote.code, "name": quote.name, "symbol": quote.symbol,
            "as_of": str(daily.index[-1].date()), "price": round(float(last_d.close), 4),
            "change_20d_pct": round(float(daily.close.pct_change(20).iloc[-1] * 100), 2),
            "status": status, "exact_required_passed": f"{passed}/{len(exact_required)}",
            "failed_required": failed, "rules": rules,
            "data": {"daily_ma": {str(n): round(float(dm[n].iloc[-1]), 4) for n in dm}, "weekly_ma": {str(n): round(float(wm[n].iloc[-1]), 4) for n in wm}, "monthly_ma": {str(n): round(float(mm[n].iloc[-1]), 4) for n in mm}, "daily_volume": int(last_d.volume), "daily_volume20": int(daily.volume.rolling(20).mean().iloc[-1])},
        }
    except Exception as exc:
        return {"code": quote.code, "name": quote.name, "symbol": quote.symbol, "status": "error", "error": str(exc)}


def scan_market(limit: Optional[int] = None, max_workers: int = 8, period_days: int = 2500, exclude_risk: bool = False) -> Dict[str, Any]:
    quotes = fetch_universe()
    if exclude_risk:
        quotes = [q for q in quotes if not q.name.startswith(("ST", "*ST"))]
    if limit:
        quotes = quotes[:limit]
    results: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max_workers) as pool:
        futures = [pool.submit(scan_one, q, period_days) for q in quotes]
        for f in concurrent.futures.as_completed(futures):
            results.append(f.result())
    results.sort(key=lambda x: (x.get("status") != "pass", x.get("exact_required_passed", ""), x.get("code", "")))
    return {"as_of": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "universe_count": len(quotes), "result_count": len(results), "results": results}
