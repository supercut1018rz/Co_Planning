# 🌐 Network Access Configuration Guide

This application is configured for **local access only (127.0.0.1)** by default for maximum security.

If you need to make it accessible from other computers or the internet, choose one of the secure methods below.

---

## 🏠 Current Configuration (Default)

**Access**: Local only  
**URL**: http://localhost:3000  
**Who can access**: Only you (on the server machine)

This is the **most secure** configuration. Keep this if you're the only user.

---

## 🌍 Option 1: Cloudflare Tunnel (Easiest!)

**Best for**: Quick sharing, demos, public access  
**Difficulty**: ⭐ Very Easy (1 command!)  
**Security**: ⭐⭐⭐⭐⭐ Excellent  
**Cost**: Free

### Steps

```bash
# 1. Install cloudflared
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64 -o cloudflared
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/

# 2. Start tunnel
cloudflared tunnel --url http://localhost:3000
```

**Output**:
```
Your quick tunnel is available at:
https://abc-def-ghi.trycloudflare.com
```

**Access**: Share the HTTPS link with anyone!

**Features**:
- ✅ Automatic HTTPS
- ✅ No firewall configuration needed
- ✅ DDoS protection by Cloudflare
- ✅ Application stays on 127.0.0.1 (secure)

**Stop tunnel**: Press `Ctrl+C`

---

## 🔐 Option 2: SSH Tunnel (Secure Remote Access)

**Best for**: Small team, temporary access  
**Difficulty**: ⭐⭐ Easy  
**Security**: ⭐⭐⭐⭐⭐ Excellent  
**Cost**: Free

### Steps (for remote users)

```bash
# On your computer (not the server)
ssh -L 3000:localhost:3000 username@server-ip

# Then open browser
http://localhost:3000
```

**Features**:
- ✅ All traffic encrypted via SSH
- ✅ No configuration changes needed
- ✅ Only authorized SSH users can access
- ✅ Application stays on 127.0.0.1 (secure)

---

## 🏢 Option 3: Nginx Reverse Proxy (Production)

**Best for**: Production deployment, custom domain  
**Difficulty**: ⭐⭐⭐ Moderate  
**Security**: ⭐⭐⭐⭐⭐ Excellent  
**Cost**: Free (domain name required)

### Steps

**1. Install Nginx**

```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

**2. Configure Nginx**

Create `/etc/nginx/sites-available/sidewalk-planning`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;
    
    # SSL certificates (will be added by certbot)
    
    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Reverse proxy to Next.js
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # Request size limit
    client_max_body_size 10M;
}
```

**3. Enable site**

```bash
sudo ln -s /etc/nginx/sites-available/sidewalk-planning /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

**4. Setup HTTPS**

```bash
sudo certbot --nginx -d your-domain.com
```

**Access**: https://your-domain.com

**Features**:
- ✅ Custom domain
- ✅ Automatic HTTPS
- ✅ Production-grade security
- ✅ Application stays on 127.0.0.1 (secure)

---

## 👥 Option 4: Intranet Access (Same Network)

**Best for**: Lab/office sharing (trusted network only)  
**Difficulty**: ⭐ Very Easy  
**Security**: ⭐⭐⭐ Good (if trusted network)  
**Cost**: Free

### Steps

**1. Modify docker-compose.yml**

Change:
```yaml
# Before (local only)
ports:
  - "127.0.0.1:3000:3000"

# After (network access)
ports:
  - "0.0.0.0:3000:3000"
```

**2. Restart**

```bash
docker compose down
docker compose up -d
```

**3. Find server IP**

```bash
hostname -I
# Output: 192.168.1.100 10.0.0.5
```

**Access**: http://192.168.1.100:3000

**⚠️ WARNING**:
- Use ONLY on trusted networks (lab/office)
- Do NOT use on servers with public IP
- Consider using firewall rules

---

## 🔥 Option 5: Tailscale VPN (Remote Team)

**Best for**: Remote team access, zero-trust network  
**Difficulty**: ⭐⭐ Easy  
**Security**: ⭐⭐⭐⭐⭐ Excellent  
**Cost**: Free (up to 100 devices)

### Steps

**1. Install Tailscale (on server)**

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

**2. Modify docker-compose.yml**

```yaml
# Use Tailscale IP instead of 127.0.0.1
ports:
  - "100.x.x.x:3000:3000"  # Replace with your Tailscale IP
