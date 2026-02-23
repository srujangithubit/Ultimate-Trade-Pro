const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'components', 'analytics');

try {
    const files = fs.readdirSync(dir);

    files.forEach(file => {
        if (!file.endsWith('.tsx')) return;

        const p = path.join(dir, file);
        let content = fs.readFileSync(p, 'utf8');

        // Use a global regex replacement for exact 100% 100% matches
        if (content.includes('<ResponsiveContainer width="100%" height="100%">')) {
            content = content.replace(/<ResponsiveContainer width="100%" height="100%">/g, '<ResponsiveContainer width="100%" height="100%" minHeight={300}>');
            fs.writeFileSync(p, content);
            console.log('Updated ' + file);
        }
    });
} catch (e) {
    console.error('Error', e);
}
