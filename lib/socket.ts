import { io, Socket } from "socket.io-client";

const SOCKET_IO_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

let socketIoInstance: Socket | null = null;
let activeMint: string | null = null;

export function getSocketIo(): Socket {
  if (!socketIoInstance) {
    console.log(
      `[Socket.IO Client] Initializing connection to: ${SOCKET_IO_URL}`,
    );
    const socket = io(SOCKET_IO_URL, {
      path: "/socket.io",
      transports: ["polling", "websocket"], // Allow fallback polling to bypass strict websocket blocks
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: Infinity,
      auth: {
        apiKey: process.env.NEXT_PUBLIC_API_KEY,
      },
    });

    socketIoInstance = socket;

    socket.on("connect", () => {
      console.log(
        `[Socket.IO Client] ✅ Connected successfully! ID: ${socket.id}`,
      );
      // Automatically re-register the active coin room with the backend upon connection or reconnection
      if (activeMint) {
        console.log(
          `[Socket.IO Client] 🔄 Re-registering active coin room on connect: ${activeMint}`,
        );
        socket.emit("join_coin_room", activeMint);
      }
    });

    socket.on("connect_error", (err) => {
      console.error(`[Socket.IO Client] ❌ Connection error:`, err.message);
    });

    socket.on("disconnect", (reason) => {
      console.warn(`[Socket.IO Client] ⚠️ Disconnected. Reason:`, reason);
    });
  }
  return socketIoInstance;
}

export function joinCoinRoom(mint: string) {
  if (!mint) return;
  activeMint = mint;
  const socket = getSocketIo();

  const performJoin = () => {
    console.log(
      `[Socket.IO Client] 🔵 Emitting 'join_coin_room' for mint: ${mint}`,
    );
    socket.emit("join_coin_room", mint);
  };

  if (socket.connected) {
    performJoin();
  } else {
    console.log(
      `[Socket.IO Client] ⏳ Socket not connected. Queueing 'join_coin_room' for mint: ${mint}`,
    );
    socket.once("connect", performJoin);
  }
}

export function leaveCoinRoom(mint: string) {
  if (!mint) return;
  if (activeMint === mint) {
    activeMint = null;
  }
  const socket = getSocketIo();
  console.log(
    `[Socket.IO Client] 🔴 Emitting 'leave_coin_room' for mint: ${mint}`,
  );
  socket.emit("leave_coin_room", mint);
}
