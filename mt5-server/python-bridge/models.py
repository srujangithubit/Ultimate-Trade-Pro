"""
Models - Data models for MT5 module.
"""

from dataclasses import dataclass, asdict
from typing import Optional


@dataclass
class AccountInfo:
    """MT5 trading account information."""
    login: int
    server: str
    balance: float
    equity: float
    margin: float
    free_margin: float
    leverage: int
    currency: str
    name: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class TradePosition:
    """An open trade position."""
    ticket: int
    symbol: str
    type: int  # 0 = BUY, 1 = SELL
    volume: float
    price_open: float
    price_current: float
    profit: float
    swap: float
    sl: float
    tp: float
    time: int
    magic: int
    comment: str

    @property
    def type_str(self) -> str:
        return "BUY" if self.type == 0 else "SELL"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["type_str"] = self.type_str
        return d


@dataclass
class TradeOrder:
    """A pending trade order."""
    ticket: int
    symbol: str
    type: int
    volume: float
    price: float
    sl: float
    tp: float
    time_setup: int
    magic: int
    comment: str

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class SymbolInfo:
    """Symbol/instrument information."""
    name: str
    bid: float
    ask: float
    spread: int
    digits: int
    volume_min: float
    volume_max: float
    volume_step: float
    description: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class TradeHistoryDeal:
    """A completed (closed) trade from account history."""
    ticket: int
    order: int
    symbol: str
    type: int  # 0 = BUY, 1 = SELL
    volume: float
    price: float
    profit: float
    swap: float
    commission: float
    fee: float
    time: int  # unix timestamp
    comment: str
    magic: int
    entry: int  # 0 = IN, 1 = OUT, 2 = INOUT, 3 = OUT_BY

    @property
    def type_str(self) -> str:
        return "BUY" if self.type == 0 else "SELL"

    @property
    def entry_str(self) -> str:
        mapping = {0: "IN", 1: "OUT", 2: "INOUT", 3: "OUT_BY"}
        return mapping.get(self.entry, "UNKNOWN")

    def to_dict(self) -> dict:
        d = asdict(self)
        d["type_str"] = self.type_str
        d["entry_str"] = self.entry_str
        return d


@dataclass
class ClosedTrade:
    """A matched entry+exit trade pair."""
    ticket_in: int
    ticket_out: int
    symbol: str
    type: str  # "BUY" or "SELL"
    volume: float
    entry_price: float
    exit_price: float
    entry_time: int  # unix timestamp
    exit_time: int   # unix timestamp
    profit: float
    swap: float
    commission: float
    fee: float
    comment: str
    magic: int

    def to_dict(self) -> dict:
        return asdict(self)
