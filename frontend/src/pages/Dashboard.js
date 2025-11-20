import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import MenuTab from './MenuTab';
import Toast from '../components/Toast';
import { API_BASE_URL } from '../config/api';

function Dashboard() {
  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastSeq = useRef(1);
  const addToast = (message, type = 'info', timeout = 3500) => {
    const id = toastSeq.current++;
    setToasts(t => [...t, { id, message, type, timeout }]);
    return id;
  };
  const removeToast = (id) => setToasts(t => t.filter(x => x.id !== id));

  // Debounce/batching: per-workspace pending saves
  const pendingSaves = useRef({});
  const saveTimers = useRef({});
  const scheduleSave = (wsId, goals) => {
    if (saveTimers.current[wsId]) clearTimeout(saveTimers.current[wsId]);
    pendingSaves.current[wsId] = goals;
    saveTimers.current[wsId] = setTimeout(async () => {
      const payload = pendingSaves.current[wsId];
      try {
        const res = await fetch(`${API_BASE_URL}/api/workspaces/${wsId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ goals: payload })
        });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        addToast('Saved', 'success');
      } catch (err) {
        console.error('Save failed', err);
        addToast('Save failed', 'error');
      } finally {
        delete saveTimers.current[wsId];
        delete pendingSaves.current[wsId];
      }
    }, 700);
  };

  // Flush pending saves on unload and clear timers on unmount
  useEffect(() => {
    const flush = () => {
      Object.keys(pendingSaves.current).forEach(wsId => {
        const payload = pendingSaves.current[wsId];
        try {
          // Prefer sendBeacon for unload; fallback to fetch with keepalive
          const url = `${API_BASE_URL}/api/workspaces/${wsId}`;
          const body = JSON.stringify({ goals: payload });
          if (navigator.sendBeacon) {
            const blob = new Blob([body], { type: 'application/json' });
            navigator.sendBeacon(url, blob);
          } else {
            fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(() => {});
          }
        } catch (err) {
          // best-effort
          console.warn('Flush save failed', err);
        }
      });
    };

    const onBeforeUnload = () => flush();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload);
      // clear any pending timers
      Object.values(saveTimers.current).forEach(t => clearTimeout(t));
      saveTimers.current = {};
      pendingSaves.current = {};
    };
  }, []);

  // Attachment upload state
  const [uploadingTaskId, setUploadingTaskId] = useState(null);

  const handleFileUpload = async (workspaceId, task, file) => {
    if (!file) return;
    setUploadingTaskId(task.id || task._id || null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`${API_BASE_URL}/api/workspaces/${workspaceId}/tasks/${task.id || task._id}/attachments`, {
        method: 'POST', body: form
      });
      const data = await res.json();
      if (data.success) {
        const updated = data.workspace;
        setWorkspaceGoals(prev => ({
          ...prev,
          [workspaceId]: (updated.goals || []).map(goal => ({
            id: goal._id || Date.now() + Math.random(),
            title: goal.title,
            priority: goal.priority || 'Medium',
            milestones: (goal.milestones || []).map(milestone => ({
              id: milestone._id || Date.now() + Math.random(),
              title: milestone.title,
              tasks: (milestone.tasks || []).map(task => ({
                id: task._id || Date.now() + Math.random(),
                title: task.title,
                status: task.status,
                attachments: task.attachments || [],
                assignedTo: task.assignedTo || '',
                userStories: task.userStories || '',
                startDate: task.startDate || '',
                endDate: task.endDate || ''
              }))
            }))
          }))
        }));
        addToast('File uploaded', 'success');
      } else {
        addToast(data.message || 'Upload failed', 'error');
      }
    } catch (err) {
      addToast('Upload error', 'error');
    } finally {
      setUploadingTaskId(null);
    }

  };

  const deleteAttachment = async (workspaceId, task, filename) => {
    if (!filename) return;
    try {
      const encoded = encodeURIComponent(filename);
      const url = `${API_BASE_URL}/api/workspaces/${workspaceId}/tasks/${task.id || task._id}/attachments/${encoded}`;
      console.log('Deleting attachment', { url, workspaceId, taskId: task.id || task._id, filename });
      const res = await fetch(url, { method: 'DELETE', credentials: 'include', headers: { Accept: 'application/json' } });
      let data;
      try {
        data = await res.json();
      } catch (err) {
        const text = await res.text().catch(() => '<no body>');
        console.warn('Non-JSON response deleting attachment', { status: res.status, text });
        alert(`Delete failed: ${res.status} ${res.statusText}\n${text}`);
        return;
      }
      if (data.success) {
        // Update local state with returned workspace
        const updated = data.workspace;
        setWorkspaceGoals(prev => ({ ...prev, [workspaceId]: (updated.goals || []).map(goal => ({
          id: goal._id || Date.now() + Math.random(),
          title: goal.title,
          priority: goal.priority || 'Medium',
          milestones: (goal.milestones || []).map(m => ({
            id: m._id || Date.now() + Math.random(),
            title: m.title,
            tasks: (m.tasks || []).map(t => ({ id: t._id || Date.now() + Math.random(), title: t.title, status: t.status, attachments: t.attachments || [], assignedTo: t.assignedTo || '', userStories: t.userStories || '', startDate: t.startDate || '', endDate: t.endDate || '' }))
          }))
        })) }));
        addToast('Attachment removed', 'success');
      } else {
        console.warn('Delete attachment failed', data);
        addToast(data.message || JSON.stringify(data.debug) || 'Failed to remove attachment', 'error');
      }
    } catch (err) {
      console.error('Error removing attachment', err);
      addToast('Error removing attachment: ' + (err && err.message ? err.message : String(err)), 'error');
    }
  };
  // Edit Task Modal State
  const [editTaskModal, setEditTaskModal] = useState({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', status: 'Not Started' });
  // Task Detail Modal State (user stories, assignee, start/end dates)
  const [taskDetailModal, setTaskDetailModal] = useState({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', userStories: '', assignedTo: '', startDate: '', endDate: '' });

  // Edit Task Handler
  const handleEditTask = (goalId, milestoneId, task) => {
    // defensive: prefer DB _id when available
    const tid = task._id || task.id;
    console.debug('handleEditTask', { goalId, milestoneId, taskId: tid });
    // open modal even if no DB id; use whichever id exists
    addToast('Opening edit for: ' + (task.title || '(untitled)'), 'info', 1200);
    setEditTaskModal({ open: true, goalId, milestoneId, taskId: tid || task.id || null, title: task.title, status: task.status });
  };

  const handleEditTaskSave = () => {
    setGoalsForCurrent(prevGoals => prevGoals.map(g => g.id === editTaskModal.goalId ? {
      ...g,
      milestones: g.milestones.map(m => m.id === editTaskModal.milestoneId ? {
        ...m,
          tasks: m.tasks.map(t => (t.id === editTaskModal.taskId || t._id === editTaskModal.taskId) ? { ...t, title: editTaskModal.title.trim() } : t)
      } : m)
    } : g));
    setEditTaskModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', status: 'Not Started' });
  };

  // Delete Task Handler
  const handleDeleteTask = (goalId, milestoneId, taskId) => {
    setGoalsForCurrent(goals.map(g => g.id === goalId ? {
      ...g,
      milestones: g.milestones.map(m => m.id === milestoneId ? {
        ...m,
        tasks: m.tasks.filter(t => t.id !== taskId)
      } : m)
    } : g));
  };
  const navigate = useNavigate();
  const location = useLocation();
  // UI state for forms and selection
  const [newGoal, setNewGoal] = useState('');
  const [newMilestone, setNewMilestone] = useState('');
  const [newTask, setNewTask] = useState('');
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [selectedMilestone, setSelectedMilestone] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskModalGoal, setTaskModalGoal] = useState(null);
  const [taskModalMilestone, setTaskModalMilestone] = useState(null);
  const [taskModalInput, setTaskModalInput] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  // Try to get signed in email from localStorage, or fetch from backend if not present (for Google login)
  const [signedInEmail, setSignedInEmail] = useState(localStorage.getItem('signedInEmail') || '');

  // On mount, if no email in localStorage, try to fetch from backend (for Google OAuth)
  useEffect(() => {
    if (!signedInEmail) {
      fetch(`${API_BASE_URL}/api/current_user`, { credentials: 'include' })
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.email) {
            setSignedInEmail(data.email);
            localStorage.setItem('signedInEmail', data.email);
            const ADMIN_EMAILS = ['santhoshr.23it@kongu.edu', 'venmugil182005@gmail.com'];
            const isAdmin = (data.role && data.role === 'admin') || (data.email && ADMIN_EMAILS.includes(data.email.toLowerCase()));
            if (isAdmin) {
              // redirect to admin dashboard
              navigate('/admin');
            }
          }
        });
    }
  }, [signedInEmail]);
  const [workspaces, setWorkspaces] = useState([]);
  const [newMember, setNewMember] = useState('');
  // Add member to selected workspace using backend validation
  const handleAddMember = async () => {
    if (!newMember.trim() || !selectedWorkspace) return;
    
    const memberEmail = newMember.trim().toLowerCase();
    const currentWorkspace = workspaces.find(ws => ws.id === selectedWorkspace);
    
    // Check if user is already a member
    if (currentWorkspace && currentWorkspace.members && currentWorkspace.members.includes(memberEmail)) {
      addToast(`${memberEmail} is already a member of this workspace`, 'warning');
      setNewMember('');
      return;
    }
    
    try {
      addToast('Adding member...', 'info', 2000);
      const res = await fetch(`${API_BASE_URL}/api/workspaces/${selectedWorkspace}/add-member`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: memberEmail }),
        credentials: 'include'
      });
      const data = await res.json();
      if (data.success) {
        // Update UI with new member list from backend
        setWorkspaces(wsArr => wsArr.map(ws => ws.id === selectedWorkspace ? { ...data.workspace, id: data.workspace._id } : ws));
        setNewMember('');
        addToast(`Successfully added ${memberEmail} to workspace!`, 'success');
        
        // Refresh notifications to show any new activity
        setTimeout(fetchNotifications, 1000);
      } else {
        addToast(data.message || 'Failed to add member', 'error');
      }
    } catch (err) {
      addToast('Server error while adding member', 'error');
    }
  };
  const [selectedWorkspace, setSelectedWorkspace] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  // Fetch notifications for the user
  const fetchNotifications = async () => {
    if (!signedInEmail) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/notifications/${signedInEmail}`);
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    }
  };

  // Fetch workspaces from backend on mount
  useEffect(() => {
    if (!signedInEmail) return;
    fetch(`${API_BASE_URL}/api/workspaces/${signedInEmail}`)
      .then(res => res.json())
      .then(data => {
        setWorkspaces(data.map((ws, idx) => ({ ...ws, id: ws._id })));
        if (data.length > 0) setSelectedWorkspace(data[0]._id);
        // Set workspaceGoals from backend data
        const goalsObj = {};
        data.forEach(ws => {
        goalsObj[ws._id] = (ws.goals || []).map(goal => ({
            id: goal._id || Date.now() + Math.random(),
            title: goal.title,
            priority: goal.priority || 'Medium',
            milestones: (goal.milestones || []).map(milestone => ({
              id: milestone._id || Date.now() + Math.random(),
              title: milestone.title,
              tasks: (milestone.tasks || []).map(task => ({
                id: task._id || Date.now() + Math.random(),
                title: task.title,
                status: task.status,
                attachments: task.attachments || [],
                startDate: task.startDate || '',
                endDate: task.endDate || ''
              }))
            }))
          }));
        });
        setWorkspaceGoals(goalsObj);
      });
    
    // Also fetch notifications
    fetchNotifications();
  }, [signedInEmail]);
  // Sync selectedWorkspace with URL query param
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const wsId = parseInt(params.get('workspace'), 10);
    if (wsId && wsId !== selectedWorkspace && workspaces.some(ws => ws.id === wsId)) {
      setSelectedWorkspace(wsId);
    }
  }, [location.search, workspaces]);

  // Update URL when selectedWorkspace changes
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (selectedWorkspace && params.get('workspace') !== String(selectedWorkspace)) {
      params.set('workspace', selectedWorkspace);
      navigate({ search: params.toString() }, { replace: true });
    }
  }, [selectedWorkspace]);
  const [activeTab, setActiveTab] = useState('Goals');
  // Workspace search state and logic
  const [workspaceSearch, setWorkspaceSearch] = useState('');
  const [showWorkspaceResults, setShowWorkspaceResults] = useState(false);
  // Per-workspace goals/tasks state
  const [workspaceGoals, setWorkspaceGoals] = useState({});
  // Filtered workspaces for search
  const filteredWorkspaces = workspaces.filter(ws => ws.name.toLowerCase().includes((workspaceSearch || '').toLowerCase()));

    // Helper to get/set goals for current workspace
  // Update backend when goals change
  const setGoalsForCurrent = (updater) => {
    setWorkspaceGoals(prev => {
      const current = Array.isArray(prev[selectedWorkspace]) ? prev[selectedWorkspace] : [];
      const newGoals = typeof updater === 'function' ? updater(current) : updater;
      // Schedule backend save (debounced)
      if (selectedWorkspace) scheduleSave(selectedWorkspace, newGoals);
      return { ...prev, [selectedWorkspace]: newGoals };
    });
  };
  const goals = Array.isArray(workspaceGoals[selectedWorkspace]) ? workspaceGoals[selectedWorkspace] : [];

  const menuTabs = [
    { icon: '�', label: 'Goals' },
    { icon: '🏆', label: 'Achievements' },
    { icon: '�', label: 'Progress' },
    { icon: '�', label: 'Tasks' }
  ];

  const handleDeleteWorkspace = async (id) => {
    const workspace = workspaces.find(ws => ws.id === id);
    const workspaceName = workspace ? workspace.name : 'this workspace';
    const memberCount = workspace ? workspace.members?.length || 0 : 0;
    
    if (!window.confirm(`⚠️ DELETE WORKSPACE: "${workspaceName}"\n\nThis will permanently delete:\n• All goals, milestones, and tasks\n• All file attachments\n• Access for all ${memberCount} member(s)\n\nThis action CANNOT be undone!\n\nType the workspace name to confirm deletion.`)) {
      return;
    }
    
    // Additional confirmation with workspace name
    const userInput = window.prompt(`To confirm deletion, please type the workspace name: "${workspaceName}"`);
    if (userInput !== workspaceName) {
      addToast('Deletion cancelled - workspace name did not match', 'info');
      return;
    }
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/workspaces/${id}?email=${signedInEmail}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      
      if (data.success) {
        // Update local state
        setWorkspaces(workspaces.filter(ws => ws.id !== id));
        if (selectedWorkspace === id && workspaces.length > 1) {
          // Select another workspace if the current one is deleted
          const remaining = workspaces.filter(ws => ws.id !== id);
          setSelectedWorkspace(remaining[0]?.id || null);
        } else if (workspaces.length === 1) {
          setSelectedWorkspace(null);
        }
        addToast('Workspace deleted successfully', 'success');
      } else {
        addToast(data.message || 'Failed to delete workspace', 'error');
      }
    } catch (err) {
      console.error('Error deleting workspace:', err);
      addToast('Error deleting workspace', 'error');
    }
  };

  const handleCreateWorkspace = (e) => {
    e.preventDefault();
    if (!workspaceName.trim()) return;
    const signedInEmail = localStorage.getItem('signedInEmail') || '';
    e.preventDefault();
    if (!workspaceName.trim()) return;
    const newWorkspace = {
      name: workspaceName.trim(),
      members: signedInEmail ? [signedInEmail] : [],
      creatorEmail: signedInEmail || undefined,
      goals: []
    };
    // Save to backend
    fetch(`${API_BASE_URL}/api/workspaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newWorkspace)
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          // Refetch workspaces after creation
          fetch(`${API_BASE_URL}/api/workspaces/${signedInEmail}`)
            .then(res => res.json())
            .then(wsData => {
              setWorkspaces(wsData.map((ws, idx) => ({ ...ws, id: ws._id })));
              if (wsData.length > 0) setSelectedWorkspace(wsData[wsData.length - 1]._id);
            });
          setWorkspaceName('');
          setShowModal(false);
        } else {
          alert(data.message || 'Workspace creation failed.');
        }
      })
      .catch(() => alert('Server error.'));
    setShowModal(false);
  };

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      width: '100%',
      maxWidth: '100vw',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Toast toasts={toasts} removeToast={removeToast} />
      
      {/* Sidebar */}
      <motion.aside 
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '320px',
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          borderRight: '1px solid rgba(255, 255, 255, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)'
        }}
      >
        <div style={{ padding: '24px' }}>
          <motion.h2 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: '#1a202c',
              marginBottom: '24px',
              margin: '0 0 24px 0'
            }}
          >
            Workspaces
          </motion.h2>
          
          <motion.button 
            onClick={() => setShowModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: '100%',
              marginBottom: '24px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              fontWeight: '600',
              padding: '12px 16px',
              borderRadius: '12px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s',
              fontSize: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <svg style={{ width: '20px', height: '20px', marginRight: '8px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Create Workspace
          </motion.button>
        </div>
        <div style={{ padding: '0 24px', flex: 1, overflowY: 'auto' }}>
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#718096',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>Your Workspaces</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <AnimatePresence>
                {workspaces.map((ws, index) => (
                  <motion.div
                    key={ws.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <motion.button
                      onClick={() => setSelectedWorkspace(ws.id)}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px',
                        borderRadius: '12px',
                        textAlign: 'left',
                        transition: 'all 0.2s',
                        border: 'none',
                        cursor: 'pointer',
                        background: selectedWorkspace === ws.id 
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'rgba(247, 250, 252, 0.8)',
                        color: selectedWorkspace === ws.id ? 'white' : '#4a5568',
                        boxShadow: selectedWorkspace === ws.id 
                          ? '0 8px 20px rgba(102, 126, 234, 0.3)'
                          : '0 2px 4px rgba(0, 0, 0, 0.05)'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '12px',
                          height: '12px',
                          borderRadius: '50%',
                          background: selectedWorkspace === ws.id ? 'rgba(255, 255, 255, 0.3)' : '#667eea'
                        }}></div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span style={{ fontWeight: '500' }}>{ws.name}</span>
                          {ws.owner && ws.owner.toLowerCase() !== signedInEmail?.toLowerCase() && (
                            <span style={{ 
                              fontSize: '10px', 
                              opacity: 0.7,
                              color: selectedWorkspace === ws.id ? 'rgba(255, 255, 255, 0.8)' : '#718096'
                            }}>
                              👥 Invited by {ws.owner}
                            </span>
                          )}
                          {ws.owner && ws.owner.toLowerCase() === signedInEmail?.toLowerCase() && (
                            <span style={{ 
                              fontSize: '10px', 
                              opacity: 0.7,
                              color: selectedWorkspace === ws.id ? 'rgba(255, 255, 255, 0.8)' : '#718096'
                            }}>
                              👑 Owner
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Only show delete button for workspace owners */}
                      {ws.owner && ws.owner.toLowerCase() === signedInEmail?.toLowerCase() && (
                        <motion.button
                          onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); }}
                          whileHover={{ 
                            scale: 1.1,
                            background: 'rgba(239, 68, 68, 0.2)'
                          }}
                          whileTap={{ scale: 0.95 }}
                          style={{
                            opacity: 0.6,
                            padding: '6px',
                            borderRadius: '8px',
                            background: 'rgba(239, 68, 68, 0.1)',
                            border: 'none',
                            cursor: 'pointer',
                            transition: 'all 0.2s',
                            color: '#ef4444',
                            backdropFilter: 'blur(10px)'
                          }}
                          title="Delete workspace (Owner only)"
                          onMouseEnter={(e) => e.target.style.opacity = '1'}
                          onMouseLeave={(e) => e.target.style.opacity = '0.6'}
                        >
                          <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </motion.button>
                      )}
                    </motion.button>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
          
          {/* Members Section */}
          <div style={{ borderTop: '1px solid rgba(226, 232, 240, 0.8)', paddingTop: '24px' }}>
            <h3 style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#718096',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>Team Members</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {(workspaces.find(ws => ws.id === selectedWorkspace)?.members || []).map((m, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'rgba(247, 250, 252, 0.8)'
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <span style={{
                      color: 'white',
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {m.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span style={{ color: '#4a5568', fontSize: '14px', fontWeight: '500' }}>{m}</span>
                </motion.div>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Add member (email)"
                value={newMember}
                onChange={e => setNewMember(e.target.value)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '14px',
                  border: '2px solid #e2e8f0',
                  borderRadius: '8px',
                  transition: 'all 0.2s',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.8)',
                  boxSizing: 'border-box'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
              <motion.button
                type="button"
                onClick={handleAddMember}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                style={{
                  padding: '8px 12px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  borderRadius: '8px',
                  fontWeight: '500',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Add member"
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </motion.button>
            </div>
          </div>

          {/* Workspace Settings */}
          {selectedWorkspace && workspaces.find(ws => ws.id === selectedWorkspace)?.owner?.toLowerCase() === signedInEmail?.toLowerCase() && (
            <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
              <h3 style={{ 
                fontSize: '12px', 
                fontWeight: '700', 
                color: '#718096',
                marginBottom: '16px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>Workspace Settings</h3>
              
              <motion.button
                onClick={() => {
                  const currentWorkspace = workspaces.find(ws => ws.id === selectedWorkspace);
                  if (currentWorkspace) {
                    handleDeleteWorkspace(currentWorkspace.id);
                  }
                }}
                whileHover={{ 
                  scale: 1.02,
                  background: 'rgba(239, 68, 68, 0.15)'
                }}
                whileTap={{ scale: 0.98 }}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: '12px',
                  color: '#ef4444',
                  fontWeight: '600',
                  fontSize: '14px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  backdropFilter: 'blur(10px)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  justifyContent: 'center'
                }}
                title="Delete this workspace permanently"
              >
                <svg style={{ width: '16px', height: '16px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete Workspace
              </motion.button>
            </div>
          )}
        </div>
      </motion.aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Navbar */}
        <motion.header 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
            padding: '16px 32px',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{
                fontSize: '32px',
                fontWeight: 'bold',
                color: '#1a202c',
                margin: 0
              }}>Dashboard</h1>
              <p style={{
                color: '#718096',
                fontSize: '16px',
                marginTop: '4px',
                margin: '4px 0 0 0'
              }}>Manage your projects and collaborate with your team</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Workspace Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="Search workspace..."
                value={typeof workspaceSearch === 'undefined' ? '' : workspaceSearch}
                onChange={e => {
                  setWorkspaceSearch(e.target.value);
                  setShowWorkspaceResults(true);
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter' && workspaceSearch && filteredWorkspaces.length > 0) {
                    setSelectedWorkspace(filteredWorkspaces[0].id);
                    setWorkspaceSearch('');
                    setShowWorkspaceResults(false);
                  }
                }}
                style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #D9CCBC', minWidth: 180, background: '#F3F3F2', color: '#222' }}
              />
              {showWorkspaceResults && workspaceSearch && filteredWorkspaces.length > 0 && (
                <div style={{ position: 'absolute', top: '110%', left: 0, background: '#F3F3F2', border: '1px solid #D9CCBC', borderRadius: '6px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', zIndex: 100, minWidth: 180 }}>
                  {filteredWorkspaces.map(ws => (
                    <div
                      key={ws.id}
                      onClick={() => {
                        setSelectedWorkspace(ws.id);
                        setWorkspaceSearch('');
                        setShowWorkspaceResults(false);
                      }}
                      style={{ padding: '0.5rem 1rem', cursor: 'pointer', borderBottom: '1px solid #D9CCBC', color: '#A6B2A0' }}
                      onMouseDown={e => e.preventDefault()}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{ws.name}</span>
                        {ws.owner && ws.owner.toLowerCase() !== signedInEmail?.toLowerCase() && (
                          <span style={{ fontSize: '11px', opacity: 0.7 }}>
                            👥 Invited by {ws.owner}
                          </span>
                        )}
                        {ws.owner && ws.owner.toLowerCase() === signedInEmail?.toLowerCase() && (
                          <span style={{ fontSize: '11px', opacity: 0.7 }}>
                            👑 Owner
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

              <div style={{ position: 'relative' }}>
                <motion.button
                  onClick={() => setShowNotifications(!showNotifications)}
                  whileHover={{ scale: 1.05 }}
                  style={{
                    padding: '8px',
                    color: notifications.length > 0 ? '#667eea' : '#718096',
                    background: notifications.length > 0 ? 'rgba(102, 126, 234, 0.1)' : 'rgba(247, 250, 252, 0.8)',
                    borderRadius: '8px',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative'
                  }}
                  title={`${notifications.length} notifications`}
                  onMouseEnter={(e) => {
                    e.target.style.color = notifications.length > 0 ? '#5a67d8' : '#4a5568';
                    e.target.style.background = notifications.length > 0 ? 'rgba(102, 126, 234, 0.2)' : 'rgba(226, 232, 240, 0.8)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.color = notifications.length > 0 ? '#667eea' : '#718096';
                    e.target.style.background = notifications.length > 0 ? 'rgba(102, 126, 234, 0.1)' : 'rgba(247, 250, 252, 0.8)';
                  }}
                >
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {notifications.length > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '2px',
                      right: '2px',
                      background: '#ef4444',
                      color: 'white',
                      borderRadius: '50%',
                      width: '16px',
                      height: '16px',
                      fontSize: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold'
                    }}>
                      {notifications.length > 9 ? '9+' : notifications.length}
                    </span>
                  )}
                </motion.button>
                
                {/* Notifications Dropdown */}
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: 'white',
                      border: '1px solid rgba(0, 0, 0, 0.1)',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                      minWidth: '320px',
                      maxHeight: '400px',
                      overflowY: 'auto',
                      zIndex: 1000
                    }}
                  >
                    <div style={{ 
                      padding: '16px 20px 12px', 
                      borderBottom: '1px solid rgba(0, 0, 0, 0.05)',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      borderRadius: '12px 12px 0 0'
                    }}>
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Notifications</h3>
                      <p style={{ margin: '4px 0 0', fontSize: '14px', opacity: 0.9 }}>
                        {notifications.length === 0 ? 'No new notifications' : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
                      </p>
                    </div>
                    
                    {notifications.length === 0 ? (
                      <div style={{ 
                        padding: '40px 20px', 
                        textAlign: 'center', 
                        color: '#718096',
                        fontSize: '14px'
                      }}>
                        🔔 No notifications yet
                        <br />
                        <span style={{ fontSize: '12px', opacity: 0.7 }}>
                          You'll see workspace invitations here
                        </span>
                      </div>
                    ) : (
                      <div>
                        {notifications.map((notification, index) => (
                          <motion.div
                            key={notification.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            style={{
                              padding: '16px 20px',
                              borderBottom: index < notifications.length - 1 ? '1px solid rgba(0, 0, 0, 0.05)' : 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = 'rgba(102, 126, 234, 0.05)'}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                              <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: '#10b981',
                                marginTop: '6px',
                                flexShrink: 0
                              }} />
                              <div style={{ flex: 1 }}>
                                <p style={{ 
                                  margin: 0, 
                                  fontSize: '14px', 
                                  color: '#1a202c',
                                  fontWeight: '500',
                                  lineHeight: '1.4'
                                }}>
                                  {notification.message}
                                </p>
                                <p style={{ 
                                  margin: '4px 0 0', 
                                  fontSize: '12px', 
                                  color: '#718096'
                                }}>
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                        
                        <div style={{ 
                          padding: '12px 20px', 
                          borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                          textAlign: 'center'
                        }}>
                          <button
                            onClick={() => {
                              fetchNotifications();
                              addToast('Notifications refreshed', 'success');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#667eea',
                              fontSize: '14px',
                              cursor: 'pointer',
                              fontWeight: '500'
                            }}
                          >
                            Refresh Notifications
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
              
              <motion.button
                onClick={() => navigate('/profile')}
                whileHover={{ scale: 1.05 }}
                style={{
                  padding: '8px',
                  color: '#718096',
                  background: 'rgba(247, 250, 252, 0.8)',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="Profile"
                onMouseEnter={(e) => {
                  e.target.style.color = '#4a5568';
                  e.target.style.background = 'rgba(226, 232, 240, 0.8)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = '#718096';
                  e.target.style.background = 'rgba(247, 250, 252, 0.8)';
                }}
              >
                <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </motion.header>

        <main style={{
          flex: 1,
          padding: '32px',
          overflowY: 'auto',
          background: 'rgba(255, 255, 255, 0.1)'
        }}>
          {selectedWorkspace ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
            >
              {/* Workspace Header */}
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  borderRadius: '20px',
                  boxShadow: '0 10px 30px rgba(0, 0, 0, 0.1)',
                  padding: '24px',
                  marginBottom: '32px',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: '16px'
                }}>
                  <svg style={{ width: '24px', height: '24px', color: 'white' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <div style={{ flex: 1 }}>
                  <h2 style={{
                    fontSize: '24px',
                    fontWeight: 'bold',
                    color: '#1a202c',
                    margin: 0
                  }}>{workspaces.find(ws => ws.id === selectedWorkspace)?.name}</h2>
                  <p style={{
                    color: '#718096',
                    fontSize: '14px',
                    margin: '4px 0 0 0'
                  }}>Collaborate and track your project goals</p>
                </div>
                <motion.button 
                  whileHover={{ rotate: 90 }}
                  style={{
                    padding: '8px',
                    color: '#9ca3af',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  <svg style={{ width: '20px', height: '20px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </motion.button>
              </motion.div>

              {/* Horizontal Menu Bar */}
              <div style={{ display: 'flex', alignItems: 'center', background: '#F3F3F2', borderRadius: '8px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', padding: '0.7rem 1.5rem', marginBottom: '2rem', gap: '1.5rem', overflowX: 'auto' }}>
                {menuTabs.map(tab => (
                  <div key={tab.label} onClick={() => setActiveTab(tab.label)}>
                    <MenuTab icon={tab.icon} label={tab.label} active={activeTab === tab.label} />
                  </div>
                ))}
              </div>

              {/* Workspace Content for Active Tab */}
              <motion.div 
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.6 }}
                style={{ 
                  background: 'rgba(255, 255, 255, 0.15)', 
                  borderRadius: '28px', 
                  boxShadow: '0 15px 40px rgba(0,0,0,0.1)', 
                  padding: '32px', 
                  minWidth: '220px', 
                  maxWidth: '100%',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)'
                }}
              >
                <motion.h3 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                  style={{ 
                    marginBottom: '24px',
                    fontSize: '28px',
                    fontWeight: '800',
                    color: 'rgba(255, 255, 255, 0.95)',
                    textShadow: '0 4px 8px rgba(0, 0, 0, 0.2)',
                    letterSpacing: '-0.01em'
                  }}
                >
                  {activeTab}
                </motion.h3>
                {activeTab === 'Goals' && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>Workspace Goals</div>
                    {/* Add Goal Form */}
                    <motion.form 
                      onSubmit={e => {
                        e.preventDefault();
                        if (newGoal.trim()) {
                          setGoalsForCurrent([...goals, { id: Date.now(), title: newGoal.trim(), milestones: [] }]);
                          setNewGoal('');
                        }
                      }} 
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 1.0, duration: 0.5 }}
                      style={{ marginBottom: '32px', display: 'flex', gap: '12px' }}
                    >
                      <input 
                        value={newGoal} 
                        onChange={e => setNewGoal(e.target.value)} 
                        placeholder="Add new goal..." 
                        style={{ 
                          flex: 1, 
                          padding: '16px 20px', 
                          borderRadius: '16px', 
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          background: 'rgba(255, 255, 255, 0.2)',
                          backdropFilter: 'blur(10px)',
                          color: 'white',
                          fontSize: '16px',
                          fontWeight: '500',
                          '::placeholder': { color: 'rgba(255, 255, 255, 0.7)' }
                        }} 
                      />
                      <motion.button 
                        type="submit" 
                        whileHover={{ 
                          scale: 1.05,
                          boxShadow: '0 10px 25px rgba(102, 126, 234, 0.4)'
                        }}
                        whileTap={{ scale: 0.95 }}
                        style={{ 
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                          color: '#fff', 
                          border: 'none', 
                          borderRadius: '16px', 
                          padding: '16px 24px', 
                          fontWeight: '700', 
                          cursor: 'pointer',
                          fontSize: '16px',
                          boxShadow: '0 8px 20px rgba(102, 126, 234, 0.3)',
                          transition: 'all 0.2s'
                        }}
                      >
                        + Goal
                      </motion.button>
                    </motion.form>
                    {/* List Goals */}
                    {goals.map((goal, index) => (
                      <motion.div 
                        key={goal.id} 
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 1.2 + index * 0.1, duration: 0.5 }}
                        whileHover={{ 
                          scale: 1.02,
                          boxShadow: '0 15px 40px rgba(255, 255, 255, 0.15)'
                        }}
                        style={{ 
                          background: 'rgba(255, 255, 255, 0.2)', 
                          borderRadius: '20px', 
                          padding: '24px', 
                          marginBottom: '20px',
                          backdropFilter: 'blur(15px)',
                          border: '1px solid rgba(255, 255, 255, 0.3)',
                          boxShadow: '0 10px 30px rgba(255, 255, 255, 0.1)',
                          transition: 'all 0.3s ease'
                        }}
                      >
                        <div style={{ 
                          fontWeight: '700', 
                          fontSize: '20px', 
                          marginBottom: '16px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '12px',
                          color: 'rgba(255, 255, 255, 0.95)',
                          textShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
                        }}>
                          {goal.title}
                        </div>
                        {/* Add Milestone Form */}
                        <form onSubmit={e => {
                          e.preventDefault();
                          if (selectedGoal === goal.id && newMilestone.trim()) {
                            setGoalsForCurrent(goals.map(g => g.id === goal.id ? { ...g, milestones: [...g.milestones, { id: Date.now(), title: newMilestone.trim(), tasks: [] }] } : g));
                            setNewMilestone('');
                          }
                        }} style={{ marginBottom: '20px', display: 'flex', gap: '12px' }}>
                          <input 
                            value={selectedGoal === goal.id ? newMilestone : ''} 
                            onChange={e => { setSelectedGoal(goal.id); setNewMilestone(e.target.value); }} 
                            placeholder="Add milestone..." 
                            style={{ 
                              flex: 1, 
                              padding: '12px 16px', 
                              borderRadius: '12px', 
                              border: '1px solid rgba(255, 255, 255, 0.3)', 
                              background: 'rgba(255, 255, 255, 0.25)', 
                              color: 'white',
                              fontSize: '14px',
                              fontWeight: '500',
                              backdropFilter: 'blur(10px)'
                            }} 
                          />
                          <motion.button 
                            type="submit" 
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            style={{ 
                              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                              color: '#fff', 
                              border: 'none', 
                              borderRadius: '12px', 
                              padding: '12px 20px', 
                              fontWeight: '700', 
                              cursor: 'pointer',
                              fontSize: '14px',
                              boxShadow: '0 6px 15px rgba(102, 126, 234, 0.3)',
                              transition: 'all 0.2s'
                            }}
                          >
                            + Milestone
                          </motion.button>
                        </form>
                        {/* List Milestones */}
                        {goal.milestones.map(milestone => (
                          <div key={milestone.id} style={{ marginLeft: '0.8rem', marginBottom: '0.5rem', background: '#F3F3F2', borderRadius: '6px', padding: '0.7rem' }}>
                            <div style={{ fontWeight: 'bold', marginBottom: '0.3rem', fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                              <span style={{ fontSize: '1rem' }}>�</span> {milestone.title}
                            </div>
                            {/* Add Task Form */}
                            <div style={{ marginBottom: '0.5rem', display: 'flex', gap: '0.5rem' }}>
                              <button type="button" onClick={() => { setTaskModalGoal(goal.id); setTaskModalMilestone(milestone.id); setTaskModalInput(''); setShowTaskModal(true); }} style={{ background: 'linear-gradient(135deg, #9333ea 0%, #7c3aed 100%)', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 12px rgba(147, 51, 234, 0.2)', fontSize: '12px', transition: 'all 0.2s' }}>+ Task</button>
                            </div>
                            {/* List Tasks */}
                            <ul style={{ marginLeft: '0.8rem', marginBottom: 0 }}>
                                      {milestone.tasks.map(task => (
                                        <li key={task.id} onClick={() => setTaskDetailModal({ open: true, goalId: goal.id, milestoneId: milestone.id, taskId: task.id, title: task.title, userStories: task.userStories || '', assignedTo: task.assignedTo || '', startDate: task.startDate || '', endDate: task.endDate || '', status: task.status || 'Not Started' })} style={{
                                          marginBottom: '0.45rem',
                                          background: '#fff',
                                          borderRadius: '8px',
                                          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
                                          padding: '0.6rem',
                                          display: 'grid',
                                          gridTemplateColumns: 'repeat(4, 1fr)',
                                          alignItems: 'center',
                                          gap: '0.6rem',
                                          minWidth: '220px',
                                          maxWidth: '100%',
                                          border: '1px solid #eaeef2',
                                          cursor: 'pointer'
                                        }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, background: task.status === 'Done' ? '#10b981' : task.status === 'In Progress' ? '#f59e0b' : '#6b7280' }} />
                                            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</div>
                                          </div>
                                          <div style={{ fontSize: '0.9rem', color: '#475569', display: 'flex', alignItems: 'center' }}>{task.assignedTo ? `Assigned: ${task.assignedTo}` : ''}</div>
                                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                                            <select
                                              value={task.status || 'Not Started'}
                                              onClick={e => e.stopPropagation()}
                                              onChange={e => {
                                                const newStatus = e.target.value;
                                                setGoalsForCurrent(goals => goals.map(g => g.id === goal.id ? {
                                                  ...g,
                                                  milestones: g.milestones.map(m => m.id === milestone.id ? {
                                                    ...m,
                                                    tasks: m.tasks.map(t => t.id === task.id ? { ...t, status: newStatus } : t)
                                                  } : m)
                                                } : g));
                                              }}
                                              style={{
                                                fontSize: '0.92rem',
                                                fontWeight: 700,
                                                borderRadius: '8px',
                                                padding: '0.22rem 0.9rem',
                                                background: task.status === 'Done' ? '#d1fae5' : task.status === 'In Progress' ? '#fef3c7' : '#f3f4f6',
                                                color: task.status === 'Done' ? '#065f46' : task.status === 'In Progress' ? '#92400e' : '#374151',
                                                border: '1px solid rgba(0,0,0,0.06)',
                                                minWidth: '96px',
                                                cursor: 'pointer',
                                                boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.02)'
                                              }}
                                            >
                                              <option value="Not Started">Not Started</option>
                                              <option value="In Progress">In Progress</option>
                                              <option value="Done">Done</option>
                                            </select>
                                          </div>
                                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.35rem' }}>
                                            <button type="button" title="Edit" onClick={e => { e.stopPropagation(); handleEditTask(goal.id, milestone.id, task); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                              <svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l7.1-7.1-2.5-2.5L4 13.5z" stroke="#4f8cff" strokeWidth="1.5" fill="#e0e7ff"/><path d="M14.6 6.1a1.1 1.1 0 0 0 0-1.6l-1.1-1.1a1.1 1.1 0 0 0-1.6 0l-0.9 0.9 2.5 2.5 1.1-1.1z" fill="#4f8cff"/></svg>
                                            </button>
                                            <button type="button" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteTask(goal.id, milestone.id, task.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                              <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5" fill="#fee2e2"/><rect x="4.5" y="7.25" width="7" height="1.5" rx="0.75" fill="#dc2626"/></svg>
                                            </button>
                                          </div>
                                        </li>
                                      ))}
                              </ul>
                            </div>
                          ))}
                        </motion.div>
                      ))}
                  </div>
                )}
                {activeTab === 'Achievements' && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '1rem' }}>🎉 Achievements</div>
                    <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                      {goals.filter(goal => {
                        const allTasks = goal.milestones.flatMap(m => m.tasks);
                        return allTasks.length > 0 && allTasks.every(t => t.status === 'Done');
                      }).length === 0 && (
                        <span style={{ color: '#888' }}>No completed goals yet.</span>
                      )}
                      {goals.filter(goal => {
                        const allTasks = goal.milestones.flatMap(m => m.tasks);
                        return allTasks.length > 0 && allTasks.every(t => t.status === 'Done');
                      }).map(goal => (
                        <div key={goal.id} style={{ background: '#fef9c3', borderRadius: '8px', padding: '0.7rem 1.2rem', fontWeight: 'bold', fontSize: '1rem', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>🏆 {goal.title}</div>
                      ))}
                    </div>
                  </div>
                )}
                {activeTab === 'Progress' && (
                  <div>
                    <div style={{ fontWeight: 'bold', marginBottom: '1rem', fontSize: '1.2rem' }}>Progress Overview</div>
                    {goals.length === 0 ? (
                      <p>No goals yet. Add goals to start tracking progress.</p>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', background: '#fff', borderRadius: '8px', overflow: 'hidden', border: '1px solid #f3f4f6' }}>
                          <thead>
                            <tr style={{ textAlign: 'left', background: '#F3F3F2' }}>
                              <th style={{ padding: '0.9rem 1rem', fontSize: '0.95rem', width: '25%' }}>Goal</th>
                              <th style={{ padding: '0.9rem 1rem', fontSize: '0.95rem', width: '25%' }}>Priority</th>
                              <th style={{ padding: '0.9rem 1rem', fontSize: '0.95rem', width: '25%' }}>Status</th>
                              <th style={{ padding: '0.9rem 1rem', fontSize: '0.95rem', width: '25%' }}>Tasks</th>
                            </tr>
                          </thead>
                          <tbody>
                            {goals.map(goal => {
                              const allTasks = goal.milestones.flatMap(m => m.tasks);
                              const done = allTasks.filter(t => t.status === 'Done').length;
                              const total = allTasks.length || 0;
                              const percent = total === 0 ? 0 : Math.round((done / total) * 100);
                              return (
                                <tr key={goal.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                                  <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}>
                                    <div style={{ fontWeight: 600, color: '#232946' }}>{goal.title}</div>
                                    <div style={{ fontSize: '0.85rem', color: '#666' }}>{done} of {total} tasks done</div>
                                  </td>
                                  <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}>
                                    <select value={goal.priority || 'Medium'} onChange={e => {
                                      const newPriority = e.target.value;
                                      setGoalsForCurrent(prev => prev.map(g => g.id === goal.id ? { ...g, priority: newPriority } : g));
                                    }} style={{ padding: '0.45rem 0.6rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.06)', background: '#fff', fontWeight: 700 }}>
                                      <option value="High">🔴 High</option>
                                      <option value="Medium">🟡 Medium</option>
                                      <option value="Low">⚪ Low</option>
                                    </select>
                                  </td>
                                  <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                      <div style={{ flex: 1, height: '12px', background: '#eef2f1', borderRadius: '999px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#16a34a' : '#22c55e', transition: 'width 0.4s' }} />
                                      </div>
                                      <div style={{ fontWeight: 700, color: '#222', minWidth: '48px', textAlign: 'right' }}>{percent}%</div>
                                    </div>
                                  </td>
                                  <td style={{ padding: '0.9rem 1rem', verticalAlign: 'top' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                      {allTasks.length === 0 && <div style={{ color: '#888', fontSize: '0.9rem' }}>No tasks</div>}
                                      {allTasks.map(t => (
                                        <div key={t.id || t._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem', padding: '0.4rem', background: '#fbfbff', borderRadius: '6px', border: '1px solid #f1f5f9' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: t.status === 'Done' ? '#8b5cf6' : t.status === 'In Progress' ? '#a855f7' : '#d1d5db' }} />
                                            <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#222', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title}</div>
                                            {t.assignedTo && <div style={{ fontSize: '0.85rem', color: '#43d9ad', marginLeft: '0.6rem' }}>({t.assignedTo})</div>}
                                          </div>
                                          <div style={{ fontSize: '0.85rem', color: t.status === 'Done' ? '#22c55e' : t.status === 'In Progress' ? '#b45309' : '#666', fontWeight: 600 }}>{t.status}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                {activeTab === 'Tasks' && (
                  <div>
                    {goals.length === 0 ? (
                      <p>No goals yet. Add goals to start tracking tasks.</p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {goals.map(goal => (
                          <div key={goal.id} style={{ background: '#fff', borderRadius: '10px', boxShadow: '0 2px 12px rgba(0,0,0,0.10)', padding: '1.1rem 1.5rem', minWidth: '220px', maxWidth: '100%', border: '1.5px solid #f3f4f6' }}>
                            <div style={{ fontWeight: 600, fontSize: '1.1rem', color: '#232946', marginBottom: '0.7rem' }}>{goal.title}</div>
                            {goal.milestones.length === 0 ? (
                              <div style={{ color: '#888', fontSize: '0.97rem' }}>No milestones for this goal.</div>
                            ) : (
                              goal.milestones.map(milestone => (
                                <div key={milestone.id} style={{ marginBottom: '0.7rem' }}>
                                  <div style={{ fontWeight: 500, fontSize: '1rem', color: '#4f8cff', marginBottom: '0.3rem' }}>{milestone.title}</div>
                                  {milestone.tasks.length === 0 ? (
                                    <div style={{ color: '#aaa', fontSize: '0.95rem', marginLeft: '1.2rem' }}>No tasks for this milestone.</div>
                                  ) : (
                                    <ul style={{ marginLeft: '1.2rem', marginBottom: 0 }}>
                                      {milestone.tasks.map(task => (
                                        <li key={task.id} style={{
                                          marginBottom: '0.7rem',
                                          background: '#fff',
                                          borderRadius: '10px',
                                          boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                                          padding: '0.7rem 1.2rem',
                                          display: 'flex',
                                          flexDirection: 'column',
                                          minWidth: '220px',
                                          maxWidth: '100%',
                                          border: '1px solid #e5e7eb',
                                          gap: '0.7rem',
                                          cursor: 'pointer'
                                        }} onClick={() => setTaskDetailModal({ open: true, goalId: goal.id, milestoneId: milestone.id, taskId: task.id, title: task.title, userStories: task.userStories || '', assignedTo: task.assignedTo || '', startDate: task.startDate || '', endDate: task.endDate || '', status: task.status || 'Not Started' })}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                                            <span style={{ fontWeight: 500, fontSize: '1.05rem', flex: 1, display: 'flex', alignItems: 'center' }}>
                                              {task.title}
                                              {task.assignedTo && (
                                                <span style={{ color: '#43d9ad', fontSize: '0.93rem', marginLeft: '0.4rem', fontWeight: 400 }}>({task.assignedTo})</span>
                                              )}
                                            </span>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                              <span style={{
                                                fontSize: '0.97rem',
                                                fontWeight: 600,
                                                borderRadius: '6px',
                                                padding: '0.18rem 0.7rem',
                                                background: task.status === 'Done' ? '#e9d5ff' : task.status === 'In Progress' ? '#f3e8ff' : '#f3f4f6',
                                                color: task.status === 'Done' ? '#22c55e' : task.status === 'In Progress' ? '#facc15' : '#888',
                                                border: '1px solid #e5e7eb',
                                                minWidth: '90px',
                                                textAlign: 'center'
                                              }}>{task.status}</span>
                                              <button type="button" title="Edit" onClick={e => { e.stopPropagation(); handleEditTask(goal.id, milestone.id, task); }} style={{ background: 'none', border: 'none', cursor: 'pointer', marginRight: '0.3rem', padding: 0 }}>
                                                <svg width="18" height="18" viewBox="0 0 20 20" fill="none"><path d="M4 13.5V16h2.5l7.1-7.1-2.5-2.5L4 13.5z" stroke="#4f8cff" strokeWidth="1.5" fill="#e0e7ff"/><path d="M14.6 6.1a1.1 1.1 0 0 0 0-1.6l-1.1-1.1a1.1 1.1 0 0 0-1.6 0l-0.9 0.9 2.5 2.5 1.1-1.1z" fill="#4f8cff"/></svg>
                                              </button>
                                              <button type="button" title="Delete" onClick={e => { e.stopPropagation(); handleDeleteTask(goal.id, milestone.id, task.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                                                <svg width="18" height="18" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#dc2626" strokeWidth="1.5" fill="#fee2e2"/><rect x="4.5" y="7.25" width="7" height="1.5" rx="0.75" fill="#dc2626"/></svg>
                                              </button>
                                            </div>
                                          </div>
                                          {/* Attachments area */}
                                          <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8rem' }}>
                                            <input type="file" id={`upload-${task.id}`} style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (f) handleFileUpload(selectedWorkspace, task, f); }} />
                                            <label onClick={e => e.stopPropagation()} htmlFor={`upload-${task.id}`} style={{ cursor: 'pointer', padding: '0.38rem 0.7rem', background: '#f3f4f6', borderRadius: '6px', border: '1px solid #e5e7eb', fontSize: '0.95rem' }}>{uploadingTaskId === (task.id || task._id) ? 'Uploading...' : 'Attach file'}</label>
                                            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', width: '100%' }}>
                                              {(task.attachments || []).map((a, ai) => (
                                                <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', justifyContent: 'center' }}>
                                                  <a href={a.url.startsWith('http') ? a.url : `${API_BASE_URL}${a.url}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.85rem', color: '#2563eb', textAlign: 'center' }}>{a.originalName || a.filename}</a>
                                                  <button onClick={e => { e.stopPropagation(); deleteAttachment(selectedWorkspace, task, a.filename); }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '5px', padding: '0.14rem 0.4rem', fontSize: '0.75rem', cursor: 'pointer' }}>Remove</button>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        </li>
                                      ))}
        {/* Edit Task Modal is rendered at top-level further down to avoid nesting issues */}
        <AnimatePresence>
          {taskDetailModal.open && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{ 
                position: 'fixed', 
                top: 0, 
                left: 0, 
                width: '100%', 
                height: '100vh', 
                zIndex: 6000,
                pointerEvents: 'none'
              }}
            >
              {/* overlay: clicking it closes the drawer */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setTaskDetailModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', userStories: '', assignedTo: '', startDate: '', endDate: '' })} 
                style={{ 
                  position: 'absolute', 
                  inset: 0, 
                  background: 'rgba(0,0,0,0.4)', 
                  backdropFilter: 'blur(8px)',
                  pointerEvents: 'auto'
                }} 
              />
              <motion.aside 
                role="dialog" 
                aria-modal="true" 
                initial={{ x: '100%', opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: '100%', opacity: 0 }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                style={{ 
                  position: 'fixed', 
                  top: 0, 
                  right: 0, 
                  height: '100vh', 
                  width: '90%',
                  maxWidth: '480px',
                  background: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '32px 0 0 32px',
                  padding: '32px 28px', 
                  boxShadow: '-20px 0 60px rgba(0,0,0,0.15)', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '24px', 
                  overflowY: 'auto',
                  pointerEvents: 'auto'
                }}
              >
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <h2 style={{ 
                  margin: 0, 
                  fontWeight: '800', 
                  fontSize: '28px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                }}>
                  Task Details
                </h2>
                <motion.button 
                  onClick={() => setTaskDetailModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', userStories: '', assignedTo: '', startDate: '', endDate: '' })} 
                  whileHover={{ scale: 1.1, rotate: 90 }}
                  whileTap={{ scale: 0.9 }}
                  style={{ 
                    background: 'rgba(255, 255, 255, 0.2)', 
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: '12px',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer', 
                    fontSize: '18px',
                    color: '#667eea',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s'
                  }}
                >
                  ✕
                </motion.button>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
              >
                <motion.input
                  type="text"
                  value={taskDetailModal.title}
                  onChange={e => setTaskDetailModal(m => ({ ...m, title: e.target.value }))}
                  placeholder="Task title"
                  whileFocus={{ scale: 1.02 }}
                  style={{ 
                    padding: '16px 20px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255, 255, 255, 0.3)', 
                    fontSize: '16px', 
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    fontWeight: '500',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s',
                    color: '#1f2937'
                  }}
                />

                <motion.textarea
                  value={taskDetailModal.userStories}
                  onChange={e => setTaskDetailModal(m => ({ ...m, userStories: e.target.value }))}
                  placeholder="User stories / description"
                  rows={6}
                  whileFocus={{ scale: 1.02 }}
                  style={{ 
                    padding: '16px 20px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255, 255, 255, 0.3)', 
                    background: 'rgba(255, 255, 255, 0.8)',
                    backdropFilter: 'blur(10px)',
                    fontWeight: '500',
                    fontSize: '14px',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                    transition: 'all 0.2s',
                    color: '#1f2937',
                    resize: 'vertical',
                    fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                  }}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151',
                    fontWeight: '600',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                  }}>
                    Assign to
                  </label>
                  <motion.select
                    value={taskDetailModal.assignedTo || ''}
                    onChange={e => setTaskDetailModal(m => ({ ...m, assignedTo: e.target.value }))}
                    whileFocus={{ scale: 1.02 }}
                    style={{ 
                      width: '100%', 
                      padding: '16px 20px', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255, 255, 255, 0.3)', 
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      fontWeight: '500',
                      fontSize: '14px',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s',
                      color: '#1f2937'
                    }}
                  >
                    <option value="">Assign to...</option>
                    {(workspaces.find(ws => ws.id === selectedWorkspace)?.members || []).map((m, idx) => {
                      const currentWorkspace = workspaces.find(ws => ws.id === selectedWorkspace);
                      const isOwner = currentWorkspace?.owner === m;
                      return (
                        <option key={idx} value={m}>
                          {m} {isOwner ? '👑' : ''}
                        </option>
                      );
                    })}
                  </motion.select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151',
                    fontWeight: '600',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                  }}>
                    Start date
                  </label>
                  <motion.input
                    type="date"
                    value={taskDetailModal.startDate || ''}
                    onChange={e => setTaskDetailModal(m => ({ ...m, startDate: e.target.value }))}
                    whileFocus={{ scale: 1.02 }}
                    style={{ 
                      width: '100%', 
                      padding: '16px 20px', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255, 255, 255, 0.3)', 
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      fontWeight: '500',
                      fontSize: '14px',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s',
                      color: '#1f2937'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ 
                    fontSize: '14px', 
                    color: '#374151',
                    fontWeight: '600',
                    textShadow: '0 1px 2px rgba(0, 0, 0, 0.1)'
                  }}>
                    End date
                  </label>
                  <motion.input
                    type="date"
                    value={taskDetailModal.endDate || ''}
                    onChange={e => setTaskDetailModal(m => ({ ...m, endDate: e.target.value }))}
                    whileFocus={{ scale: 1.02 }}
                    style={{ 
                      width: '100%', 
                      padding: '16px 20px', 
                      borderRadius: '16px', 
                      border: '1px solid rgba(255, 255, 255, 0.3)', 
                      background: 'rgba(255, 255, 255, 0.8)',
                      backdropFilter: 'blur(10px)',
                      fontWeight: '500',
                      fontSize: '14px',
                      boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)',
                      transition: 'all 0.2s',
                      color: '#1f2937'
                    }}
                  />
                </div>

                {/* Status is edited inline on task rows; removed from Task Details to avoid duplication. */}
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                style={{ 
                  position: 'sticky', 
                  bottom: 0, 
                  display: 'flex', 
                  gap: '12px', 
                  paddingTop: '24px', 
                  paddingBottom: '16px', 
                  background: 'rgba(255, 255, 255, 0.95)', 
                  backdropFilter: 'blur(20px)',
                  borderTop: '1px solid rgba(255, 255, 255, 0.3)',
                  borderRadius: '20px 20px 0 0',
                  marginLeft: '-28px',
                  marginRight: '-28px',
                  paddingLeft: '28px',
                  paddingRight: '28px'
                }}
              >
                <motion.button 
                  onClick={() => setTaskDetailModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', userStories: '', assignedTo: '', startDate: '', endDate: '' })} 
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{ 
                    padding: '16px 24px', 
                    borderRadius: '16px', 
                    border: '1px solid rgba(255, 255, 255, 0.3)', 
                    background: 'rgba(255, 255, 255, 0.5)',
                    backdropFilter: 'blur(10px)',
                    color: '#374151',
                    fontWeight: '600',
                    fontSize: '14px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    flex: 1
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button 
                  onClick={() => {
                    // Save changes to the specific task in goals and persist
                    setGoalsForCurrent(prevGoals => prevGoals.map(g => g.id === taskDetailModal.goalId ? {
                      ...g,
                      milestones: g.milestones.map(m => m.id === taskDetailModal.milestoneId ? {
                        ...m,
                        tasks: m.tasks.map(t => t.id === taskDetailModal.taskId ? { 
                          ...t, 
                          title: taskDetailModal.title, 
                          userStories: taskDetailModal.userStories, 
                          assignedTo: taskDetailModal.assignedTo,
                          startDate: taskDetailModal.startDate, 
                          endDate: taskDetailModal.endDate
                        } : t)
                      } : m)
                    } : g));
                    setTaskDetailModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', userStories: '', assignedTo: '', startDate: '', endDate: '' });
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    boxShadow: '0 15px 35px rgba(102, 126, 234, 0.4)'
                  }}
                  whileTap={{ scale: 0.98 }}
                  style={{ 
                    padding: '16px 24px', 
                    borderRadius: '16px', 
                    border: 'none', 
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                    color: '#fff',
                    fontWeight: '700',
                    fontSize: '14px',
                    cursor: 'pointer',
                    boxShadow: '0 10px 25px rgba(102, 126, 234, 0.3)',
                    transition: 'all 0.2s',
                    flex: 1
                  }}
                >
                  Save Changes
                </motion.button>
              </motion.div>
            </motion.aside>
          </motion.div>
        )}
        </AnimatePresence>
                                    </ul>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {/* Modal for Add Task in Tasks Tab */}
                    {showTaskModal && (
                      <div style={{ 
                        position: 'fixed', 
                        top: 0, 
                        left: 0, 
                        width: '100%', 
                        height: '100vh', 
                        background: 'rgba(0,0,0,0.25)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        zIndex: 2000 
                      }}>
                        <div style={{ background: '#fff', padding: '2.2rem 2rem', borderRadius: '12px', minWidth: '340px', boxShadow: '0 8px 32px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', gap: '1.2rem', border: '2px solid #4f8cff' }}>
                          <h2 style={{ marginBottom: '0.5rem', fontWeight: 700, color: '#232946' }}>Add Task</h2>
                          <form onSubmit={e => {
                            e.preventDefault();
                            if (newTask.trim()) {
                              // Add to the first goal/milestone for demo; in real app, let user pick
                              if (goals.length > 0 && goals[0].milestones.length > 0) {
                                setGoalsForCurrent(goals => goals.map((g, gi) => gi === 0 ? {
                                  ...g,
                                  milestones: g.milestones.map((m, mi) => mi === 0 ? {
                                    ...m,
                                    tasks: [...m.tasks, { id: Date.now(), title: newTask.trim(), status: 'Not Started' }]
                                  } : m)
                                } : g));
                                setNewTask('');
                                setShowTaskModal(false);
                              }
                            }
                          }}>
                            <input
                              type="text"
                              placeholder="Task name"
                              value={newTask}
                              onChange={e => setNewTask(e.target.value)}
                              required
                              style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1.5px solid #4f8cff', marginBottom: '1.2rem', fontSize: '1.05rem' }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1.2rem' }}>
                              <button type="button" onClick={() => setShowTaskModal(false)} style={{ padding: '0.6rem 1.2rem', background: '#eee', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
                              <button type="submit" style={{ padding: '0.6rem 1.2rem', background: '#4f8cff', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>Add Task</button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            </motion.div>
          ) : (
            <div style={{ color: '#888', fontSize: '1.2rem' }}>No workspace selected.</div>
          )}
        </main>

        {/* Modal for Create Workspace */}
        {showModal && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100vh', 
            background: 'rgba(0, 0, 0, 0.4)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1000 
          }}>
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
              style={{ 
                background: 'rgba(255, 255, 255, 0.95)', 
                backdropFilter: 'blur(20px)',
                padding: '2rem', 
                borderRadius: '24px', 
                minWidth: '400px', 
                boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <h2 style={{ 
                marginBottom: '1.5rem', 
                color: '#1a202c', 
                fontWeight: 700, 
                fontSize: '1.5rem',
                textAlign: 'center',
                margin: '0 0 1.5rem 0'
              }}>Create Workspace</h2>
              <form onSubmit={handleCreateWorkspace}>
                <input
                  type="text"
                  placeholder="Workspace Name"
                  value={workspaceName}
                  onChange={e => setWorkspaceName(e.target.value)}
                  required
                  style={{ 
                    width: '100%', 
                    padding: '12px 16px', 
                    borderRadius: '12px', 
                    border: '2px solid rgba(102, 126, 234, 0.2)', 
                    background: 'rgba(255, 255, 255, 0.8)', 
                    color: '#1a202c', 
                    marginBottom: '1.5rem',
                    fontSize: '16px',
                    outline: 'none',
                    transition: 'all 0.3s ease',
                    boxSizing: 'border-box'
                  }}
                  onFocus={e => e.target.style.borderColor = '#667eea'}
                  onBlur={e => e.target.style.borderColor = 'rgba(102, 126, 234, 0.2)'}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <motion.button 
                    type="button" 
                    onClick={() => setShowModal(false)} 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                      padding: '12px 24px', 
                      background: 'rgba(255, 255, 255, 0.8)', 
                      color: '#4a5568', 
                      border: '2px solid rgba(255, 255, 255, 0.3)', 
                      borderRadius: '12px', 
                      fontWeight: '600', 
                      cursor: 'pointer',
                      backdropFilter: 'blur(10px)',
                      fontSize: '14px'
                    }}
                  >Cancel</motion.button>
                  <motion.button 
                    type="submit" 
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{ 
                      padding: '12px 24px', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '12px', 
                      fontWeight: '600', 
                      cursor: 'pointer',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)',
                      fontSize: '14px'
                    }}
                  >Create</motion.button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Edit Task Modal (top-level) */}
        {editTaskModal.open && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100vh', 
            background: 'rgba(0,0,0,0.18)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 6000 
          }}>
            <div style={{ background: '#F3F3F2', borderRadius: '10px', minWidth: '320px', maxHeight: '80vh', width: 'min(92%,480px)', boxShadow: '0 8px 40px rgba(0,0,0,0.22)', display: 'flex', flexDirection: 'column', color: '#222' }}>
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                <h2 style={{ margin: 0, fontWeight: 600, color: '#222' }}>Edit Task</h2>
              </div>
              <div style={{ padding: '1rem 1.25rem', overflowY: 'auto', flex: '1 1 auto' }}>
                <input
                  type="text"
                  value={editTaskModal.title}
                  onChange={e => setEditTaskModal(modal => ({ ...modal, title: e.target.value }))}
                  placeholder="Task name"
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #A6B2A0', marginBottom: '1rem', background: '#FAF9EE', color: '#222' }}
                />
              </div>
              <div style={{ position: 'sticky', bottom: 0, padding: '0.75rem 1.25rem', background: '#F3F3F2', borderTop: '1px solid rgba(0,0,0,0.04)', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                <button type="button" onClick={() => setEditTaskModal({ open: false, goalId: null, milestoneId: null, taskId: null, title: '', status: 'Not Started' })} style={{ padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.8)', color: '#374151', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', backdropFilter: 'blur(10px)' }}>Cancel</button>
                <button type="button" onClick={handleEditTaskSave} style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)' }}>Save</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal for Add Task */}
        {showTaskModal && (
          <div style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100vh', 
            background: 'rgba(0,0,0,0.25)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 1100 
          }}>
            <div style={{ background: '#F3F3F2', padding: '2rem', borderRadius: '10px', minWidth: '320px', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', gap: '1rem', color: '#222' }}>
              <h2 style={{ marginBottom: '0.5rem', fontWeight: 600, color: '#222' }}>Add Task</h2>
              <form onSubmit={e => {
                e.preventDefault();
                if (taskModalGoal && taskModalMilestone && taskModalInput.trim()) {
                  setGoalsForCurrent(prevGoals => prevGoals.map(g => g.id === taskModalGoal ? {
                    ...g,
                    milestones: g.milestones.map(m => m.id === taskModalMilestone ? {
                      ...m,
                      tasks: [...m.tasks, { id: Date.now(), title: taskModalInput.trim(), status: 'Not Started' }]
                    } : m)
                  } : g));
                  setShowTaskModal(false);
                  setTaskModalInput('');
                }
              }}>
                <input
                  type="text"
                  placeholder="Task name"
                  value={taskModalInput}
                  onChange={e => setTaskModalInput(e.target.value)}
                  required
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #A6B2A0', marginBottom: '1rem', background: '#FAF9EE', color: '#222' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                  <button type="button" onClick={() => setShowTaskModal(false)} style={{ padding: '0.5rem 1rem', background: 'rgba(255, 255, 255, 0.8)', color: '#374151', border: '1px solid rgba(255, 255, 255, 0.3)', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', backdropFilter: 'blur(10px)' }}>Cancel</button>
                  <button type="submit" style={{ padding: '0.5rem 1rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 15px rgba(102, 126, 234, 0.3)' }}>Add Task</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>

  );
}

export default Dashboard;
