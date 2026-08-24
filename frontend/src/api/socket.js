import { io } from "socket.io-client";

// Same-origin in production (served by Express); Vite proxy doesn't cover
// websockets by default so we point directly at the API origin in dev.
const isDev = window.location.port === "5173";
const SOCKET_URL = isDev ? "http://localhost:4000" : window.location.origin;

export const socket = io(SOCKET_URL, { autoConnect: true, transports: ["websocket", "polling"] });
