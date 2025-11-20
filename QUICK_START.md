# One Cre - Quick Start Guide

##  Project Successfully Separated!

Your application is now split into two independent folders:

```
One_Cre/
 frontend/     # React frontend (Port 3000)
 backend/      # Node.js backend (Port 5000)
 fullstack/    # Original (can be deleted)
 DEPLOYMENT.md # Deployment instructions
```

##  Running Locally

### Step 1: Start Backend

```bash
cd backend
npm install
npm start
```

 Backend running at: http://localhost:5000

### Step 2: Start Frontend (New Terminal)

```bash
cd frontend
npm install
npm start
```

 Frontend running at: http://localhost:3000

##  What's Included

### Frontend Folder
-  All React components (`src/`)
-  Public assets (`public/`)
-  Clean package.json (React dependencies only)
-  Proxy configured to backend

### Backend Folder
-  Express server (`server.js`)
-  Email services (`services/`)
-  File uploads (`uploads/`)
-  Clean package.json (Backend dependencies only)
-  `.env.example` for configuration

##  Hosting Options

### Recommended Platforms

**Frontend:**
- Vercel (Recommended) - Free tier available
- Netlify - Free tier available
- GitHub Pages

**Backend:**
- Render (Recommended) - Free tier available
- Railway - Free tier available  
- Heroku

**Database:**
- MongoDB Atlas (Free tier available)

##  Important Files

### Backend `.env` (Create this file)
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/workspaceApp
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password
```

### Frontend API Configuration
File: `frontend/src/config/api.js`

For production, update the API URL:
```javascript
export const API_BASE_URL = 'https://your-backend-url.com';
```

##  Deployment Checklist

**Before Deploying:**
- [ ] Create MongoDB Atlas database
- [ ] Update backend CORS with frontend URL
- [ ] Set all backend environment variables
- [ ] Update frontend API_BASE_URL
- [ ] Build frontend: `npm run build`
- [ ] Test both separately

**After Deploying:**
- [ ] Test user registration
- [ ] Test workspace creation
- [ ] Test file uploads
- [ ] Test Google OAuth (if configured)

##  Troubleshooting

**CORS Issues:**
- Update `server.js` CORS allowedOrigins with your frontend URL

**API Not Connecting:**
- Check frontend `src/config/api.js`
- Ensure backend is running
- Check browser console for errors

**File Uploads Not Working:**
- Check `uploads/` folder permissions
- For production, consider cloud storage

##  Full Documentation

See `DEPLOYMENT.md` for detailed deployment instructions.

##  Ready to Deploy!

Your app is now properly separated and ready for individual deployment to any hosting platform!
