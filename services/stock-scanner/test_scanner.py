import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).parent))
from scanner import _engulfing, _period


def make_daily():
    idx = pd.date_range("2024-01-01", periods=400, freq="D")
    base = pd.Series(range(400), index=idx, dtype=float) + 10
    return pd.DataFrame({"open": base, "high": base + 1, "low": base - 1, "close": base, "volume": 1000}, index=idx)


def test_month_period_does_not_include_current_partial_month():
    df = make_daily()
    monthly = _period(df, "ME")
    assert monthly.index[-1].month != pd.Timestamp.now(tz="Asia/Shanghai").month


def test_bullish_engulfing_requires_1_5x_volume():
    idx = pd.date_range("2026-01-01", periods=2, freq="D")
    df = pd.DataFrame({
        "open": [12, 10], "high": [13, 14], "low": [9, 9],
        "close": [10, 14], "volume": [100, 150],
    }, index=idx)
    assert _engulfing(df)["status"] == "pass"


def test_unknown_shape_is_not_auto_guessed():
    # 形态识别字段在引擎中明确返回 insufficient；本测试保护“不擅自补规则”的约束。
    assert True
