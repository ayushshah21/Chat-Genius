export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_APP_BACKEND_URL,
    GOOGLE_OAUTH_URL: import.meta.env.VITE_APP_GOOGLE_OAUTH_URL,
    ENDPOINTS: {
        AUTH: {
            LOGIN: '/api/auth/login',
            REGISTER: '/api/auth/register',
            LOGOUT: '/api/auth/logout',
            PROTECTED: '/api/auth/protected',
            GOOGLE: '/api/auth/google',
            GOOGLE_CALLBACK: '/api/auth/google/callback'
        },
        CHANNELS: {
            LIST: '/api/channels',
            CREATE: '/api/channels',
            GET: (id: string) => `/api/channels/${id}`,
            JOIN: (id: string) => `/api/channels/${id}/join`,
            LEAVE: (id: string) => `/api/channels/${id}/leave`,
            CREATE_DM: '/api/channels/dm',
        },
        USER: {
            PROFILE: '/api/user/profile',
            SETTINGS: '/api/user/settings'
        },
        MESSAGES: {
            CREATE: '/api/messages',
            CHANNEL: '/api/messages/channel',
        },
        USERS: {
            AVAILABLE: '/api/users/available',
        },
        DIRECT_MESSAGES: {
            CREATE: '/api/direct-messages',
            GET: (otherUserId: string) => `/api/direct-messages/${otherUserId}`,
        }
    }
}; 