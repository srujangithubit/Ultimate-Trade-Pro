# TradePro — Oracle Cloud Free Tier Deployment Roadmap

> **Cost: $0/month** | Oracle Cloud Always Free Tier  
> **Architecture:** Next.js + NestJS + PostgreSQL + Redis + MT5 on a single ARM VM

---

## What You Get (Always Free, Never Charged)

| Resource               | Spec                        | Used For                     |
|------------------------|-----------------------------|------------------------------|
| **2x AMD VM**          | 1 OCPU, 1GB RAM each        | NestJS backend + MT5 server  |
| **1x ARM VM**          | 4 OCPU, 24GB RAM            | All services (recommended)   |
| **2x Block Volume**    | 200GB total                  | Storage                      |
| **Autonomous DB**      | 20GB                         | PostgreSQL (or self-hosted)  |
| **10TB/month**         | Outbound bandwidth           | More than enough             |

---

## Final Architecture

```
                    ┌──────────────────────────────────┐
                    │  Oracle Cloud VM (Always Free)    │
                    │  Ubuntu 22.04 — 2 OCPU, 12GB RAM │
                    │                                   │
  yourdomain.com ──→│  Nginx (SSL) ──→ Next.js (:3002) │
api.yourdomain.com→│  Nginx (SSL) ──→ NestJS  (:3000) │
mt5.yourdomain.com→│  Nginx (SSL) ──→ MT5 Node(:3001) │
                    │                                   │
                    │  PostgreSQL 16 (Docker)           │
                    │  Redis 7 (Docker)                 │
                    │  PM2 Process Manager              │
                    └──────────────┬────────────────────┘
                                   │ SSH Tunnel / Cloudflare
                    ┌──────────────┴────────────────────┐
                    │  Your Windows PC                   │
                    │  MT5 Terminal + Python Bridge       │
                    └────────────────────────────────────┘
```

---

## Phase 1: Oracle Cloud Setup (30 min)

### Step 1 — Create Oracle Cloud Account

