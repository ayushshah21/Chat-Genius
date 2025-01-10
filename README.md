# ChatGenius

ChatGenius is a modern real-time chat application built with React, Node.js, and WebSocket technology. It features direct messaging, channels, thread replies, file sharing, and theme customization.

## 🌐 Live Demo

Access the live application at: [https://chat-genius.onrender.com](https://chat-genius.onrender.com)

## 🚀 Deployment Information

The application is deployed using the following setup:

### Frontend

- Hosted on Render.com
- Automatically deploys from the `main` branch
- Built with React + TypeScript + Vite

### Backend

- Node.js server hosted on Render.com
- WebSocket support for real-time communication
- PostgreSQL database (managed by Render.com)

### File Storage

- AWS S3 for file uploads and storage
- Secure, signed URLs for file access

## 🔑 Access Information

### User Registration

1. Visit [https://chat-genius.onrender.com](https://chat-genius.onrender.com)
2. Click "Register" to create a new account
3. Sign up using email/password or Google OAuth

### Available Features

- Real-time messaging in channels and direct messages
- Thread replies and emoji reactions
- File sharing (images, PDFs, and other documents)
- User status indicators (online/offline)
- Multiple theme options (Ocean, Forest, Dark, Slack, etc.)
- Message search functionality
- User profile customization

## 💻 Local Development

### Prerequisites

- Node.js v18 or higher
- PostgreSQL
- AWS S3 bucket (for file storage)

### Setup Instructions

1. Clone the repository:

```bash
git clone https://github.com/yourusername/Chat-Genius.git
cd Chat-Genius
```

2. Frontend setup:

```bash
cd frontend
npm install
npm run dev
```

3. Backend setup:

```bash
cd backend
npm install
npm run dev
```

4. Environment variables:
Create `.env` files in both frontend and backend directories with the necessary configuration (see `.env.example` files).

## 📝 Notes

- The application uses WebSocket connections for real-time updates
- File uploads are limited to 5MB per file
- Supported file types: images, PDFs, and common document formats
- The application automatically reconnects if the WebSocket connection is lost

## 🤝 Contributing

Feel free to submit issues and enhancement requests!
