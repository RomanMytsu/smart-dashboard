# Kharkiv Smart Dashboard

Technical foundation for the Kharkiv Smart Dashboard, built with React, TypeScript, Vite, and Sass.

## Commands

- `pnpm dev` starts Vercel's local development server and the Vite app, including the `api/*.ts` functions.
- `pnpm typecheck` checks application and Vite configuration types.
- `pnpm build` creates the production build.

## Local environment

Add `WEATHER_API_KEY` and `ALERTS_IN_UA_TOKEN` to the ignored `.env.local` file. These are server-only secrets used by the weather and air-alert API functions. Do not add their values to client-side `VITE_*` variables.

For alert widget scenarios, set `VITE_ALERT_TEST_MODE=true` in `.env.local` during local development, then open the app with one of these query parameters: `?alertTest=missile`, `?alertTest=drone`, `?alertTest=artillery`, `?alertTest=multiple`, `?alertTest=unknown`, or `?alertTest=empty`. The flag is only honored in local development and Vercel Preview deployments. On Vercel, configure it for the Preview environment only; Production builds ignore it.

The first local Vercel CLI run requires the project to be linked with `vercel link` if it is not already linked. The CLI loads local secrets from `.env.local`.

Production JavaScript and CSS target Chrome 81. Use a modern desktop browser for the Vite development server.
