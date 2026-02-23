async function testBackend() {
    const baseUrl = 'http://127.0.0.1:3000';

    try {
        // 1. Login
        console.log('Logging in...');
        const email = `test.setup.tpb.${Date.now()}@example.com`;
        const password = 'Password@123';

        // Register first
        const registerRes = await fetch(`${baseUrl}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                password,
                firstName: 'Test',
                lastName: 'User'
            })
        });

        if (!registerRes.ok) {
            console.log('Register failed, trying login...');
            // If register fails (e.g. user exists), try login
            const loginRes = await fetch(`${baseUrl}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            if (!loginRes.ok) {
                const errText = await loginRes.text();
                throw new Error(`Login failed: ${loginRes.status} ${errText}`);
            }
            const loginData = await loginRes.json();
            var token = loginData.accessToken || loginData.token;
        } else {
            const registerData = await registerRes.json();
            var token = registerData.accessToken || registerData.token;
        }

        console.log('Got token:', token ? 'Yes' : 'No');

        // 2. Create trade
        console.log('Creating trade with Setup="TPB_Setup"...');
        const tradePayload = {
            instrument: 'AAPL', // TPB uses instrument, not symbol
            direction: 'long', // TPB uses lowercase enum
            entryPrice: 150,
            quantity: 10,
            entryDatetime: new Date().toISOString(), // TPB uses entryDatetime
            setup: 'TPB_Setup'
        };

        const createRes = await fetch(`${baseUrl}/trades`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(tradePayload)
        });

        if (!createRes.ok) {
            const errText = await createRes.text();
            throw new Error(`Create failed: ${createRes.status} ${errText}`);
        }

        const createData = await createRes.json();
        console.log('Create Response Body:', JSON.stringify(createData, null, 2));

        if (createData.setup === 'TPB_Setup') {
            console.log('SUCCESS: Setup field returned in create response.');
        } else {
            console.log('FAILURE: Setup field MISSING or wrong in create response.');
        }

        // 3. List trades
        const listRes = await fetch(`${baseUrl}/trades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const listData = await listRes.json();
        // TPB findAll returns { trades: [], total: ... } or just []?
        // TradesService says: return { trades, total, ... }

        const trades = Array.isArray(listData) ? listData : listData.trades;

        const foundTrade = trades.find(t => t.id === createData.id);

        if (foundTrade && foundTrade.setup === 'TPB_Setup') {
            console.log('SUCCESS: Setup field persisted and returned in list.');
        } else {
            console.log('FAILURE: Setup field MISSING in list response.', foundTrade);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testBackend();
