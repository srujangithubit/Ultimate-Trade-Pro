const { exec } = require('child_process');

exec('docker logs trading-api | grep -A 20 "Error creating playbook"', (error, stdout, stderr) => {
    console.log("--- STDOUT ---");
    console.log(stdout);
});
