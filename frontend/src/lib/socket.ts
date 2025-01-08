import { io } from "socket.io-client";
import { API_CONFIG } from "../config/api.config";

// Initialize socket with autoConnect: false
const socket = io(API_CONFIG.BASE_URL, {
    autoConnect: false,
});

export const initSocket = (token: string) => {
    if (token) {
        socket.auth = { token };
        if (!socket.connected) {
            socket.connect();
        }
    }
    return socket;
};

export const disconnectSocket = () => {
    if (socket.connected) {
        socket.disconnect();
    }
};

export { socket }; 