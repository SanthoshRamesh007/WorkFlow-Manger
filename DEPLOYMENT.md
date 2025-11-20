# One Cre - Deployment Guide

## Project Structure

```
One_Cre/
 frontend/          # React application
    src/
    public/
    package.json
 backend/           # Node.js/Express server
     services/
     uploads/
     server.js
     package.json
```

## Local Development

### Backend Setup

1. Navigate to backend folder:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Create `.env` file:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workspaceApp
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

4. Start the server:
```bash
npm start
```

Backend runs on: http://localhost:5000

### Frontend Setup

1. Navigate to frontend folder:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

Frontend runs on: http://localhost:3000

## Production Deployment

### Backend Deployment (Render, Heroku, Railway, etc.)

1. Push backend folder to a Git repository
2. Set environment variables on your hosting platform
3. Deploy command: `npm start`
4. Ensure MongoDB is accessible (MongoDB Atlas recommended)

### Frontend Deployment (Vercel, Netlify, etc.)

1. Build the production version:
```bash
cd frontend
npm run build
```

2. Update `src/config/api.js` with your backend URL:
```javascript
export const API_BASE_URL = 'https://your-backend-url.com';
```

3. Deploy the `build/` folder to your hosting service

### Environment Variables for Production

**Backend:**
- `PORT` - Server port (usually provided by host)
- `MONGODB_URI` - MongoDB connection string
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth secret
- `EMAIL_USER` - Email for notifications
- `EMAIL_PASS` - Email app password

**Frontend:**
- Update `API_BASE_URL` in `src/config/api.js`

## CORS Configuration

Ensure your backend allows requests from your frontend domain. Update `server.js` CORS settings:

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'https://your-frontend-domain.com'
];
```

## MongoDB Setup

For production, use MongoDB Atlas (cloud):
1. Create free cluster at mongodb.com/atlas
2. Get connection string
3. Update `MONGODB_URI` in backend `.env`

## File Uploads

The `uploads/` folder stores user attachments. For production:
- Use cloud storage (AWS S3, Cloudinary, etc.) recommended
- Or ensure hosting service supports persistent file storage

## Testing Deployment

1. Start backend
2. Start frontend
3. Test:
   - User registration/login
   - Workspace creation
   - File uploads
   - Google OAuth (if configured)

## Recommended Hosting

- **Backend**: Render, Railway, Heroku
- **Frontend**: Vercel, Netlify, GitHub Pages
- **Database**: MongoDB Atlas
- **File Storage**: AWS S3, Cloudinary
