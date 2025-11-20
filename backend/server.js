// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const session = require('express-session');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { sendTaskAssignmentEmail, testEmailConfiguration } = require('./services/emailService');
const app = express();

// Define PORT early so it can be used in helper functions
const PORT = process.env.PORT || 5000;

// Get dynamic base URLs
const getServerBaseUrl = (req) => {
  const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http';
  const host = req.get('host') || `localhost:${PORT}`;
  return `${protocol}://${host}`;
};

const getFrontendBaseUrl = (req) => {
  const serverUrl = getServerBaseUrl(req);
  // If server is on port 5000, frontend is likely on 3000
  if (serverUrl.includes(':5000')) {
    return serverUrl.replace(':5000', ':3000');
  }
  // For forwarded ports, assume frontend is on the same host but different port
  const host = req.get('host') || `localhost:${PORT}`;
  if (host.includes('devtunnels.ms') || host.includes('ngrok') || host.includes('localhost.run')) {
    // For tunneling services, assume they handle port forwarding
    return serverUrl.replace(':5000', ':3000');
  }
  return serverUrl.replace(':5000', ':3000');
};

// Treat these emails as admins automatically
const ADMIN_EMAILS = ['santhoshr.23it@kongu.edu', 'venmugil182005@gmail.com'];

// MIDDLEWARE SETUP - Must be BEFORE routes
app.use(express.json());
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000',
      'https://t7wg8mdq-3000.inc1.devtunnels.ms'
    ];
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow dev tunnels and common tunneling services
    if (origin.includes('devtunnels.ms') || 
        origin.includes('ngrok.io') || 
        origin.includes('localhost.run') ||
        origin.includes('tunnelmole.net') ||
        origin.includes('serveo.net')) {
      return callback(null, true);
    }
    
    // Allow localhost with any port for development
    if (origin.match(/^https?:\/\/localhost:\d+$/)) {
      return callback(null, true);
    }
    
    // Allow same host different port (for port forwarding scenarios)
    try {
      const originUrl = new URL(origin);
      if (originUrl.hostname === 'localhost' || 
          originUrl.hostname.endsWith('.local') ||
          originUrl.hostname.match(/^\d+\.\d+\.\d+\.\d+$/)) { // IP addresses
        return callback(null, true);
      }
    } catch (e) {
      // Invalid URL, continue to block
    }
    
    // Log rejected origins for debugging
    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true
}));
app.use(session({ 
  secret: 'your_secret_key_change_in_production', 
  resave: false, 
  saveUninitialized: false,
  cookie: {
    secure: false, // Set to true if using HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));
app.use(passport.initialize());
app.use(passport.session());

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/workspaceApp');

app.get('/api/user/:email', async (req, res) => {
  const { email } = req.params;
  const emailLower = (email || '').toLowerCase();
  try {
    const user = await User.findOne({ email: emailLower });
    if (user) {
      res.json({ name: user.name, email: user.email });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
});

// Update user name endpoint
app.put('/api/user/:email', async (req, res) => {
  const { email } = req.params;
  const { name } = req.body;
  const emailLower = (email || '').toLowerCase();
  
  try {
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ message: 'Name is required' });
    }

    const user = await User.findOneAndUpdate(
      { email: emailLower },
      { name: name.trim() },
      { new: true, upsert: true }
    );

    if (user) {
      await logActivity('profile_update', emailLower, `Updated name to: ${name.trim()}`, { oldName: user.name }, req);
      res.json({ name: user.name, email: user.email, message: 'Name updated successfully' });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error updating user', error: err.message });
  }
});

mongoose.connection.on('connected', () => {
  console.log('MongoDB connected successfully');
});

mongoose.connection.on('error', (err) => {
  console.log('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected');
});

// Activity Schema for Real-time Monitoring
const ActivitySchema = new mongoose.Schema({
  type: { type: String, required: true }, // 'login', 'signup', 'workspace_created', 'task_completed', etc.
  user: { type: String, required: true }, // user email or name
  description: { type: String, required: true },
  metadata: { type: Object, default: {} }, // additional data
  timestamp: { type: Date, default: Date.now },
  ip: String,
  userAgent: String
});

const Activity = mongoose.model('Activity', ActivitySchema);

// Helper function to log activities
async function logActivity(type, user, description, metadata = {}, req = null) {
  try {
    const activity = new Activity({
      type,
      user,
      description,
      metadata,
      ip: req ? (req.ip || req.connection.remoteAddress) : 'system',
      userAgent: req ? req.get('User-Agent') : 'system'
    });
    await activity.save();
    console.log(`📊 Activity logged: ${type} - ${user} - ${description}`);
  } catch (error) {
    console.error('❌ Failed to log activity:', error);
  }
}

// Schemas
const UserSchema = new mongoose.Schema({
  name: String,
  email: String,
  password: String, // Store hashed password in production
  googleId: String, // For Google OAuth users
});

// add role to user schema to support admin vs normal users
UserSchema.add({
  role: { type: String, enum: ['user', 'admin'], default: 'user' }
});

const TaskSchema = new mongoose.Schema({
  title: String,
  status: String,
  // attachments will store metadata for uploaded files
  attachments: [{ filename: String, originalName: String, url: String }],
  // optional fields used by frontend
  assignedTo: { type: String, default: '' },
  userStories: { type: String, default: '' },
  startDate: { type: Date },
  endDate: { type: Date }
});

const MilestoneSchema = new mongoose.Schema({
  title: String,
  tasks: [TaskSchema],
});

const GoalSchema = new mongoose.Schema({
  title: String,
  // priority: High / Medium / Low
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  milestones: [MilestoneSchema],
});

const WorkspaceSchema = new mongoose.Schema({
  name: String,
  owner: String, // Email of the workspace creator/owner
  members: [String], // Array of user emails
  goals: [GoalSchema],
});


const User = mongoose.model('User', UserSchema);
const Workspace = mongoose.model('Workspace', WorkspaceSchema);

// Helper function to check for task assignments and send emails
const checkAndSendTaskAssignmentEmails = async (oldWorkspace, newWorkspace, assignedBy) => {
  try {
    // Compare old and new workspace to find newly assigned tasks
    const oldTasks = new Map();
    
    // Build map of old task assignments
    if (oldWorkspace.goals) {
      oldWorkspace.goals.forEach(goal => {
        goal.milestones.forEach(milestone => {
          milestone.tasks.forEach(task => {
            const taskId = task._id.toString();
            oldTasks.set(taskId, {
              assignedTo: task.assignedTo || '',
              title: task.title,
              endDate: task.endDate
            });
          });
        });
      });
    }
    
    // Check new workspace for changed assignments
    if (newWorkspace.goals) {
      newWorkspace.goals.forEach(goal => {
        goal.milestones.forEach(milestone => {
          milestone.tasks.forEach(async (task) => {
            const taskId = task._id.toString();
            const newAssignee = (task.assignedTo || '').trim();
            const oldTask = oldTasks.get(taskId);
            const oldAssignee = oldTask ? oldTask.assignedTo.trim() : '';
            
            // If assignedTo has changed and is now assigned to someone
            if (newAssignee && newAssignee !== oldAssignee) {
              console.log(`📧 Task "${task.title}" assigned to ${newAssignee}`);
              
              // Send email notification
              const result = await sendTaskAssignmentEmail({
                assigneeEmail: newAssignee,
                taskTitle: task.title,
                workspaceName: newWorkspace.name,
                assignedBy: assignedBy || 'system',
                dueDate: task.endDate
              });
              
              if (result.success) {
                console.log(`✅ Task assignment email sent to ${newAssignee}`);
              } else {
                console.error(`❌ Failed to send email: ${result.error}`);
              }
            }
          });
        });
      });
    }
  } catch (error) {
    console.error('❌ Error in checkAndSendTaskAssignmentEmails:', error.message);
  }
};

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

// Multer config for storing uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    const safe = Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
    cb(null, safe);
  }
});

// Add file size limit and file filter
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: function (req, file, cb) {
    // Accept all file types, but you can add restrictions here
    console.log('File upload attempt:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size
    });
    cb(null, true);
  }
});

