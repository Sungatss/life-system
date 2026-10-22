# Life System

## Daily push reminders

In **Profile → Daily reminders**, enable notifications on each phone or laptop. On a local always-on server, choose a time for each device; on Vercel Hobby, the reminder is fixed near 19:00 Almaty time. Lock In sends one reminder per device per day when due or overdue tasks remain or active habits are unchecked. It does not send anything when the day is complete. The browser must grant permission; on iPhone, open the app from its Home Screen icon.

Generate a VAPID key pair once with `.venv/bin/python backend/create_vapid.py`. Put `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` in the server environment, then restart it. The server derives the matching public key from the private key; `VAPID_PUBLIC_KEY` may also be stored for reference but is not used. The generated subject uses the project URL; you may replace it with a real `mailto:` contact. Keep the private key stable across deployments, or existing browser subscriptions will need to be recreated. Never put the private key in a `VITE_` variable. The Profile control shows a setup message until the required values exist.

On Vercel Hobby, reminders run once daily through a protected cron at **14:00 UTC (around 19:00 Almaty time)**. Vercel may invoke Hobby cron at any point in that hour. The Profile page shows this fixed schedule. In Vercel **Production** environment variables, set the private key and subject above and add `CRON_SECRET` (a separate random string of at least 16 characters), then redeploy Production. The cron endpoint rejects requests without the matching bearer secret. Vercel sends that header automatically when `CRON_SECRET` is configured. For a local always-on backend, the in-process timer still honors each device's selected local time. Actual push delivery depends on the device's network and notification settings.

A minimalist personal productivity web application built for daily use.

Primary areas:
1. **Today**: Date, today's tasks and habits.
2. **Inbox**: An empty-at-start capture list for thoughts and tasks, with multiline entries you can edit or delete. Draft text remains in the browser until saved.
3. **Tasks**: Structured tasks with optional descriptions and nested steps with their own checkboxes. Add steps while creating a task (one per line under details) or from any existing task card. Checking the final step offers **Complete** or **Keep open** for the parent task; it never completes the parent automatically.
4. **Projects**: A simple project plan or roadmap with its own tasks and nested steps. Existing tasks can be assigned through Edit. Deleting a project leaves its tasks in Tasks.
5. **Habits**: Consistency tracking with a 14-day history grid.
6. **Calendar**: Month view and selected-day schedule for events, deadlines, and existing task due dates.
7. **Finance**: KZT-first ledger for income, essential and optional expenses, transfers between cash, emergency savings, and tracked investments, monthly budget targets, debts and tuition, and weekly money reviews.

A compact progress card on Tasks and Habits rewards each completed task or daily habit with 10 XP. The daily goal is 30 XP, each 100 XP adds a level, and one completion per day maintains a streak. An unfinished day keeps yesterday’s streak until the day ends. Dates follow the device’s timezone. Progress is calculated from saved completions, including existing history: undoing or deleting activity removes its XP, archived habits retain theirs, and subtasks do not earn separate XP.

The compact top navigation keeps Today, Tasks, Habits, and Profile visible. Calendar, Finance, Inbox, and Projects are available from the More menu.

Finance stores exact integer minor units and calculates balances from starting amounts plus recorded entries. Set starting cash, fund balances, and a first emergency buffer goal in **Finance → Plan**, then record income, expenses, and transfers in **Activity**. Add regular essential costs in **Plan** to calculate the minimum monthly budget; include regular debt or tuition payments there if they are part of that minimum. The liquid runway number is `(cash + emergency fund) / essential monthly budget`, and remains unset until an essential budget exists. Mark obligations urgent or give them a due date; **Record payment** logs an essential expense and reduces the amount remaining. The investment bucket tracks contributed money only, not market value or returns. Finance never moves real money or connects to a bank, and its records are not sent to Groq. All Finance routes require the existing login and have a separate request limit.

