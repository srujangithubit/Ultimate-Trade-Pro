import asyncio, websockets, json

async def test():
    async with websockets.connect("ws://localhost:8765") as ws:
        await ws.send(json.dumps({"action": "ohlcv", "symbol": "XAUUSD", "timeframe": "M5", "bars": 3}))
        resp = await asyncio.wait_for(ws.recv(), timeout=10)
        data = json.loads(resp)
        print("Type:", data.get("type"))
        print("Data count:", len(data.get("data", [])))
        if data.get("data"):
            print("First:", data["data"][0])

asyncio.run(test())
