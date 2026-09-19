// Vercel API entry for the ProExam Express backend.
//
// This file lives at the repo root under `api/` so that Vercel's Vite
// project (frontend) automatically bundles it as a serverless function with
// @vercel/node. Every `/api/*` request from the SPA is rewritten to this
// handler, which forwards Vercel's WHATWG Request/Response into the full
// Express app (built in backend/src/app.ts, WITHOUT app.listen()).
import app from "../backend/src/app.js";

export default async (req: any, res: any) => {
    app(req, res);
};
