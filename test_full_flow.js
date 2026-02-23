const fs = require('fs');

const BASE_URL = 'http://localhost:3000';
const LOG_FILE = 'result.json';

const log = (msg) => {
    fs.appendFileSync(LOG_FILE, msg + '\n');
}

async function run() {
    fs.writeFileSync(LOG_FILE, ''); // Clear
    const id = Date.now();
    const email = `user_lg_${id}@example.com`;
    const password = 'StrongPass123!';

    log(`--- Starting Test for ${email} ---`);

    // 1. Register
    try {
        const payload = { email, password };
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const text = await res.text();
        log(`[Register] Status: ${res.status}`);

        if (!res.ok) {
            log(`[Register] Failed body: ${text}`);
            throw new Error(`Register failed`);
        }

        const data = JSON.parse(text);
        log(`[Register] Success. Token: ${data.accessToken.substring(0, 10)}...`);
        var token = data.accessToken;
    } catch (err) {
        log(`[Register] Error: ${err.message}`);
        return;
    }

    // 2. Create Trade
    try {
        const trade = {
            symbol: 'AAPL',
            direction: 'LONG',
            entryPrice: 150.50,
            quantity: 10,
            entryDate: new Date().toISOString()
        };

        const res = await fetch(`${BASE_URL}/trades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(trade)
        });

        const text = await res.text();
        log(`[Trade] Status: ${res.status}`);

        if (!res.ok) {
            log(`[Trade] Failed body: ${text}`);
            throw new Error(`Trade failed`);
        } else {
            const data = JSON.parse(text);
            log(`[Trade] Success. ID: ${data.id}`);
        }

    } catch (err) {
        log(`[Trade] Error: ${err.message}`);
    }
}

run();