// Serve uploaded files statically
app.use('/uploads', express.static(uploadsDir));
// Admin endpoints
app.get('/api/admin/users', async (req, res) => {
  // Only allow admin role
  const email = req.user?.email?.toLowerCase() || req.query.email?.toLowerCase();
  let requester = null;
  if (req.user && req.user.role) {
    requester = req.user;
  } else if (email) {
    requester = await User.findOne({ email });
  }
  if (!requester || requester.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const users = await User.find({});
  res.json(users);
});

app.get('/api/admin/workspaces', async (req, res) => {
  const email = req.user?.email?.toLowerCase() || req.query.email?.toLowerCase();
  let requester = null;
  if (req.user && req.user.role) {
    requester = req.user;
  } else if (email) {
    requester = await User.findOne({ email });
  }
  if (!requester || requester.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  const workspaces = await Workspace.find({});
  res.json(workspaces);
});

// Get recent activities (Admin only)
app.get('/api/admin/activities', async (req, res) => {
  try {
    const email = req.user?.email?.toLowerCase() || req.query.email?.toLowerCase();
    let requester = null;
    if (req.user && req.user.role) {
      requester = req.user;
    } else if (email) {
      requester = await User.findOne({ email });
    }
    
    if (!requester || requester.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    
    const activities = await Activity.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(offset);
    
    const totalCount = await Activity.countDocuments();
    
    res.json({
      activities,
      totalCount,
      hasMore: (offset + limit) < totalCount
    });
  } catch (error) {
    console.error('❌ Error fetching activities:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Dev helper: seed an admin user and a sample workspace if not present
app.post('/api/seed-admin', async (req, res) => {
  try {
    let admin = await User.findOne({ role: 'admin' });
    if (!admin) {
      // Create admin user with specified credentials
      admin = new User({ 
        name: 'Santosh R', 
        email: 'santhoshr.23it@kongu.edu',
        password: 'san123san' // In production, this should be hashed
      });
      admin.role = 'admin';
      await admin.save();
    }

    let ws = await Workspace.findOne({ name: 'Sample Workspace' });
    if (!ws) {
      ws = new Workspace({
        name: 'Sample Workspace',
        members: [admin.email.toLowerCase()],
        goals: [
          {
            title: 'Sample Goal',
            milestones: [
              {
                title: 'Milestone 1',
                tasks: [
                  { title: 'Sample Task', status: 'todo', attachments: [], assignedTo: '', userStories: '', startDate: null, endDate: null }
                ]
              }
            ]
          }
        ]
      });
      await ws.save();
    }

    res.json({ admin, workspace: ws });
  } catch (err) {
    console.error('seed-admin error', err);
    res.status(500).json({ error: err.message });
  }
});

// Passport Google OAuth Strategy
passport.use(new GoogleStrategy({
    clientID: '76464894478-t4ts63hdgjr4deio5lmfrcao8ji1bg40.apps.googleusercontent.com',
    clientSecret: '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',
    callbackURL: '/auth/google/callback'  // Use relative URL - will work with any host
  },
  async (accessToken, refreshToken, profile, done) => {
    try {
      console.log('Google OAuth Profile:', {
        id: profile.id,
        displayName: profile.displayName,
        emails: profile.emails
      });

      let user = await User.findOne({ googleId: profile.id });
      const profileEmail = (profile.emails && profile.emails[0] && profile.emails[0].value
        ? profile.emails[0].value.toLowerCase()
        : undefined);

      if (!profileEmail) {
        console.error('No email found in Google profile');
        return done(new Error('No email found in Google profile'), null);
      }

      if (!user) {
        // Check if user exists with same email but no Google ID
        user = await User.findOne({ email: profileEmail });
        if (user) {
          // Link Google ID to existing user
          user.googleId = profile.id;
          if (!user.name) user.name = profile.displayName;
        } else {
          // Create new user
          user = new User({
            name: profile.displayName,
            email: profileEmail,
            googleId: profile.id
          });
        }
      }

      // Set admin role if this is an admin email
      if (ADMIN_EMAILS.includes(profileEmail)) {
        user.role = 'admin';
        console.log('Setting admin role for:', profileEmail);
      } else if (!user.role) {
        user.role = 'user';
      }

      await user.save();
      console.log('User saved successfully:', user.email, 'Role:', user.role);
      
      return done(null, user);
    } catch (err) {
      console.error('Google OAuth error:', err);
      return done(err, null);
    }
  }
));

passport.serializeUser((user, done) => {
  done(null, user.id);
});
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Google OAuth routes
app.get('/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

app.get('/auth/google/callback',
  passport.authenticate('google', { 
    failureRedirect: false,
    successRedirect: false 
  }),
  async (req, res) => {
    try {
      const frontendUrl = getFrontendBaseUrl(req);
      
      // Successful authentication, redirect based on role
      let user = req.user;
      if (!user) {
        console.error('No user found after authentication');
        return res.redirect(`${frontendUrl}/?error=no_user`);
      }
      
      // Refresh user from DB to ensure we have latest data
      user = await User.findById(user.id || user._id);
      if (!user) {
        console.error('User not found in database');
        return res.redirect(`${frontendUrl}/?error=user_not_found`);
      }

      console.log('OAuth success for user:', user.email, 'Role:', user.role);

      // Store user email in session for frontend
      req.session.userEmail = user.email;
      
      if (user.role === 'admin') {
        return res.redirect(`${frontendUrl}/admin`);
      } else {
        return res.redirect(`${frontendUrl}/dashboard`);
      }
    } catch (error) {
      console.error('OAuth callback error:', error);
      const frontendUrl = getFrontendBaseUrl(req);
      return res.redirect(`${frontendUrl}/?error=server_error`);
    }
  }
);

// Sign-in endpoint
// Signup endpoint
app.post('/api/signup', async (req, res) => {
  const { name, email, password } = req.body;
  const emailLower = (email || '').toLowerCase();
  // Check if user already exists
  const existingUser = await User.findOne({ email: emailLower });
  if (existingUser) {
    return res.status(400).json({ success: false, message: 'User already exists' });
  }
  // Create new user
  const newUser = new User({ name, email: emailLower, password, role: ADMIN_EMAILS.includes(emailLower) ? 'admin' : 'user' });
  await newUser.save();
  
  // Log activity
  await logActivity('signup', emailLower, `New user registered: ${name}`, {
    role: newUser.role,
    signupMethod: 'email_password'
  }, req);
  
  res.json({ success: true, user: newUser });
});
app.post('/api/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Input validation
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and password are required' 
      });
    }

    const emailLower = email.toLowerCase().trim();
    console.log('Login attempt for:', emailLower);
    
    // Find user in database
    const user = await User.findOne({ email: emailLower, password }); // Use hashed password in production
    
    if (user) {
      // Ensure admin role for configured admin emails
      if (user.email && ADMIN_EMAILS.includes(user.email.toLowerCase()) && user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
        console.log('Admin role assigned to:', user.email);
      }

      // Create session
      req.session.userId = user._id;
      req.session.userEmail = user.email;
      req.session.userRole = user.role;

      console.log('Login successful for:', user.email, 'Role:', user.role);
      
      // Log activity
      await logActivity('login', user.email, `User logged in successfully`, {
        role: user.role,
        loginMethod: 'email_password'
      }, req);
      
      res.json({ 
        success: true, 
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role || 'user'
        }
      });
    } else {
      console.log('Invalid login attempt for:', emailLower);
      res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error during signin' 
    });
  }
});

// Get workspaces with goals, milestones, tasks
// Get user details by email
app.get('/api/user/:email', async (req, res) => {
  const { email } = req.params;
  const emailLower = (email || '').toLowerCase();
  try {
    const user = await User.findOne({ email: emailLower });
    if (user) {
      res.json({ name: user.name, email: user.email });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err.message });
  }
});
// Update workspace goals, milestones, tasks
app.put('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  const { goals } = req.body
  try {
    // Get the old workspace to compare task assignments
    const oldWorkspace = await Workspace.findById(id);
    
    // Update workspace
    const workspace = await Workspace.findByIdAndUpdate(id, { goals }, { new: true });
    
    // Check for new task assignments and send emails
    if (oldWorkspace) {
      checkAndSendTaskAssignmentEmails(oldWorkspace, workspace, req.user?.email || 'system');
    }
    
    res.json({ success: true, workspace });
    // Log activity: workspace updated
    try {
      await logActivity('workspace_updated', req.user?.email || 'unknown', `Workspace '${workspace.name}' updated`, { goalsCount: (workspace.goals || []).length }, req);
    } catch (e) { /* no-op */ }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error updating workspace', error: err.message });
  }
});
// Create a new workspace (with optional goals, milestones, tasks)
app.post('/api/workspaces', async (req, res) => {
  const { name, members, goals } = req.body;
  try {
    const creatorEmail = req.user && req.user.email
      ? req.user.email.toLowerCase()
      : (req.body.creatorEmail || req.body.ownerEmail || '').toLowerCase() || null;
    let normalizedMembers = Array.isArray(members) ? members.filter(Boolean).map(e => e.toLowerCase()) : [];
    if (creatorEmail && !normalizedMembers.includes(creatorEmail)) {
      normalizedMembers.push(creatorEmail);
    }
    const workspace = new Workspace({ 
      name, 
      owner: creatorEmail, 
      members: normalizedMembers, 
      goals 
    });
    await workspace.save();
    res.json({ success: true, workspace });
    // Log activity: workspace created
    await logActivity('workspace_created', creatorEmail || 'system', `Created workspace "${name}"`, {
      workspaceId: workspace._id,
      memberCount: normalizedMembers.length,
      members: normalizedMembers
    }, req);
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error creating workspace', error: err.message });
  }
});
app.get('/api/workspaces/:email', async (req, res) => {
  const { email } = req.params;
  const emailLower = (email || '').toLowerCase();
  const workspaces = await Workspace.find({ members: emailLower });
  res.json(workspaces);
});

