import { createAppServer } from "./http.js";

const port = Number.parseInt(process.env.PORT ?? "8787", 10);
const host = process.env.HOST ?? "127.0.0.1";
const server = await createAppServer();
await server.start(port, host);

console.log(`Jettis Game server listening on http://${host}:${port}`);
