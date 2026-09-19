// Vercel serverless entry point.
//
// This file is the handler Vercel's @vercel/node bundler compiles. It imports
// the full Express app (built in src/app.ts, WITHOUT app.listen()) and
// forwards Vercel's WHATWG Request/Response into it.
//
// Relative paths below resolve against this file's location (backend/api/),
// which is correct both in the source tree and after @vercel/node bundles it.
import app from "../src/app.js";

// Vercel handler: forward Vercel's WHATWG Request/Response into Express.
export default async (req: any, res: any) => {
    app(req, res);
};
