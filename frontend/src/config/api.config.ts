export const API_CONFIG = {
    BASE_URL: import.meta.env.VITE_APP_BACKEND_URL || "http://localhost:4000",
    GOOGLE_OAUTH_URL: import.meta.env.VITE_APP_GOOGLE_OAUTH_URL || "http://localhost:4000/api/auth/google",
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
        MESSAGES: {
            CHANNEL: '/api/messages/channel',
            CREATE: '/api/messages',
            THREAD: (parentId: string) => `/api/messages/thread/${parentId}`,
        },
        DIRECT_MESSAGES: {
            CREATE: '/api/direct-messages',
            GET: (userId: string) => `/api/direct-messages/${userId}`,
            THREAD: (parentId: string) => `/api/direct-messages/thread/${parentId}`,
        },
        USERS: {
            AVAILABLE: '/api/users/available',
            PROFILE: '/api/users/profile',
            UPDATE: '/api/users/update'
        },
        SEARCH: {
            ALL: '/api/search',
            MESSAGES: '/api/search/messages',
            DIRECT_MESSAGES: '/api/search/direct-messages',
            AI: '/api/search/ai'
        },
        FILES: {
            UPLOAD_URL: '/api/files/upload-url',
            DOWNLOAD_URL: (fileId: string) => `/api/files/download-url/${fileId}`,
            UPDATE_METADATA: (fileId: string) => `/api/files/${fileId}/metadata`
        },
        AI: {
            SEARCH: '/api/ai/search'
        }
    }
}; 