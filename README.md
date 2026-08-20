# Journeys

A self-hosted app for turning your travel GPS traces and photos into shareable journeys: import GPX/FIT/TCX tracks or a Google Timeline export, geotag your photos, and browse everything on a map and timeline organized into journeys and sections.

## Features

- **Trace import** — GPX, FIT, TCX, and Google Timeline exports, matched to roads/rail via OSRM and Overpass route lookups
- **Photo library** — EXIF-preserving upload with automatic geotagging against your traces
- **Journeys & sections** — organize activities and photos into trips with a map + timeline view
- **Sharing** — generate share links for journeys
- **Admin** — user management, bootstrap admin account
- **Android app** — native Capacitor wrapper with an EXIF-preserving photo picker, chunked background upload with progress notification, and a branded offline screen when the server is unreachable

## Stack

- [Nuxt 4](https://nuxt.com/) (Vue 3, Pinia) for the app and API routes
- PostgreSQL + PostGIS, via [Drizzle ORM](https://orm.drizzle.team/)
- [Graphile Worker](https://worker.graphile.org/) for background jobs (imports, geocoding, thumbnails)
- Local disk or S3-compatible storage for photos
- [Capacitor](https://capacitorjs.com/) for the Android app

## Development

Requires Docker.

```bash
cp .env.example .env
docker compose watch
```

This starts the app (`web`), background job `worker`, and `postgres`, running migrations first. The app is served at http://localhost:3000. Edits to `app/`, `server/`, and `shared/` sync live.

Without Docker, you'll need a local Postgres/PostGIS instance and a `DATABASE_URL` in `.env`, then:

```bash
npm install
npm run db:migrate
npm run dev        # app, http://localhost:3000
npm run worker:dev # background job worker, in a separate terminal
```

### Other scripts

```bash
npm run typecheck   # nuxt typecheck
npm test            # vitest run
npm run test:watch
npm run db:generate # generate a new Drizzle migration from schema changes
```

## Production deployment

Requires Docker and Docker Compose on the host (e.g. Unraid, or any Linux box).

1. **Clone the repo** on the host:

   ```bash
   git clone https://github.com/remco59/Journeys.git
   cd Journeys
   ```

2. **Create and edit `.env`**:

   ```bash
   cp .env.example .env
   ```

   At minimum, set real values for:
   - `POSTGRES_PASSWORD` — database password
   - `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` — credentials for the admin account created automatically on first boot (see step 4)
   - `APPDATA_PATH` — host path for persistent data, e.g. `/mnt/user/appdata/journeys` on Unraid (defaults to `./data` if unset)
   - `WEB_PORT` — host port to publish the app on (defaults to `3000`)

   Leave the geocoding/routing/tile provider URLs as-is unless you want to point at your own instances.

3. **Build and start the stack**:

   ```bash
   docker compose -f compose.prod.yml up -d --build
   ```

   This builds the `web` and `worker` images, runs database migrations (`migrate`), and starts Postgres, the app, and the background worker. First boot takes a minute or two while images build and the app becomes healthy.

4. **Sign in for the first time**: open `http://<host>:<WEB_PORT>` in a browser and log in with the `BOOTSTRAP_ADMIN_USERNAME` / `BOOTSTRAP_ADMIN_PASSWORD` you set in `.env`. This account is created once, automatically, the first time the app boots with no existing users — it won't be recreated or reset on later restarts. Change the password from the settings page after logging in.

Postgres data, uploaded photos, and `.env` are the only state that needs to survive a redeploy or host migration.

To update later, pull the latest source and rebuild/restart the stack in one step:

```bash
./docker/update.sh
```

(equivalent to `git pull && docker compose -f compose.prod.yml up -d --build`, run from the repo root on the host).

## Android app

The `android/` directory is a Capacitor project wrapping the web app, pointed at the production URL in [capacitor.config.ts](capacitor.config.ts). It adds native functionality on top of the web app:

- An EXIF-preserving photo picker (`PhotoAccessPlugin`, `PhotoPickerActivity`) for selecting photos to geotag and upload
- A foreground `PhotoUploadService` that chunks and uploads selected photos in the background with a progress notification
- A branded offline screen (native `offline.html` plus a Vue `OfflineState` fallback) shown instead of the stock browser error page when the server is unreachable, auto-reloading once connectivity returns
