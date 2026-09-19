// Vercel API entry for the ProExam Express backend.
// Lives inside the Vite frontend project so @vercel/node bundles it in the
// same Vercel deployment. Every /api/* request is forwarded here, which
// imports the full Express app (source: backend/src/app.ts, WITHOUT
// app.listen()) and forwards Vercel's WHATWG Request/Response into it.
//
// NOTE: This file is intentionally not type-checked by the frontend `tsc`
// build (frontend/tsconfig.json excludes `api/`). Vercel's @vercel/node
// bundler (esbuild, platform=node) compiles the source .ts directly. The
// backend's runtime deps (express, pg, cors, ...) are mirrored into
// frontend/package.json so @vercel/node resolves them from
// frontend/node_modules at bundle time.
import app from "../../backend/src/app.js";

export default async (req: any, res: any) => {
    app(req, res);
};
