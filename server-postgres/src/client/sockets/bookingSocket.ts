import { Server, Socket } from "socket.io";
import { verifyToken } from "../../utils/jwt";

let ioInstance: Server | null = null;

export const setBookingSocketInstance = (io: Server): void => {
  ioInstance = io;
};

export const getBookingSocketInstance = (): Server | null => ioInstance;

export const setupBookingSocket = (io: Server): void => {
  const bookingNamespace = io.of("/bookings");

  // Optional: Add authentication if needed
  // bookingNamespace.use((socket: Socket, next) => { ... });

  bookingNamespace.on("connection", (socket: Socket) => {
    // Clients subscribe to specific venue updates
    socket.on("subscribe_venue", (venueId: string) => {
      socket.join(`venue:${venueId}`);
    });

    socket.on("unsubscribe_venue", (venueId: string) => {
      socket.leave(`venue:${venueId}`);
    });

    socket.on("disconnect", () => {
      // Cleanup handled automatically by socket.io
    });
  });
};

export const emitSlotLocked = (
  venueId: string,
  payload: { slotStartTime: string; dateKey: string },
): void => {
  if (ioInstance) {
    ioInstance
      .of("/bookings")
      .to(`venue:${venueId}`)
      .emit("slot_locked", payload);
  }
};
