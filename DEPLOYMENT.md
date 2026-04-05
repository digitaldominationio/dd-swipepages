# Swipe Toolkit — Coolify Deployment Guide

## Architecture

- **Backend**: Express.js API with Prisma ORM (PostgreSQL)
- **Admin Panel**: React SPA (Vite), built at Docker build time and served by Express under `/admin`
- **Extension**: Chrome extension, distributed separately (not deployed)

## Prerequisites

- A Coolify instance (self-hosted or cloud)
- A Git repository accessible from Coolify (GitHub, GitLab, etc.)

---

## Coolify Setup

### 1. Create a New Project

1. In Coolify, create a new **Project** (e.g., "Swipe Toolkit").
2. Add an **Environment** (e.g., "production").

### 2. Add a PostgreSQL Database

1. Inside the environment, click **New Resource** > **Database** > **PostgreSQL**.
2. Use the `postgres:16-alpine` image.
3. Set a strong password for the `postgres` user.
4. Note the internal connection URL — it will look like:
   ```
   postgresql://postgres:<password>@<hostname>:5432/swipetoolkit
   ```
5. Create the database `swipetoolkit` if Coolify does not create it automatically.

### 3. Deploy the Application

1. Add a new **Resource** > **Application** > **Docker Compose** (or **Dockerfile**).
2. Point it to your Git repository.
3. Set the **Build Pack** to **Docker Compose** and ensure it uses the root `docker-compose.yml`.
4. Alternatively, use **Dockerfile** mode pointing to the root `Dockerfile`.

### 4. Configure Networking

1. Set the **exposed port** to `3000`.
2. Add your domain and enable HTTPS (Coolify handles Let's Encrypt automatically).
3. Set the health check path to `/api/health`.

---

## Environment Variables

Set these in Coolify under **Environment Variables**:

| Variable | Required | Description | Example / Default |
|---|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string (use Coolify's internal hostname) | `postgresql://postgres:secret@<pg-host>:5432/swipetoolkit` |
| `JWT_SECRET` | Yes | Random string for JWT signing (min 32 chars) | `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Yes | 64-char hex string for AES-256-GCM | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `NODE_ENV` | No | Environment mode | `production` |
| `PORT` | No | Application port | `3000` |
| `ADMIN_EMAIL` | No | Initial admin user email | `admin@swipetoolkit.com` |
| `ADMIN_PASSWORD` | No | Initial admin user password | `changeme123` |

If using **Docker Compose** mode, also set:

| Variable | Required | Description | Default |
|---|---|---|---|
| `POSTGRES_USER` | Yes | PostgreSQL username | `postgres` |
| `POSTGRES_PASSWORD` | Yes | PostgreSQL password (use a strong value) | — |
| `POSTGRES_DB` | No | Database name | `swipetoolkit` |
| `API_PORT` | No | Host port mapping | `3000` |

---

## Persistent Storage (CRITICAL)

> **WARNING: Without persistent volumes, ALL data (database, uploads) is permanently lost on every redeploy, restart, or git pull. You MUST configure persistent storage in Coolify.**

### Required Volumes

| Volume Name | Container Path | Purpose |
|---|---|---|
| `postgres_data` | `/var/lib/postgresql/data` | PostgreSQL database files |
| `uploads_data` | `/app/uploads` | User-uploaded files |

Both volumes are defined as **named volumes** in `docker-compose.yml`. Named volumes are managed by Docker and persist independently of container lifecycle.

### Setting Up Persistent Storage in Coolify

1. Go to your application in the Coolify dashboard.
2. Navigate to **Settings** (or **Configuration**) for the service.
3. Open the **Storages** / **Volumes** section.
4. For **each** volume listed above, add a persistent storage entry:
   - **Name/Label**: e.g. `postgres_data`
   - **Mount Path** (in container): `/var/lib/postgresql/data`
   - **Type**: Volume (not bind mount)
5. Repeat for `uploads_data` with mount path `/app/uploads`.
6. Save and redeploy.

If using docker-compose deployment mode in Coolify, the named volumes in `docker-compose.yml` are automatically created and persisted. Verify they appear under your application's storage settings after the first deploy.

### Verifying Persistence

After deploying, you can verify volumes exist by running on the host:

```bash
docker volume ls | grep swipetoolkit
```

You should see both `postgres_data` and `uploads_data` volumes listed.

---

## How Startup Works

The application runs the following on every container start (defined in `backend/scripts/start.sh`):

1. **`npx prisma migrate deploy`** — Applies any pending database migrations. This is safe to run repeatedly; it only applies new migrations and never drops data.
2. **`node prisma/seed.js`** — Creates the initial admin user **only if no admin exists**. This is idempotent and will skip seeding if the admin user is already present.
3. **`node src/index.js`** — Starts the application server.

This means schema updates from new code deploys are applied automatically without data loss.

---

## Post-Deployment Verification

1. Visit `https://yourdomain.com/api/health` — should return `{"status":"ok"}`.
2. Visit `https://yourdomain.com/admin` — should load the admin panel.
3. Log in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` credentials.

---

## Updating

Push to your Git repository. In Coolify:
- If auto-deploy is enabled, it will rebuild and redeploy automatically.
- Otherwise, click **Redeploy** in the Coolify dashboard.

Migrations run automatically on every container start, so schema changes are applied on deploy.

---

## Local Development with Docker

```bash
# Copy environment file
cp .env.example .env

# Edit .env with your values (the defaults work for local dev)
# For local dev, set JWT_SECRET and ENCRYPTION_KEY to any value

# Start all services
docker compose up --build

# The API is available at http://localhost:3000
# The admin panel is at http://localhost:3000/admin
```

---

## Backup Recommendations

### PostgreSQL Database

Regular backups of the PostgreSQL volume are essential. Choose one of these approaches:

**Option 1: pg_dump (recommended)**

Run a scheduled backup using `pg_dump` from the host or a sidecar container:

```bash
docker exec swipetoolkit_db pg_dump -U postgres swipetoolkit > backup_$(date +%Y%m%d_%H%M%S).sql
```

Automate this with a cron job (e.g., daily at 2 AM):

```cron
0 2 * * * docker exec swipetoolkit_db pg_dump -U postgres swipetoolkit | gzip > /backups/swipetoolkit_$(date +\%Y\%m\%d).sql.gz
```

**Option 2: Volume-level backup**

Stop the database container and back up the Docker volume directly:

```bash
docker run --rm -v swipetoolkit_postgres_data:/data -v /backups:/backup alpine \
  tar czf /backup/postgres_data_$(date +%Y%m%d).tar.gz -C /data .
```

### Uploads

Back up the uploads volume similarly:

```bash
docker run --rm -v swipetoolkit_uploads_data:/data -v /backups:/backup alpine \
  tar czf /backup/uploads_$(date +%Y%m%d).tar.gz -C /data .
```

### Restore from Backup

To restore a PostgreSQL backup:

```bash
cat backup.sql | docker exec -i swipetoolkit_db psql -U postgres swipetoolkit
```

---

## Redeployment Checklist

Before every redeploy, verify:

- [ ] Persistent volumes are configured in Coolify for both `postgres_data` and `uploads_data`
- [ ] Environment variables are set (especially `JWT_SECRET` and `ENCRYPTION_KEY` — changing these will invalidate existing sessions/encrypted data)
- [ ] A recent database backup exists
