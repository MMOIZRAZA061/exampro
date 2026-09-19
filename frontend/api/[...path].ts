// Vercel catch-all API entry for the ProExam Express backend.
//
// `api/index.ts` only maps to the literal route `/api/`. Subpaths such as
// /api/health, /api/auth/login, /api/exams/:id are NOT covered by that, so
// Vercel returns its own 404 for them. This catch-all (`[...path]`) maps to
// `/api/*` and forwards every subpath to the Express app.
//
// Vercel sets `req.url` on the incoming request to the FULL path that the
// client requested, e.g. "/api/health" (plus any query string). So we do NOT
// need to prepend "/api" again — `req.url` is already the exact URL Express's
// router expects. We just hand Vercel's WHATWG Request/Response straight into
// the Express app; no URL rewriting is required.
//
// NOTE: Not type-checked by the frontend `tsc` build (frontend/tsconfig.json
// excludes `api/`). Vercel's @vercel/node bundler compiles the source .ts
// directly; the backend's runtime deps are mirrored into
// frontend/package.json so they resolve at bundle time.
import app from "../backend/src/app.js";

export default async function handler(req: any, res: any, _ctx: any) {
    // req.url already carries the full client path (e.g. "/api/health?x=1"),
    // which is exactly what Express routes on. Pass the request through as-is.
    app(req, res);
}
