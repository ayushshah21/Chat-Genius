import { io } from "socket.io-client";
import { API_CONFIG } from "../config/api.config";

export const socket = io(API_CONFIG.BASE_URL, {
    withCredentials: true,
    auth: {
        token: localStorage.getItem('token')
    }
}); 