// Upload attachment for a task inside a workspace
app.post('/api/workspaces/:workspaceId/tasks/:taskId/attachments', upload.single('file'), async (req, res) => {
  const { workspaceId, taskId } = req.params;
  
  console.log('📎 File upload request received:', {
    workspaceId,
    taskId,
    hasFile: !!req.file,
    file: req.file ? {
      filename: req.file.filename,
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
      path: req.file.path
    } : null
  });
  
  if (!req.file) {
    console.error('❌ No file in request');
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }
  
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      console.error('❌ Workspace not found:', workspaceId);
      return res.status(404).json({ success: false, message: 'Workspace not found' });
    }

    let found = false;
    // Debug: collect existing task ids/titles for logging
    const existingTasksSnapshot = [];
    workspace.goals.forEach(goal => {
      goal.milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          existingTasksSnapshot.push({ id: task.id || null, _id: task._id ? String(task._id) : null, title: task.title || null });
          const tid = task._id ? String(task._id) : String(task.id);
          if (tid === String(taskId)) {
            task.attachments = task.attachments || [];
            task.attachments.push({ 
              filename: req.file.filename, 
              originalName: req.file.originalname, 
              url: `/uploads/${req.file.filename}` 
            });
            found = true;
            console.log('✅ File attached to task:', {
              taskTitle: task.title,
              filename: req.file.filename,
              attachmentCount: task.attachments.length
            });
          }
        });
      });
    });

    if (!found) {
      console.warn('⚠️ Upload: Task not found', { workspaceId, taskId, existingTasksSnapshot: existingTasksSnapshot.slice(0, 5) });
      return res.status(404).json({ success: false, message: 'Task not found in workspace', debug: { existingTasks: existingTasksSnapshot.slice(0, 10) } });
    }

    await workspace.save();
    console.log('✅ Workspace saved successfully with attachment');
    res.json({ success: true, workspace });
    
    // Log activity: attachment uploaded
    await logActivity('file_uploaded', req.user?.email || 'unknown', `Uploaded file "${req.file.originalname}"`, {
      workspaceId: workspace._id,
      taskId: req.params.taskId,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size
    }, req);
  } catch (err) {
    console.error('❌ Error saving attachment:', err);
    res.status(500).json({ success: false, message: 'Error saving attachment', error: err.message });
  }
});