Weekly Review on Profile summarizes the selected Monday–Sunday week above the saved Wins, Challenges, and Next focus prompts. Planned tasks are tasks currently due that week; the completion rate counts those finished by the end of the week (or by today for the current week). A project moves forward when one of its tasks is finished that week. XP is earned from task and habit completions during that week. Habit consistency uses currently active habits and elapsed days, so archived habits still contribute XP and active days but historical consistency cannot fully reconstruct when a habit was archived. Past statistics reflect the current saved task due dates and project assignments.

**Ask Lock In** opens a simple chat panel from any page. Ask about relevant saved tasks, habits, projects, or Inbox items; request a plan for today; or name a task or project to break into steps. It shows each proposed task change before you approve it. The assistant cannot delete records or edit multiple records with one click.

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

# If needed, create .env and complete the login setup below before starting.
cp -n .env.example .env

# Run the FastAPI server
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --env-file ../.env --reload
```

The backend API will be available at `http://127.0.0.1:8000`.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend will be running at `http://127.0.0.1:5173` with automatic API proxying to `http://127.0.0.1:8000`.

### Private login and free Groq setup

All personal-data API routes require the single-user password, including when the Cloudflare tunnel is active. They return a configuration error until the password hash and session secret are set. Existing saved records are preserved.
The bundled systemd service and Docker Compose port mapping listen on the host's loopback address, so remote access goes through your configured HTTPS tunnel or reverse proxy.

1. In the project root, run `.venv/bin/python backend/create_login.py`. Enter a new password of at least 12 characters twice. Copy the generated `LOCK_IN_PASSWORD_HASH` and `LOCK_IN_SESSION_SECRET` lines into the ignored `.env` file. Keep the hash's `$` characters exactly as printed. Never put the password itself in `.env`. Run `chmod 600 .env` so only your account can read it.
2. Create a GroqCloud account at [console.groq.com](https://console.groq.com/). Open [API Keys](https://console.groq.com/keys), choose **Create API Key**, and copy the new key into `.env` as `GROQ_API_KEY=...`. Choose the free plan; do not enable billing or paid fallback. If a key was shared in chat or elsewhere, revoke it in the Groq console and use a new one.
3. Set `GROQ_MODEL=openai/gpt-oss-20b` in `.env`. This is the verified default free-plan model. The server also permits `openai/gpt-oss-120b`, currently listed on Groq's free plan. Other models are refused so no paid fallback is possible. Set `ALLOWED_ORIGINS` to your exact public origin (including `https://`) and local development origins; do not use `*`.
4. For an existing background installation, run `./life-system.sh setup` once to install the updated loopback-only service unit, then restart after future `.env` changes with `./life-system.sh restart`. For local development, restart the `uvicorn` process. Open the app and sign in. The assistant's status message explains if its key is still missing.

The browser receives only a signed HttpOnly session cookie and a per-session request token. The Groq key is read only by the FastAPI process. Each assistant call sends a small relevant subset of app records to Groq, with at most four short conversation messages. Requests are limited to three per minute and 60 per day locally, in addition to Groq's free-plan limits. Suggestions expire after 15 minutes and need individual **Apply** clicks. Live Groq usage should be verified manually after you configure your new key; automated tests use a fake key and mocked responses.

### Vercel deployment

Vercel is a separate backend; this computer's `.env` and SQLite database do not appear there. The Vercel project needs a persistent PostgreSQL `DATABASE_URL` and these **Production** server environment variables: `LOCK_IN_PASSWORD_HASH`, `LOCK_IN_SESSION_SECRET`, `GROQ_API_KEY`, and `GROQ_MODEL=openai/gpt-oss-20b`. Add credentials as Vercel **Secret** variables, never as `VITE_` frontend variables. Keep the database URL already attached to the project; replacing it can disconnect existing saved data. Redeploy after changing environment variables. The backend refuses temporary SQLite storage on Vercel, and its login and assistant limits use shared database counters across function instances.

Do not copy this computer's `.env` into Vercel: it includes a local SQLite URL. If the Vercel database already has records, inspect and back them up before migrating any local records into it.

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