1. Go to [cloud.oracle.com/free](https://www.oracle.com/cloud/free/)
2. Sign up (credit card for verification only — you won't be charged)
3. Select **Home Region** closest to you (e.g., `ap-mumbai-1` for India)
4. Wait for account provisioning (~5 min)

### Step 2 — Create a VM Instance

1. Go to **Compute → Instances → Create Instance**
2. Configuration:
   - **Shape:** `VM.Standard.A1.Flex` (ARM — always free)
   - **OCPU:** 2, **RAM:** 12GB (leave remaining for a second VM if needed)
   - **OS:** Ubuntu 22.04
   - **Boot Volume:** 100GB
3. **Download the SSH key pair** (save it safely)
4. Click **Create**

### Step 3 — Open Firewall Ports

1. Go to **Networking → Virtual Cloud Networks → your VCN → Security Lists → Default**
2. Add **Ingress Rules:**

| Port  | Protocol | Source        | Purpose      |
|-------|----------|---------------|--------------|
| 22    | TCP      | 0.0.0.0/0     | SSH          |
| 80    | TCP      | 0.0.0.0/0     | HTTP         |
| 443   | TCP      | 0.0.0.0/0     | HTTPS        |
| 3000  | TCP      | 0.0.0.0/0     | NestJS API   |
| 3001  | TCP      | 0.0.0.0/0     | MT5 Server   |
| 3002  | TCP      | 0.0.0.0/0     | Frontend     |
| 5432  | TCP      | Your IP only  | PostgreSQL   |

> **Important:** Also open the ports in the VM's OS firewall:
> ```bash
> sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
> sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
> sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
> sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
> sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3002 -j ACCEPT
> sudo netfilter-persistent save
> ```

---

## Phase 2: Server Setup (20 min)

### Step 4 — SSH Into Your VM

```bash
ssh -i ~/your-key.key ubuntu@<VM_PUBLIC_IP>
```

### Step 5 — Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Verify
node -v   # v20.x.x
npm -v    # 10.x.x

# Install Docker & Docker Compose
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
newgrp docker

# Verify
docker --version
docker compose version

# Install Nginx (reverse proxy + SSL termination)
sudo apt install -y nginx certbot python3-certbot-nginx

# Install Git
sudo apt install -y git

# Install PM2 (Node.js process manager)
sudo npm install -g pm2

# Install build essentials (needed for bcrypt native module)
sudo apt install -y build-essential python3
```

---

## Phase 3: Deploy Services (30 min)

### Step 6 — Clone Your Repo

```bash
cd ~
git clone https://github.com/YOUR_USERNAME/TradePro.git
cd TradePro
```

### Step 7 — Create Production Docker Compose

```bash
cat > docker-compose.prod.yml << 'DEOF'
services:
  postgres:
    image: postgres:16-alpine
    container_name: trading-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: YOUR_STRONG_DB_PASSWORD_HERE
      POSTGRES_DB: trading_platform
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: trading-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: >
      redis-server
      --appendonly yes
      --maxmemory 256mb
      --maxmemory-policy allkeys-lru
      --requirepass YOUR_STRONG_REDIS_PASSWORD_HERE
    restart: always
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "YOUR_STRONG_REDIS_PASSWORD_HERE", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
DEOF
```

### Step 8 — Start Database & Redis

```bash
docker compose -f docker-compose.prod.yml up -d

# Verify they're running
docker ps
```

### Step 9 — Create Backend Environment File

```bash
cat > backend/.env << 'EOF'
NODE_ENV=production
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:YOUR_STRONG_DB_PASSWORD_HERE@localhost:5432/trading_platform?schema=public

# JWT Auth
JWT_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING_1
JWT_REFRESH_SECRET=REPLACE_WITH_64_CHAR_RANDOM_STRING_2
JWT_EXPIRATION=15m
REFRESH_TOKEN_EXPIRATION=7d

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_STRONG_REDIS_PASSWORD_HERE

# CORS
FRONTEND_URL=https://yourdomain.com
EOF
```

> **Generate secure secrets:**
> ```bash
> openssl rand -hex 32   # Run twice, use for JWT_SECRET and JWT_REFRESH_SECRET
> openssl rand -hex 16   # Use for DB password and Redis password
> ```

### Step 10 — Build & Start Backend

```bash
cd ~/TradePro/backend

# Install dependencies
npm ci

# Generate Prisma client
npx prisma generate

# Push schema to database (creates all tables)
npx prisma db push

# Build TypeScript
npm run build

# Start with PM2
pm2 start dist/main.js --name "tradepro-api" \
  --max-memory-restart 512M \
  --env production

# Verify
curl http://localhost:3000/health
# Should return: {"status":"ok",...}
```

### Step 11 — Create Frontend Environment File

```bash
cat > ~/TradePro/trading-platform-frontend/.env.local << 'EOF'
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_WS_URL=wss://api.yourdomain.com
NEXT_PUBLIC_MT5_API_URL=https://mt5.yourdomain.com
NEXT_PUBLIC_MT5_WS_URL=wss://mt5.yourdomain.com/ws/mt5
EOF
```

### Step 12 — Build & Start Frontend

```bash
cd ~/TradePro/trading-platform-frontend

# Install dependencies
npm ci

# Build production bundle
npm run build

# Start with PM2
pm2 start npm --name "tradepro-frontend" -- start -- -p 3002

# Verify
curl http://localhost:3002
```

### Step 13 — Start MT5 Node Server

```bash
cd ~/TradePro/mt5-server

# Install dependencies
npm ci

# Start with PM2
pm2 start server.js --name "tradepro-mt5" \
  --max-memory-restart 256M

# Verify
curl http://localhost:3001/health
```

### Step 14 — Save PM2 Configuration

```bash
# Save current process list
pm2 save

# Generate startup script (auto-start on reboot)
pm2 startup
# Copy and run the command it outputs, e.g.:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

## Phase 4: Nginx Reverse Proxy + Free SSL (15 min)

### Step 15 — Point Your Domain (DNS)

In your domain provider's DNS settings, add **A records:**

| Type | Name  | Value            | TTL  |
|------|-------|------------------|------|
| A    | `@`   | `<VM_PUBLIC_IP>` | 300  |
| A    | `api` | `<VM_PUBLIC_IP>` | 300  |
| A    | `mt5` | `<VM_PUBLIC_IP>` | 300  |
| A    | `www` | `<VM_PUBLIC_IP>` | 300  |

> **Free domain options:**
> - [freedns.afraid.org](https://freedns.afraid.org) — free subdomains
> - [duckdns.org](https://www.duckdns.org) — free dynamic DNS
> - Namecheap/GoDaddy — ~$1-10/year for a `.com`

### Step 16 — Configure Nginx

```bash
sudo tee /etc/nginx/sites-available/tradepro << 'NEOF'
# ─────────────────────────────────────────────
# Frontend — yourdomain.com
# ─────────────────────────────────────────────
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}

# ─────────────────────────────────────────────
# Backend API — api.yourdomain.com
# ─────────────────────────────────────────────
server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support for Socket.IO
        proxy_read_timeout 86400;
    }
}

# ─────────────────────────────────────────────
# MT5 Server — mt5.yourdomain.com
# ─────────────────────────────────────────────
server {
    listen 80;
    server_name mt5.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # WebSocket support for MT5 live data
        proxy_read_timeout 86400;
    }
}
NEOF

# Enable the site
sudo ln -sf /etc/nginx/sites-available/tradepro /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test & reload
sudo nginx -t && sudo systemctl reload nginx
```

### Step 17 — Enable Free SSL (Let's Encrypt)

```bash
sudo certbot --nginx \
  -d yourdomain.com \
  -d www.yourdomain.com \
  -d api.yourdomain.com \
  -d mt5.yourdomain.com \
  --non-interactive \
  --agree-tos \
  -m your@email.com

# Verify auto-renewal
sudo certbot renew --dry-run
```

Certbot automatically:
- Gets SSL certificates (free)
- Updates Nginx config to redirect HTTP → HTTPS
- Sets up auto-renewal (every 90 days)

---

## Phase 5: MT5 Live Data — Windows PC → Oracle VM

MT5 terminal only runs on **Windows**. You need to tunnel your local Python bridge to the Oracle VM.

### Option A — Cloudflare Tunnel (Recommended, Free)

On your **Windows PC:**

```powershell
# Install Cloudflare Tunnel
winget install Cloudflare.cloudflared

# One-time login
cloudflared tunnel login

# Create a tunnel
cloudflared tunnel create tradepro-mt5

# Create config file
@"
tunnel: tradepro-mt5
credentials-file: C:\Users\$env:USERNAME\.cloudflared\<TUNNEL_ID>.json

ingress:
  - hostname: mt5-bridge.yourdomain.com
    service: http://localhost:8765
  - service: http_status:404
"@ | Out-File -FilePath "$env:USERPROFILE\.cloudflared\config.yml" -Encoding utf8

# Add DNS record
cloudflared tunnel route dns tradepro-mt5 mt5-bridge.yourdomain.com

# Run the tunnel
cloudflared tunnel run tradepro-mt5
```

Then update the MT5 Node server on Oracle VM to connect to `wss://mt5-bridge.yourdomain.com` instead of `ws://localhost:8765`.

### Option B — SSH Reverse Tunnel (Simpler)

On your **Windows PC:**

```powershell
# Forward local Python bridge (8765) to Oracle VM
ssh -R 8765:localhost:8765 -i C:\path\to\your-key.key ubuntu@<VM_PUBLIC_IP> -N -o ServerAliveInterval=60
```

This makes the Python bridge accessible at `localhost:8765` on the Oracle VM. No config changes needed for MT5 Node server.

> **To keep the SSH tunnel alive permanently, install it as a Windows service:**
> ```powershell
> # Install NSSM (Non-Sucking Service Manager)
> winget install nssm
> 
> # Create a service
> nssm install TradePro-MT5-Tunnel "C:\Windows\System32\OpenSSH\ssh.exe" "-R 8765:localhost:8765 -i C:\path\to\key -N -o ServerAliveInterval=60 ubuntu@<VM_PUBLIC_IP>"
> nssm start TradePro-MT5-Tunnel
> ```

### Running MT5 on Windows PC

Make sure these are running on your Windows PC:

```powershell
# 1. Start MT5 Terminal (manual — open MetaTrader 5 and login)

# 2. Start Python Bridge
cd C:\path\to\TradePro\mt5-server\python-bridge
python websocket_server.py

# 3. Start SSH tunnel (Option B) or Cloudflare tunnel (Option A)
```

---

## Phase 6: Monitoring & Maintenance

### PM2 Commands

```bash
pm2 status              # View all processes
pm2 monit               # Real-time monitoring dashboard
pm2 logs                # View all logs
pm2 logs tradepro-api   # View backend logs only
pm2 restart all         # Restart everything
pm2 reload all          # Zero-downtime reload
```

### Useful Health Checks

```bash
# Backend API
curl https://api.yourdomain.com/health

# Frontend
curl -I https://yourdomain.com

# Database
docker exec trading-postgres pg_isready -U postgres

# Redis
docker exec trading-redis redis-cli -a YOUR_REDIS_PASSWORD ping

# Disk usage
df -h

# Memory usage
free -h

# PM2 process memory
pm2 monit
```

### Auto-Renew SSL (Already Configured)

```bash
# Verify cron job exists
sudo crontab -l
# Should show: 0 */12 * * * certbot renew --quiet
```

### Database Backup (Recommended)

```bash
# Create backup script
cat > ~/backup-db.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=~/backups
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

docker exec trading-postgres pg_dump -U postgres trading_platform \
  | gzip > $BACKUP_DIR/trading_platform_$TIMESTAMP.sql.gz

# Keep only last 7 days of backups
find $BACKUP_DIR -name "*.sql.gz" -mtime +7 -delete

echo "Backup complete: trading_platform_$TIMESTAMP.sql.gz"
EOF
chmod +x ~/backup-db.sh

# Add to cron (daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * ~/backup-db.sh") | crontab -
```

---

## Quick Redeploy Script

Save this on your Oracle VM for easy redeployments:

```bash
cat > ~/deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Pulling latest code..."
cd ~/TradePro
git pull origin main

echo "🔧 Building backend..."
cd backend
npm ci --production=false
npx prisma generate
npx prisma db push --accept-data-loss
npm run build
pm2 restart tradepro-api

echo "🎨 Building frontend..."
cd ../trading-platform-frontend
npm ci --production=false
npm run build
pm2 restart tradepro-frontend

echo "📡 Updating MT5 server..."
cd ../mt5-server
npm ci
pm2 restart tradepro-mt5

echo ""
echo "✅ Deployment complete!"
pm2 status
EOF
chmod +x ~/deploy.sh
```

**Usage:** `~/deploy.sh`

---

## Environment Variables Reference

### Backend (`backend/.env`)

| Variable                  | Example Value                           | Description              |
|---------------------------|-----------------------------------------|--------------------------|
| `NODE_ENV`                | `production`                            | Runtime environment      |
| `PORT`                    | `3000`                                  | API port                 |
| `DATABASE_URL`            | `postgresql://postgres:PASS@localhost:5432/trading_platform?schema=public` | Postgres connection |
| `JWT_SECRET`              | `<64-char hex string>`                  | Access token secret      |
| `JWT_REFRESH_SECRET`      | `<64-char hex string>`                  | Refresh token secret     |
| `JWT_EXPIRATION`          | `15m`                                   | Access token TTL         |
| `REFRESH_TOKEN_EXPIRATION`| `7d`                                    | Refresh token TTL        |
| `REDIS_HOST`              | `localhost`                             | Redis host               |
| `REDIS_PORT`              | `6379`                                  | Redis port               |
| `REDIS_PASSWORD`          | `<your redis password>`                 | Redis auth               |
| `FRONTEND_URL`            | `https://yourdomain.com`                | CORS allowed origin      |

### Frontend (`trading-platform-frontend/.env.local`)

| Variable                   | Example Value                      | Description           |
|----------------------------|------------------------------------|-----------------------|
| `NEXT_PUBLIC_API_URL`      | `https://api.yourdomain.com`       | Backend API base URL  |
| `NEXT_PUBLIC_WS_URL`       | `wss://api.yourdomain.com`         | WebSocket URL         |
| `NEXT_PUBLIC_MT5_API_URL`  | `https://mt5.yourdomain.com`       | MT5 REST API URL      |
| `NEXT_PUBLIC_MT5_WS_URL`   | `wss://mt5.yourdomain.com/ws/mt5`  | MT5 WebSocket URL     |

---

## Troubleshooting

### "502 Bad Gateway" from Nginx
```bash
# Check if services are running
pm2 status

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Restart services
pm2 restart all
```

### "Connection refused" on ports
```bash
# Check OS firewall
sudo iptables -L -n | grep -E "3000|3001|3002"

# If missing, add rules
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3000 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3001 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 3002 -j ACCEPT
sudo netfilter-persistent save
```

### Database connection issues
```bash
# Check if Postgres is running
docker ps | grep postgres

# Check logs
docker logs trading-postgres

# Restart
docker compose -f docker-compose.prod.yml restart postgres
```

### PM2 processes crashing
```bash
# View error logs
pm2 logs tradepro-api --err --lines 50

# Check memory
pm2 monit

# Restart with increased memory
pm2 delete tradepro-api
pm2 start dist/main.js --name "tradepro-api" --max-memory-restart 1G
pm2 save
```

### SSL certificate issues
```bash
# Force renew
sudo certbot renew --force-renewal

# Check certificate expiry
sudo certbot certificates
```

---

## Checklist

- [ ] Oracle Cloud account created
- [ ] ARM VM provisioned (2 OCPU, 12GB RAM)
- [ ] Firewall ports opened (OCI Security List + OS iptables)
- [ ] Node.js 20, Docker, Nginx, PM2 installed
- [ ] Repo cloned on VM
- [ ] PostgreSQL + Redis running in Docker
- [ ] Secure passwords generated for DB, Redis, JWT secrets
- [ ] Backend built, Prisma schema pushed, running on PM2
- [ ] Frontend built, running on PM2
- [ ] MT5 Node server running on PM2
- [ ] PM2 startup configured (auto-start on reboot)
- [ ] Domain DNS A records pointing to VM IP
- [ ] Nginx reverse proxy configured
- [ ] SSL certificates installed (Let's Encrypt)
- [ ] MT5 Python bridge tunneled from Windows PC
- [ ] Database backup cron job configured
- [ ] Deploy script created
- [ ] Everything tested end-to-end
