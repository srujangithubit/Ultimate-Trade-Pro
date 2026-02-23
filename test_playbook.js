const axios = require('axios');

async function login() {
    try {
        const response = await axios.post('http://localhost:3000/auth/login', {
            email: 'lingegowdan7@gmail.com',
            password: 'password123'
        });
        const token = response.data.accessToken;

        console.log('Got token:', token.substring(0, 20) + '...');

        try {
            const pbRes = await axios.post('http://localhost:3000/playbooks', {
                name: "Test Playbook",
                description: "Created via API test script",
                rules: ["Rule 1", "Rule 2"]
            }, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });
            console.log("Playbook created successfully:", pbRes.data);

            const listRes = await axios.get('http://localhost:3000/playbooks', {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Total playbooks:", listRes.data.length);
        } catch (err) {
            console.error('Playbook error:', err.response?.data || err.message);
        }
    } catch (err) {
        console.error('Login error:', err.response?.data || err.message);
    }
}
login();
