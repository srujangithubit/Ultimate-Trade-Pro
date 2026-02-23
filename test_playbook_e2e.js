const axios = require('axios');

async function runTest() {
    try {
        const timestamp = Date.now();
        const email = `testuser_${timestamp}@example.com`;
        const password = 'Password123!';

        console.log(`Registering new user: ${email}`);
        await axios.post('http://localhost:3000/auth/register', {
            email,
            password,
            firstName: 'Test',
            lastName: 'User'
        });

        console.log('Logging in...');
        const response = await axios.post('http://localhost:3000/auth/login', {
            email,
            password
        });
        const token = response.data.accessToken;
        console.log('Got token:', token.substring(0, 20) + '...');

        console.log('Creating playbook...');
        const pbRes = await axios.post('http://localhost:3000/playbooks', {
            name: "Test Playbook",
            description: "Created via API test script",
            rules: ["Rule 1", "Rule 2"]
        }, {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log("Playbook created successfully:", pbRes.data);

        const listRes = await axios.get('http://localhost:3000/playbooks', {
            headers: { Authorization: `Bearer ${token}` }
        });
        console.log(`Total playbooks for user: ${listRes.data.length}`);
    } catch (err) {
        console.error('Error occurred:', err.response?.data || err.message);
    }
}
runTest();
