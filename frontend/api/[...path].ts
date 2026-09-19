// Vercel catch-all API entry for the ProExam Express backend.
//
// `api/index.ts` only maps to the literal route `/api/`. Subpaths such as
// /api/health, /api/auth/login, /api/exams/:id are NOT covered by that, so
// Vercel returns its own 404 for them. This catch-all (`[...path]`) maps to
// `/api/*` and forwards every subpath to the Express app.
//
// Vercel passes the matched subpath segments as `query.path` (an array), so
// we reconstruct the real URL that Express expects (e.g. "/api/auth/login")
// and hand Vercel's WHATWG Request/Response to the Express app.
//
// NOTE: Not type-checked by the frontend `tsc` build (frontend/tsconfig.json
// excludes `api/`). Vercel's @vercel/node bundler compiles the source .ts
// directly; the backend's runtime deps are mirrored into
// frontend/package.json so they resolve at bundle time.
import app from "../backend/src/app.js";

export default async function handler(req: any, res: any, ctx: any) {
    // ctx.query.path is an array of subpath segments (e.g. ["auth", "login"]).
    // Rebuild the full path the Express app expects after "/api".
    const segments: string[] = ctx?.query?.path ?? [];
    const subpath = segments.map((s) => decodeURIComponent(s)).join("/");
    const targetPath = "/api" + (subpath ? "/" + subpath : "") + req.url?.split("?")[1] ?? "";

    // Express middleware reads req.url; point it at the reconstructed path.
    req.url = targetPath;

    // Preserve the original request URL so the client-facing response still
    // reflects the real location (Express uses req.url only for routing).
    return app(req, res);
}
