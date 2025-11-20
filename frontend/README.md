# One Cre - Frontend

React frontend for One Cre workspace management application.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Update API configuration in `src/config/api.js` if backend is hosted elsewhere.

3. Start the development server:
```bash
npm start
```

The app will open at http://localhost:3000

## Build for Production

```bash
npm run build
```

This creates an optimized production build in the `build/` folder.

## Environment Variables

The frontend connects to the backend via the proxy configuration in package.json.

For production, update `src/config/api.js` with your backend URL.

## Features

- User authentication (Email/Password & Google OAuth)
- Workspace management
- Task tracking with drag-and-drop
- File attachments
- Team collaboration
- Admin dashboard
- Real-time notifications

## Tech Stack

- React 19
- React Router
- Framer Motion (animations)
- Drag & Drop Kit
- Axios (API calls)