// Delete attachment from a task and remove file from disk
app.delete('/api/workspaces/:workspaceId/tasks/:taskId/attachments/:filename', async (req, res) => {
  const { workspaceId, taskId, filename } = req.params;
  console.info('DELETE attachment called', { workspaceId, taskId, filename });
  try {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });

    let found = false;
    const existing = [];
    workspace.goals.forEach(goal => {
      goal.milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          existing.push({ id: task.id || null, _id: task._id ? String(task._id) : null, title: task.title, attachments: (task.attachments || []).map(a=>a.filename) });
          const tid = task._id ? String(task._id) : String(task.id);
          if (tid === String(taskId)) {
            task.attachments = (task.attachments || []).filter(a => a.filename !== filename);
            found = true;
          }
        });
      });
    });

    if (!found) {
      console.warn('DELETE attachment: task not found', { workspaceId, taskId, filename, existing: existing.slice(0,20) });
      return res.status(404).json({ success: false, message: 'Task not found in workspace', debug: { existing: existing.slice(0,20) } });
    }

    await workspace.save();

    // Attempt to delete the file from disk (best-effort)
    const filePath = path.join(uploadsDir, filename);
    fs.unlink(filePath, (err) => {
      if (err) console.warn('Failed to delete uploaded file:', filePath, err && err.message ? err.message : err);
    });

    // Log activity: attachment removed
    try {
      logActivity({ type: 'task.attachment_removed', actor: req.user?.email || 'unknown', workspaceId: workspace._id, message: `Attachment ${filename} removed`, details: { filename } });
    } catch (e) { /* no-op */ }

    res.json({ success: true, workspace });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error removing attachment', error: err.message });
  }
});

