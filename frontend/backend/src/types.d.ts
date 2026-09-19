declare var __dirname: string;
declare var process: {
    env: Record<string, string | undefined>;
    exit(code?: number): never;
    on(event: string, listener: (...args: any[]) => void): void;
};

declare module "dotenv" {
    export function config(options?: { path?: string }): { parsed?: Record<string, string> };
}
