import { config } from "@/config.js";
import { startServer } from "@/server.js";

await startServer(config.server);
