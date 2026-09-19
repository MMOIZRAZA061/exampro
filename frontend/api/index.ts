// Vercel API entry for the ProExam Express backend.
// Lives inside the Vite frontend project so @vercel/node bundles it in the
// same Vercel deployment. Vercel maps `api/index.ts` to the `/api/` route and
// `api/[...path].ts` to `/api/*` (catch-all subpaths like /api/auth/login).
// We import the full Express app (source: ../backend/src/app.ts, WITHOUT
// app.listen()) and forward Vercel's WHATWG Request/Response into it.
//
// NOTE: This file is intentionally not type-checked by the frontend `tsc`
// build (frontend/tsconfig.json excludes `api/`). Vercel's @vercel/node
// bundler (esbuild, platform=node) compiles the source .ts directly. The
// backend's runtime deps (express, pg, cors, ...) are mirrored into
// frontend/package.json so @vercel/node resolves them from
// frontend/node_modules at bundle time.
import app from "../backend/src/app.js";

export default async function handler(req: any, res: any) {
    app(req, res);
}
