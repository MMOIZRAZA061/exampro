// Vercel catch-all API entry for the ProExam Express backend.
//
// `api/index.ts` only maps to the literal route `/api/`. Subpaths such as
// /api/health, /api/auth/login, /api/exams/:id are NOT covered by that, so
// Vercel returns its own 404 for them. This catch-all (`[...path]`) maps to
// `/api/*` and forwards every subpath to the Express app.
//
// The matched subpath is recovered from the incoming request: Vercel sets
// `req.url` to the subpath (e.g. "health" or "auth/login") when the request
// lands at /api/<subpath>. If that is empty, we fall back to the documented
// `arg.path` / `query.path` array. The real Express URL is reconstructed as
// "/api/<subpath>[?query]" and handed to the Express app.
//
// NOTE: Not type-checked by the frontend `tsc` build (frontend/tsconfig.json
// excludes `api/`). Vercel's @vercel/node bundler compiles the source .ts
// directly; the backend's runtime deps are mirrored into
// frontend/package.json so they resolve at bundle time.
import app from "../backend/src/app.js";

export default async function handler(req: any, res: any, ctx: any) {
    // 1) Best source of truth: req.url on a catch-all is the subpath
    //    Vercel matched (e.g. "/health" or "/auth/login"), optionally with query.
    let sub = "";
    let query = "";

    const rawUrl: string = req?.url || "";
    const qsIdx = rawUrl.indexOf("?");
    if (qsIdx >= 0) {
        sub = rawUrl.slice(0, qsIdx);
        query = rawUrl.slice(qsIdx + 1); // strip leading "?"
    } else {
        sub = rawUrl;
    }

    // Normalise: drop leading slash, join back under /api.
    sub = sub.replace(/^\/+/, "");

    // 2) Fallback: some Vercel builds pass the segments as arg.path / query.path.
    if (!sub) {
        const rawSegments: any =
            ctx?.query?.path || req?.query?.path || (ctx && (ctx as any).path) || [];
        const segments: string[] = Array.isArray(rawSegments) ? rawSegments : [];
        sub = segments.map((s) => String(s)).join("/");
    }

    // 3) Reconstruct the full Express URL, e.g. "/api/health?x=1".
    const targetPath =
        "/api" + (sub ? "/" + sub : "") + (query ? "?" + query : "");

    // Point Express at the reconstructed URL so its router matches /api/<sub>.
    req.url = targetPath;
    (req as any).originalUrl = targetPath;

    // Hand Vercel's WHATWG Request/Response straight into the Express app.
    app(req, res);
}