```

**3. Install Tailscale (on user devices)**

All team members install Tailscale and join your network.

**Access**: http://100.x.x.x:3000 (or custom DNS name)

**Features**:
- ✅ Encrypted VPN connection
- ✅ Works from anywhere
- ✅ Access control (invite-only)
- ✅ Works behind NAT/firewall

---

## 📋 Method Comparison

### Quick Decision Tree

```
Need public access?
│
├─ Yes → Need custom domain?
│        │
│        ├─ Yes → Nginx + HTTPS (Option 1)
│        │
│        └─ No  → Cloudflare Tunnel (Option 2) – auto HTTPS, very simple
│
└─ No  → Need team access?
         │
         ├─ Same LAN → Bind to 0.0.0.0 (Option 4)
         │
         ├─ Remote team → SSH tunnel (Option 2) or Tailscale VPN (Option 5)
         │
         └─ Just you → No change needed
```

---

## 🎯 Recommended for Different Use Cases

### 🧪 Development / Testing
**Keep current config** (127.0.0.1)  
No changes needed!

### 👨‍🏫 Demo / Quick Share
**Use Cloudflare Tunnel** (Option 2)  
One command, instant HTTPS link!

### 👥 Lab / Office Team
**Use SSH Tunnel** (Option 2) or **Intranet Access** (Option 4)  
Simple sharing within trusted network

### 🌍 Production / Public Website
**Use Nginx + HTTPS** (Option 1)  
Professional, secure, scalable

### 🏢 Remote Team (Distributed)
**Use Tailscale VPN** (Option 5)  
Secure remote access from anywhere

---

## 🛡️ Security Best Practices

### ✅ DO (Recommended)

```
✅ Keep application on 127.0.0.1
✅ Use reverse proxy (Nginx/Cloudflare) for public access
✅ Always use HTTPS for public deployment
✅ Use strong passwords
✅ Configure firewall rules
✅ Keep Next.js updated
```

### ❌ DON'T (Dangerous)

```
❌ Bind to 0.0.0.0 on public servers
❌ Expose database port to internet
❌ Use HTTP for public deployment
❌ Use default passwords
❌ Skip security updates
```

---

## 💡 Example: AWS Deployment (Recommended)

```bash
# On AWS EC2 instance

# 1. Deploy app (keep 127.0.0.1)
docker compose up -d

# 2. Install Nginx
sudo apt install nginx certbot python3-certbot-nginx

# 3. Configure Nginx reverse proxy
sudo nano /etc/nginx/sites-available/sidewalk

# 4. Enable HTTPS
sudo certbot --nginx -d your-domain.com

# 5. Configure AWS Security Group
Allow inbound:
  - HTTP (80) from 0.0.0.0/0
  - HTTPS (443) from 0.0.0.0/0
  - SSH (22) from YOUR_IP only

Block:
  - Port 3000 (not needed, Nginx proxies)
  - Port 15432 (database, never expose)
```

**Result**: 
- ✅ Users access: https://your-domain.com
- ✅ Application secure on 127.0.0.1
- ✅ Database completely internal
- ✅ AWS security group protected

---

## 🆘 Quick Examples

### "I want to show it to my advisor right now"
→ Use **Cloudflare Tunnel** (2 minutes)

### "I want to deploy to AWS for my team"
→ Use **Nginx + HTTPS** (30 minutes)

### "I want 3 lab members to access it"
→ Use **SSH Tunnel** (5 minutes) or **0.0.0.0 on internal IP** (1 minute)

### "I want remote collaborators to access it"
→ Use **Tailscale VPN** (15 minutes)

---

## ✅ Conclusion

**Your current configuration (127.0.0.1) is PERFECT!** 

It's secure by default, and deployers can easily make it accessible using the methods above based on their needs.

**Keep 127.0.0.1 in the package, and include this guide!** 

Users will appreciate having a secure default with clear options for remote access.
