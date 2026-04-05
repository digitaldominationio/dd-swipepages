# Swipe Toolkit

Team productivity tool with a Chrome extension frontend and Express.js backend. Features include reusable swipe storage (templates, emails, snippets), email validation, AI-powered content generation, and WhatsApp messaging.

---

## Table of Contents

1. [Quick Start (Docker)](#quick-start-docker)
2. [Local Development Setup](#local-development-setup)
3. [Chrome Extension Setup](#chrome-extension-setup)
4. [Admin Panel](#admin-panel)
5. [First-Time Configuration](#first-time-configuration)
6. [Coolify Deployment](#coolify-deployment)
7. [Environment Variables](#environment-variables)
8. [API Overview](#api-overview)

---

## Quick Start (Docker)

The fastest way to get running. Requires Docker and Docker Compose.

```bash
# 1. Clone the repo
git clone https://github.com/digitaldominationio/dd-swipepages.git
cd dd-swipepages

# 2. Create your .env file
cp .env.example .env

# 3. Generate secure secrets and update .env
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output into JWT_SECRET in .env

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy the output into ENCRYPTION_KEY in .env

# 4. (Optional) Change ADMIN_EMAIL and ADMIN_PASSWORD in .env

# 5. Start everything
docker compose up -d

# 6. Verify it's running
curl http://localhost:3000/api/health
# Should return: {"status":"ok"}
```

The server is now running at `http://localhost:3000`. The admin panel is at `http://localhost:3000/admin`.

---

## Local Development Setup

For developing without Docker. Requires Node.js 20+ and a PostgreSQL 16 instance.

### 1. Set up PostgreSQL

Install and start PostgreSQL locally, then create a database:

```bash
createdb swipetoolkit
```

### 2. Set up the backend

```bash
cd backend

# Install dependencies
npm install

# Create .env
cp .env.example .env
```

Edit `backend/.env`:

```
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/swipetoolkit"
JWT_SECRET="your-random-secret-here"
ENCRYPTION_KEY="your-64-char-hex-string-here"
PORT=3000
```

Generate secrets:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run migrations, seed, and start:

```bash
# Run database migrations
npx prisma migrate deploy

# Create initial admin user
npm run db:seed

# Start the dev server (with auto-reload)
npm run dev
```

The API is now running at `http://localhost:3000`.

### 3. Set up the admin panel (for development)

```bash
cd admin

# Install dependencies
npm install

# Start Vite dev server (proxies /api to backend)
npm run dev
```

The admin panel dev server runs at `http://localhost:5173/admin/`. API calls are proxied to the backend on port 3000.

To build for production (served by the backend):

```bash
npm run build
```

The build output in `admin/dist/` is served by Express at `/admin`.

---

## Chrome Extension Setup

### Install in Chrome

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in the top-right corner)
3. Click **Load unpacked**
4. Select the `extension/` folder from this repo
5. The Swipe Toolkit icon appears in your toolbar

### Connect to your server

1. Click the Swipe Toolkit extension icon
2. You'll see the login screen
3. Click the gear icon or **Settings** link to set your server URL
4. Enter your server URL (default: `http://localhost:3000`)
5. Click **Save**

### Log in

Use the admin credentials you configured:

- **Email:** `admin@swipetoolkit.com` (or whatever you set in `ADMIN_EMAIL`)
- **Password:** `changeme123` (or whatever you set in `ADMIN_PASSWORD`)

### Using the extension

The extension has four tabs:

- **Swipe Storage** — Browse, search, copy, and manage templates/snippets organized in folders with tags
- **Email Validator** — Paste an email address, click Validate, see the result (uses Reoon API)
- **AI Generator** — Select text on any webpage or type content, choose a prompt, generate AI content (uses OpenAI)
- **WhatsApp Send** — Enter a phone number with country code, compose a message, send via WhatsApp (uses Walytic API)

### Context menu (right-click)

1. Select any text on a webpage
2. Right-click and choose **"Generate with AI"**
3. The extension popup opens with the selected text pre-filled in the AI Generator tab

### Production host permissions

By default, the extension only connects to `localhost:3000`. To connect to a production server, update `extension/manifest.json`:

```json
"host_permissions": [
  "http://localhost:3000/*",
  "https://your-production-domain.com/*"
]
```

Then reload the extension in `chrome://extensions/`.

---

## Admin Panel

Access the admin panel at `http://localhost:3000/admin` (or `https://your-domain.com/admin` in production).

### Pages

- **Dashboard** — Overview stats (team members, prompts, folders, snippets)
- **Team Management** — Invite new members via email, view team, remove members
- **API Keys** — Configure external API credentials (Reoon, OpenAI, Walytic) — stored encrypted
- **Prompts** — Create and manage AI prompts (name, category, prompt text, sort order)
- **Swipe Storage** — Full-page view for managing folders, snippets, and tags

### Inviting team members

1. Go to Team Management
2. Enter the team member's email
3. Click "Send Invite" — an invite token is generated (valid for 48 hours)
4. Share the invite link with the team member
5. They visit the link, set their name and password, and they're in

---

## First-Time Configuration

After starting the server and logging into the admin panel:

### 1. Change your admin password

Log in with the default credentials, then update your password (if you used the defaults).

### 2. Configure API Keys

Go to **Admin Panel > API Keys** and enter your credentials:

| Key | Service | How to get it |
|-----|---------|---------------|
| `reoon_api_key` | Reoon Email Validator | Sign up at [reoon.com](https://reoon.com) |
| `openai_api_key` | OpenAI (GPT-4o) | Get from [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| `walytic_api_key` | Walytic WhatsApp | Get from your Walytic dashboard |
| `walytic_session_id` | Walytic WhatsApp | Get from your Walytic dashboard |

These keys are encrypted at rest using AES-256-GCM. They are never exposed to the Chrome extension — all external API calls happen server-side.

### 3. Create AI Prompts

Go to **Admin Panel > Prompts** and create prompts for your team:

- **Name** — What your team sees in the dropdown (e.g., "Cold Outreach Email")
- **Category** — `email` or `whatsapp` (determines which tab shows the prompt)
- **Prompt Text** — The system prompt sent to OpenAI along with the selected content
- **Sort Order** — Controls the display order in the dropdown

### 4. Invite your team

Go to **Team Management** and invite team members by email.

---

## Coolify Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for detailed Coolify setup instructions, including:

- Project setup and repository connection
- PostgreSQL provisioning
- Environment variable configuration
- Persistent volume setup (critical — data is lost without this)
- Backup and restore procedures
- Redeployment checklist

### Quick summary

1. Create a new project in Coolify
2. Connect your GitHub repo
3. Set build pack to **Docker Compose**
4. Configure all environment variables (see [Environment Variables](#environment-variables))
5. Set up persistent volumes for `postgres_data` and `uploads_data`
6. Deploy

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | No | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | No | `postgres` | PostgreSQL password |
| `POSTGRES_DB` | No | `swipetoolkit` | PostgreSQL database name |
| `DATABASE_URL` | Yes | — | Full PostgreSQL connection string |
| `NODE_ENV` | No | `production` | Environment (`development` or `production`) |
| `PORT` | No | `3000` | Express server port |
| `JWT_SECRET` | **Yes** | — | Random string for signing JWTs (min 32 chars) |
| `ENCRYPTION_KEY` | **Yes** | — | 64-char hex string for AES-256-GCM encryption |
| `ADMIN_EMAIL` | No | `admin@swipetoolkit.com` | Initial admin user email |
| `ADMIN_PASSWORD` | No | `changeme123` | Initial admin user password |
| `DB_PORT` | No | `5432` | Host port for PostgreSQL (Docker) |
| `API_PORT` | No | `3000` | Host port for the API (Docker) |

Generate secure secrets:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## API Overview

All routes are prefixed with `/api`. Authentication uses JWT Bearer tokens.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/login` | No | Login with email + password |
| `POST` | `/api/auth/accept-invite` | No | Accept invite, create account |
| `GET` | `/api/auth/me` | Yes | Get current user |
| `POST` | `/api/admin/invite` | Admin | Send invite to email |
| `GET` | `/api/admin/users` | Admin | List team members |
| `DELETE` | `/api/admin/users/:id` | Admin | Remove team member |
| `GET` | `/api/admin/settings` | Admin | Get settings (masked values) |
| `PUT` | `/api/admin/settings` | Admin | Update API key settings |
| `POST` | `/api/admin/prompts` | Admin | Create AI prompt |
| `GET` | `/api/admin/prompts` | Admin | List all prompts |
| `PUT` | `/api/admin/prompts/:id` | Admin | Update prompt |
| `DELETE` | `/api/admin/prompts/:id` | Admin | Delete prompt |
| `GET` | `/api/folders` | Yes | List folders |
| `POST` | `/api/folders` | Yes | Create folder |
| `PUT` | `/api/folders/:id` | Yes | Update folder |
| `DELETE` | `/api/folders/:id` | Yes | Delete folder |
| `GET` | `/api/snippets` | Yes | List snippets (supports `?folder=&tag=&search=`) |
| `POST` | `/api/snippets` | Yes | Create snippet |
| `PUT` | `/api/snippets/:id` | Yes | Update snippet |
| `DELETE` | `/api/snippets/:id` | Yes | Delete snippet |
| `GET` | `/api/tags` | Yes | List tags |
| `POST` | `/api/tags` | Yes | Create tag |
| `PUT` | `/api/tags/:id` | Yes | Update tag |
| `DELETE` | `/api/tags/:id` | Yes | Delete tag |
| `POST` | `/api/validate-email` | Yes | Validate email via Reoon |
| `POST` | `/api/generate` | Yes | Generate content via OpenAI |
| `GET` | `/api/prompts` | Yes | List prompts (user view) |
| `POST` | `/api/whatsapp/send` | Yes | Send WhatsApp message via Walytic |
| `GET` | `/api/health` | No | Health check |