// Add member to workspace only if user exists and has googleId
app.post('/api/workspaces/:id/add-member', async (req, res) => {
  const { id } = req.params;
  const { email } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'Email required' });
  try {
    const emailLower = (email || '').toLowerCase();
    const user = await User.findOne({ email: emailLower, googleId: { $exists: true, $ne: null } });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User must sign in with Google first' });
    }
    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });
    if (!workspace.members.includes(emailLower)) {
      workspace.members.push(emailLower);
      await workspace.save();
    }
    res.json({ success: true, workspace });
    
    // Log activity: member added
    try {
      await logActivity('member_added', emailLower, `Added to workspace "${workspace.name}" by ${req.user?.email || 'admin'}`, {
        workspaceId: workspace._id,
        workspaceName: workspace.name,
        addedBy: req.user?.email || 'admin',
        memberCount: workspace.members.length
      }, req);
    } catch (e) { 
      console.error('Failed to log member addition activity:', e);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error adding member', error: err.message });
  }
});

// Delete workspace (admin only)
app.delete('/api/workspaces/:id', async (req, res) => {
  const { id } = req.params;
  // safely derive email from session or query (avoid calling toLowerCase on undefined)
  // derive requester and verify admin role OR workspace ownership
  const emailFromUser = req.user && req.user.email ? String(req.user.email).toLowerCase() : '';
  const emailFromQuery = req.query && req.query.email ? String(req.query.email).toLowerCase() : '';
  const email = emailFromUser || emailFromQuery;
  let requester = null;
  if (req.user && req.user.role) {
    requester = req.user;
  } else if (email) {
    requester = await User.findOne({ email });
  }
  
  try {
    const workspace = await Workspace.findById(id);
    if (!workspace) return res.status(404).json({ success: false, message: 'Workspace not found' });
    
    // Allow deletion if user is admin OR workspace owner
    const isAdmin = requester && requester.role === 'admin';
    const isOwner = workspace.owner && email && workspace.owner.toLowerCase() === email.toLowerCase();
    
    if (!requester || (!isAdmin && !isOwner)) {
      console.warn('DELETE workspace forbidden; caller:', email || '<none>', 'isAdmin:', isAdmin, 'isOwner:', isOwner);
      return res.status(403).json({ success: false, message: 'Only workspace owners or admins can delete workspaces' });
    }

    // Collect all filenames to delete
    const toDelete = [];
    workspace.goals.forEach(goal => {
      goal.milestones.forEach(milestone => {
        milestone.tasks.forEach(task => {
          (task.attachments || []).forEach(a => {
            if (a && a.filename) toDelete.push(a.filename);
          });
        });
      });
    });

    // Remove workspace document
    await Workspace.findByIdAndDelete(id);

    // Attempt to remove files
    toDelete.forEach(fn => {
      const filePath = path.join(uploadsDir, fn);
      fs.unlink(filePath, err => {
        if (err) console.warn('Failed to delete file during workspace removal', filePath, err && err.message ? err.message : err);
      });
    });

    // Log activity
    try { logActivity({ type: 'workspace.deleted', actor: email || 'admin', workspaceId: id, message: `Workspace deleted (${id})`, details: { deletedFiles: toDelete.length } }); } catch (e) { }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Error deleting workspace', error: err.message });
  }
});

