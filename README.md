# Journeys

A self-hosted app for turning your travel GPS traces and photos into shareable journeys: import GPX/FIT/TCX tracks or a Google Timeline export, geotag your photos, and browse everything on a map and timeline organized into journeys and sections.

## Features

- **Trace import** — GPX, FIT, TCX, and Google Timeline exports, matched to roads/rail via OSRM and Overpass route lookups
- **Photo library** — EXIF-preserving upload with automatic geotagging against your traces
- **Journeys & sections** — organize activities and photos into trips with a map + timeline view
- **Sharing** — generate share links for journeys
- **Admin** — user management, bootstrap admin account
- **Android app** — native Capacitor wrapper with an EXIF-preserving photo picker

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

See the header comment in [compose.prod.yml](compose.prod.yml). Broadly:

```bash
cp .env.example .env   # set real passwords, APPDATA_PATH, etc.
docker compose -f compose.prod.yml up -d --build
```

Postgres data, uploaded photos, and `.env` are the only state that needs to survive a redeploy or host migration.

## Android app

The `android/` directory is a Capacitor project wrapping the web app. See [capacitor.config.ts](capacitor.config.ts) for configuration.
