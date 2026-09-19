import app from "./app.js";
import { env } from "./config/env.js";

// Start server
const server = app.listen(env.PORT, () => {
    console.log(`🚀 ProExam API running on http://localhost:${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
    console.log(`   CORS origin: ${env.CORS_ORIGIN}`);
});

// Graceful shutdown
process.on("SIGTERM", () => {
    console.log("Shutting down...");
    server.close(() => {
        process.exit(0);
    });
});

process.on("SIGINT", () => {
    console.log("Shutting down...");
    server.close(() => {
        process.exit(0);
    });
});

export default app;
