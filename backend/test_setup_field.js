async function testBackend() {
    const baseUrl = 'http://localhost:3000';

    try {
        // 1. Login
        console.log('Logging in...');
        const email = `test.setup.${Date.now()}@example.com`;
        const password = 'Password@123';

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
            throw new Error(`Register failed: ${registerRes.status} ${registerRes.statusText}`);
        }

        const registerData = await registerRes.json();
        const token = registerData.accessToken;
        console.log('Got token:', token ? 'Yes' : 'No');

        // 2. Create trade
        console.log('Creating trade with Setup="TestSetup"...');
        const tradePayload = {
            symbol: 'AAPL',
            direction: 'LONG',
            entryPrice: 150,
            quantity: 10,
            entryDate: new Date().toISOString(),
            setup: 'TestSetup'
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

        if (createData.setup === 'TestSetup') {
            console.log('SUCCESS: Setup field returned in create response.');
        } else {
            console.log('FAILURE: Setup field MISSING or wrong in create response.');
        }

        // 3. List trades
        const listRes = await fetch(`${baseUrl}/trades`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const listData = await listRes.json();
        const foundTrade = listData.find(t => t.id === createData.id);

        if (foundTrade && foundTrade.setup === 'TestSetup') {
            console.log('SUCCESS: Setup field persisted and returned in list.');
        } else {
            console.log('FAILURE: Setup field MISSING in list response.', foundTrade);
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
}

testBackend();