// Endpoint to get the currently authenticated user (for Google OAuth sessions)
app.get('/api/current_user', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    // include role when available so frontend can route admin users
    res.json({ name: req.user.name, email: req.user.email, role: req.user.role || 'user' });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Logout endpoint
app.post('/api/logout', (req, res) => {
  try {
    if (req.logout) req.logout();
    if (req.session) req.session.destroy(() => {});
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Logout failed' });
  }
});

// Endpoint to get server info (useful for frontend configuration)
app.get('/api/server-info', (req, res) => {
  res.json({
    serverUrl: getServerBaseUrl(req),
    frontendUrl: getFrontendBaseUrl(req),
    port: PORT,
    host: req.get('host'),
    protocol: req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : 'http'
  });
});

// Get user notifications (activities where they were added to workspaces, etc.)
app.get('/api/notifications/:email', async (req, res) => {
  try {
    const { email } = req.params;
    const emailLower = (email || '').toLowerCase();
    
    // Get recent activities related to this user
    const activities = await Activity.find({
      $or: [
        { user: emailLower },
        { 'metadata.addedMember': emailLower }
      ]
    }).sort({ timestamp: -1 }).limit(20);
    
    // Filter for notification-worthy activities
    const notifications = activities.filter(activity => {
      return activity.type === 'member_added' && activity.user === emailLower;
    }).map(activity => ({
      id: activity._id,
      type: activity.type,
      message: activity.description,
      timestamp: activity.timestamp,
      metadata: activity.metadata,
      read: false // In a real app, you'd track read status
    }));
    
    res.json({ notifications });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get dashboard statistics with historical comparison
app.get('/api/admin/stats', async (req, res) => {
  try {
    console.log('📊 Stats API called with email:', req.query.email);
    const email = req.user?.email?.toLowerCase() || req.query.email?.toLowerCase();
    let requester = null;
    if (req.user && req.user.role) {
      requester = req.user;
      console.log('📊 Found authenticated user:', requester.email, 'role:', requester.role);
    } else if (email) {
      requester = await User.findOne({ email });
      console.log('📊 Found user by email:', requester ? requester.email : 'not found', 'role:', requester?.role);
    }
    
    if (!requester || requester.role !== 'admin') {
      console.log('❌ Access denied - not admin. User:', requester ? requester.email : 'none', 'Role:', requester?.role);
      return res.status(403).json({ message: 'Admin access required' });
    }
    
    console.log('✅ Admin access granted for:', requester.email);
    
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get current data
    const [users, workspaces] = await Promise.all([
      User.find({}),
      Workspace.find({})
    ]);
    
    // Calculate current stats
    const totalUsers = users.length;
    const activeWorkspaces = workspaces.filter(ws => (ws.members || []).length > 0).length;
    const totalWorkspaces = workspaces.length;
    
    const totalTasks = workspaces.reduce((total, ws) => 
      total + (ws.goals || []).reduce((goalTotal, goal) => 
        goalTotal + (goal.milestones || []).reduce((msTotal, ms) => 
          msTotal + (ms.tasks || []).length, 0), 0), 0);
    
    const completedTasks = workspaces.reduce((total, ws) => 
      total + (ws.goals || []).reduce((goalTotal, goal) => 
        goalTotal + (goal.milestones || []).reduce((msTotal, ms) => 
          msTotal + (ms.tasks || []).filter(task => task.status === 'completed').length, 0), 0), 0);
    
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Get historical activity data for comparison
    const [
      yesterdayActivities,
      weekAgoActivities,
      recentSignups,
      yesterdaySignups
    ] = await Promise.all([
      Activity.find({ 
        timestamp: { $gte: oneDayAgo },
        type: { $in: ['login', 'signup', 'workspace_created', 'task_completed'] }
      }),
      Activity.find({ 
        timestamp: { $gte: oneWeekAgo },
        type: { $in: ['login', 'signup', 'workspace_created', 'task_completed'] }
      }),
      Activity.find({ 
        type: 'signup',
        timestamp: { $gte: oneWeekAgo }
      }),
      Activity.find({ 
        type: 'signup',
        timestamp: { $gte: oneDayAgo, $lt: now }
      })
    ]);
    
    // Calculate percentage changes (simplified approach)
    // For a more accurate approach, you'd store daily snapshots
    const userGrowthRate = recentSignups.length > 0 ? Math.min(Math.round((recentSignups.length / Math.max(totalUsers - recentSignups.length, 1)) * 100), 99) : 0;
    const workspaceGrowthRate = Math.round(Math.random() * 15 + 5); // Placeholder - replace with real calculation
    const taskGrowthRate = Math.round(Math.random() * 25 + 10); // Placeholder - replace with real calculation  
    const completionImprovement = Math.round(Math.random() * 10 + 2); // Placeholder - replace with real calculation
    
    // Get recent activities breakdown
    const activityBreakdown = {
      logins: yesterdayActivities.filter(a => a.type === 'login').length,
      signups: yesterdayActivities.filter(a => a.type === 'signup').length,
      workspaceCreations: yesterdayActivities.filter(a => a.type === 'workspace_created').length,
      taskCompletions: yesterdayActivities.filter(a => a.type === 'task_completed').length
    };
    
    const responseData = {
      current: {
        totalUsers,
        activeWorkspaces,
        totalWorkspaces,
        totalTasks,
        completedTasks,
        taskCompletionRate
      },
      changes: {
        userGrowth: userGrowthRate,
        workspaceGrowth: workspaceGrowthRate,
        taskGrowth: taskGrowthRate,
        completionImprovement: completionImprovement
      },
      activityBreakdown,
      lastUpdated: new Date()
    };

    console.log('📊 Dashboard stats response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Test email endpoint (useful for debugging)
app.post('/api/test-email', async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please provide testEmail in request body' 
      });
    }

    console.log('🧪 Testing email configuration...');
    const result = await testEmailConfiguration(testEmail);
    
    if (result.success) {
      res.json({ 
        success: true, 
        message: 'Test email sent successfully!',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false, 
        message: 'Failed to send test email',
        error: result.error
      });
    }
  } catch (error) {
    console.error('❌ Test email endpoint error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error',
      error: error.message 
    });
  }
});

// Multer error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('❌ Multer error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        message: 'File too large. Maximum size is 10MB.'
      });
    }
    return res.status(400).json({
      success: false,
      message: `Upload error: ${err.message}`
    });
  } else if (err) {
    console.error('❌ General error:', err);
    return res.status(500).json({
      success: false,
      message: err.message || 'Unknown error occurred'
    });
  }
  next();
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: Use your actual IP/domain with port ${PORT}`);
});
