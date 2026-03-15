"""
Data Fetcher - Retrieves market data from MetaTrader 5.
"""

import MetaTrader5 as mt5
import pandas as pd
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

TIMEFRAME_MAP = {
    "M1": mt5.TIMEFRAME_M1,
    "M5": mt5.TIMEFRAME_M5,
    "M15": mt5.TIMEFRAME_M15,
    "M30": mt5.TIMEFRAME_M30,
    "H1": mt5.TIMEFRAME_H1,
    "H4": mt5.TIMEFRAME_H4,
    "D1": mt5.TIMEFRAME_D1,
    "W1": mt5.TIMEFRAME_W1,
    "MN1": mt5.TIMEFRAME_MN1,
}


def _ensure_mt5_initialized() -> bool:
    """Ensure the MT5 module is initialized. Re-initialize if needed."""
    info = mt5.terminal_info()
    if info is not None:
        return True
    logger.warning("MT5 not initialized, attempting to initialize...")
    if mt5.initialize():
        logger.info("MT5 re-initialized successfully")
        return True
    logger.error("MT5 initialization failed: %s", mt5.last_error())
    return False


def get_ohlcv(symbol: str, timeframe: str, bars: int = 100) -> list[dict]:
    """Fetch OHLCV candle data for a given symbol and timeframe."""
    if not _ensure_mt5_initialized():
        return []

    tf = TIMEFRAME_MAP.get(timeframe)
    if tf is None:
        logger.error("Invalid timeframe: %s", timeframe)
        return []

    rates = mt5.copy_rates_from_pos(symbol, tf, 0, bars)
    if rates is None or len(rates) == 0:
        logger.warning("No data returned for %s %s", symbol, timeframe)
        return []

    df = pd.DataFrame(rates)
    df["time"] = pd.to_datetime(df["time"], unit="s")

    return df[["time", "open", "high", "low", "close", "tick_volume"]].to_dict(
        orient="records"
    )


def get_ticks(symbol: str, count: int = 100) -> list[dict]:
    """Fetch recent ticks for a symbol."""
    if not _ensure_mt5_initialized():
        return []

    ticks = mt5.copy_ticks_from(
        symbol, datetime.now() - timedelta(minutes=5), count, mt5.COPY_TICKS_ALL
    )
    if ticks is None or len(ticks) == 0:
        return []

    df = pd.DataFrame(ticks)
    df["time"] = pd.to_datetime(df["time"], unit="s")

    return df[["time", "bid", "ask", "last", "volume"]].to_dict(orient="records")


def get_latest_tick(symbol: str) -> dict | None:
    """Get the latest tick for a symbol using symbol_info_tick (real-time)."""
    if not _ensure_mt5_initialized():
        return None

    tick = mt5.symbol_info_tick(symbol)
    if tick is None:
        return None
    return {
        "time": datetime.fromtimestamp(tick.time).isoformat(),
        "bid": tick.bid,
        "ask": tick.ask,
        "last": tick.last,
        "volume": tick.volume,
    }


def get_symbols(group: str = "*") -> list[str]:
    """Get available symbol names, optionally filtered by group pattern."""
    symbols = mt5.symbols_get(group=group)
    if symbols is None:
        return []
    return [s.name for s in symbols]


def get_market_depth(symbol: str) -> dict | None:
    """Subscribe to and fetch market depth (DOM) for a symbol."""
    if not mt5.market_book_add(symbol):
        logger.error("Failed to subscribe to market depth for %s", symbol)
        return None

    book = mt5.market_book_get(symbol)
    if book is None:
        return None

    return {
        "symbol": symbol,
        "entries": [
            {"type": item.type, "price": item.price, "volume": item.volume}
            for item in book
        ],
    }
