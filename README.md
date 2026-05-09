# Media Catalog UI (React + TypeScript)

Browser frontend for the Python Flask backend in `../media-catalog-backend`.

## Features

- Movie search against backend endpoint `GET /movies/search`
- Search pagination with previous/next and page jump
- Media item catalog manager for:
  - `GET /media-items`
  - `POST /media-items`
  - `PATCH /media-items/:id`
  - `DELETE /media-items/:id`
- Catalog pagination with limit presets (10/20/50) and page jump
- Optimistic create/update/delete with rollback on errors
- Toast notifications for success and error events

## Prerequisites

- Node.js 20+
- Backend running at `http://192.168.50.112:8001`

## Run locally

1. Install dependencies:

```bash
npm install
```

2. Start dev server:

```bash
npm run dev
```

3. Open the printed local URL (usually `http://localhost:5173`).

## API base URL

The UI uses `VITE_API_BASE_URL`.

- Default: `/api` (recommended for local dev)
- `vite.config.ts` proxies `/api/*` to `http://192.168.50.112:8001/*`
- Override proxy target with `VITE_DEV_PROXY_TARGET`

To override:

```bash
cp .env.example .env
```

Then edit `.env`.

## Build

```bash
npm run build
```

## Deploy To Raspberry Pi

This app builds to static files, so deployment on Raspberry Pi is lightweight.

1. Build the frontend:

```bash
npm ci
npm run build
```

2. Copy the built files to the Pi:

```bash
rsync -avz --delete dist/ pi@YOUR_PI_IP:/var/www/media-catalog-ui/
```

3. Install Nginx on the Pi:

```bash
sudo apt update
sudo apt install -y nginx
```

4. Create site config on the Pi at `/etc/nginx/sites-available/media-catalog-ui`:

```nginx
server {
  listen 80;
  server_name _;

  root /var/www/media-catalog-ui;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://192.168.50.112:8001/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

5. Enable and reload Nginx:

```bash
sudo ln -sf /etc/nginx/sites-available/media-catalog-ui /etc/nginx/sites-enabled/media-catalog-ui
sudo nginx -t
sudo systemctl reload nginx
```

6. Open the app in your browser:

```text
http://YOUR_PI_IP/
```

If your Flask backend runs on the same Pi, change:

```text
proxy_pass http://192.168.50.112:8001/;
```

to:

```text
proxy_pass http://127.0.0.1:8001/;
```

## Test

```bash
npm run test:run
```

## Backend Smoke Test

Runs quick checks against the configured backend host:

```bash
npm run smoke
```

To target a different backend:

```bash
BACKEND_BASE_URL=http://your-host:8001 npm run smoke
```

## Keyboard Shortcuts

- `Ctrl/Cmd+K`: focus movie search input
- `Ctrl/Cmd+Enter`: submit create-item form
- `Alt+Left` / `Alt+Right`: previous/next catalog page
