# Life System

A minimalist personal productivity web application built for daily use.

Focuses strictly on three primary areas:
1. **Today**: Date, auto-saving daily note, today's tasks, and habit checklist.
2. **Tasks**: Rapid brain dump with instant capture and quick filtering.
3. **Habits**: Consistency tracking with a 14-day history grid and no gamification gimmicks.

Includes dedicated Privacy Policy and Terms and Conditions pages.

---

## Tech Stack

- **Frontend**: React 19, Vite, Lucide Icons, clean vanilla CSS design system.
- **Backend**: Python 3.12+, FastAPI, SQLAlchemy.
- **Database**: SQLite by default (zero configuration, persistent), fully compatible with PostgreSQL.
- **PWA**: Web App Manifest and mobile viewport meta configuration for phone home-screen installation.

---

## Running Locally

### 1. Backend

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r backend/requirements.txt

# Run the FastAPI server
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

The backend API will be available at `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be running at `http://127.0.0.1:5173` with automatic API proxying to `http://127.0.0.1:8000`.

---

## 24/7 Background Service & Persistent Remote Access

Life System comes with pre-configured automated systemd services and Cloudflare tunnel integration to run 24/7 in the background with auto-restart on system boot.

### Quick Management Commands

```bash
# Check status and current public URL
./life-system.sh status

# View live application & tunnel logs
./life-system.sh logs

# Stop or restart services
./life-system.sh restart
./life-system.sh stop
./life-system.sh start

# Show current public link
./life-system.sh url
```

### 1. Setting up a Permanent 24/7 Custom Domain (Free Cloudflare Named Tunnel)

By default, the tunnel launches with a quick tunnel URL. For a **permanent 24/7 domain** that never changes:
1. Go to the free [Cloudflare Zero Trust Dashboard](https://one.dash.cloudflare.com/) -> **Networks** -> **Tunnels**.
2. Click **Create a tunnel** -> Choose **Cloudflare** connector -> Name it `life-system`.
3. In Public Hostname, route your desired domain/subdomain (e.g. `life.yourdomain.com`) to `http://localhost:8000`.
4. Copy the tunnel token provided by Cloudflare.
5. Save the token:
   ```bash
   ./life-system.sh set-token <YOUR_CLOUDFLARE_TUNNEL_TOKEN>
   ```
Your site is now available 24/7 at `https://life.yourdomain.com` without opening ports on your router.

### 2. Keeping Laptop Online With Lid Closed

If running on a Linux laptop, configure systemd-logind so closing the lid turns off the screen while keeping the server running 24/7:

```bash
./life-system.sh keep-awake
```

---

## Custom Domain Deployment


### Option A: Docker and Docker Compose (Recommended)

1. Clone repository to your server.
2. Edit `docker-compose.yml` to specify your custom domain in `ALLOWED_ORIGINS`.
3. Launch container:
   ```bash
   docker compose up -d --build
   ```
4. Configure Caddy or Nginx with automatic HTTPS reverse proxying to port 8000.

### Option B: Caddy Reverse Proxy

```caddyfile
yourdomain.com {
    reverse_proxy 127.0.0.1:8000
    encode zstd gzip
}
```

---

## Database Migration to PostgreSQL

To switch from SQLite to PostgreSQL:
1. Install `psycopg2-binary` or `asyncpg` in the Python environment:
   ```bash
   pip install psycopg2-binary
   ```
2. Update the `DATABASE_URL` environment variable:
   ```bash
   export DATABASE_URL="postgresql://username:password@localhost:5432/lifesystem"
   ```
The SQLAlchemy database layer automatically initializes all tables on startup.

---

## Mobile Installation (PWA)

1. Open the application URL in Safari (iOS) or Chrome (Android).
2. Tap the Share button (iOS) or browser menu (Android).
3. Select "Add to Home Screen".
4. The application opens in standalone fullscreen mode without browser navigation chrome.
