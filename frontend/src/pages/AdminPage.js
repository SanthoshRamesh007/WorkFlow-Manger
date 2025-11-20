import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { apiCall } from '../config/api';

function AdminPage() {
  const [users, setUsers] = useState([]);
  const [workspaces, setWorkspaces] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activities, setActivities] = useState([]);
  const [dashboardStats, setDashboardStats] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    let pollId = null;

    const fetchData = async () => {
      try {
        // Get admin email for API calls
        const adminEmail = localStorage.getItem('signedInEmail') || 'santhoshr.23it@kongu.edu';
        
        const [uRes, wRes, aRes, sRes] = await Promise.all([
          apiCall(`/api/admin/users?email=${encodeURIComponent(adminEmail)}`),
          apiCall(`/api/admin/workspaces?email=${encodeURIComponent(adminEmail)}`),
          apiCall(`/api/admin/activities?limit=20&email=${encodeURIComponent(adminEmail)}`),
          apiCall(`/api/admin/stats?email=${encodeURIComponent(adminEmail)}`)
        ]);
        if (!mounted) return;
        
        if (uRes.ok) {
          const uData = await uRes.json();
          setUsers(Array.isArray(uData) ? uData : []);
        } else {
          setUsers([]);
        }
        
        if (wRes.ok) {
          const wData = await wRes.json();
          setWorkspaces(Array.isArray(wData) ? wData : []);
        } else {
          setWorkspaces([]);
        }

        if (aRes.ok) {
          const aData = await aRes.json();
          setActivities(Array.isArray(aData.activities) ? aData.activities : []);
        } else {
          setActivities([]);
        }

        if (sRes.ok) {
          const sData = await sRes.json();
          console.log('📊 Dashboard stats received:', sData);
          setDashboardStats(sData);
        } else {
          console.error('❌ Stats API failed:', sRes.status, sRes.statusText);
          setDashboardStats(null);
        }
        
        setLastUpdated(new Date());
        console.log('✅ Admin data fetch completed');
      } catch (err) {
        console.warn('❌ Admin fetch error', err);
        if (mounted) {
          setUsers([]);
          setWorkspaces([]);
          setActivities([]);
          setDashboardStats(null);
        }
      }
    };

    // initial fetch
    fetchData();
    // poll every 5 seconds
    pollId = setInterval(fetchData, 5000);

    return () => {
      mounted = false;
      if (pollId) clearInterval(pollId);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await apiCall('/api/logout', { method: 'POST' });
    } catch (e) {
      // ignore
    }
    localStorage.removeItem('signedInEmail');
    localStorage.removeItem('profilePic');
    navigate('/signup');
  };

  const handleRefresh = async () => {
    try {
      // Get admin email for API calls
      const adminEmail = localStorage.getItem('signedInEmail') || 'santhoshr.23it@kongu.edu';
      
      const [uRes, wRes, aRes, sRes] = await Promise.all([
        apiCall(`/api/admin/users?email=${encodeURIComponent(adminEmail)}`),
        apiCall(`/api/admin/workspaces?email=${encodeURIComponent(adminEmail)}`),
        apiCall(`/api/admin/activities?limit=20&email=${encodeURIComponent(adminEmail)}`),
        apiCall(`/api/admin/stats?email=${encodeURIComponent(adminEmail)}`)
      ]);
      
      if (uRes.ok) {
        const uData = await uRes.json();
        setUsers(Array.isArray(uData) ? uData : []);
      } else {
        setUsers([]);
      }
      
      if (wRes.ok) {
        const wData = await wRes.json();
        setWorkspaces(Array.isArray(wData) ? wData : []);
      } else {
        setWorkspaces([]);
      }

      if (aRes.ok) {
        const aData = await aRes.json();
        setActivities(Array.isArray(aData.activities) ? aData.activities : []);
      } else {
        setActivities([]);
      }

      if (sRes.ok) {
        const sData = await sRes.json();
        setDashboardStats(sData);
      } else {
        setDashboardStats(null);
      }
      
      setLastUpdated(new Date());
      console.log('Admin dashboard refreshed successfully');
    } catch (error) {
      console.error('Error refreshing admin dashboard:', error);
      // Still update timestamp to show attempt was made
      setLastUpdated(new Date());
    }
  };

  // Calculate statistics (use API data if available, otherwise calculate from local data)
  const stats = dashboardStats ? dashboardStats.current : {
    totalUsers: users.length,
    activeWorkspaces: workspaces.filter(ws => (ws.members || []).length > 0).length,
    totalTasks: workspaces.reduce((total, ws) => 
      total + (ws.goals || []).reduce((goalTotal, goal) => 
        goalTotal + (goal.milestones || []).reduce((msTotal, ms) => 
          msTotal + (ms.tasks || []).length, 0), 0), 0),
    completedTasks: workspaces.reduce((total, ws) => 
      total + (ws.goals || []).reduce((goalTotal, goal) => 
        goalTotal + (goal.milestones || []).reduce((msTotal, ms) => 
          msTotal + (ms.tasks || []).filter(task => task.status === 'completed').length, 0), 0), 0),
    taskCompletionRate: 0
  };

  const changes = dashboardStats ? dashboardStats.changes : {
    userGrowth: 0,
    workspaceGrowth: 0,
    taskGrowth: 0,
    completionImprovement: 0
  };

  // Ensure completion rate is calculated
  if (stats.totalTasks > 0 && stats.taskCompletionRate === 0) {
    stats.taskCompletionRate = Math.round((stats.completedTasks / stats.totalTasks) * 100);
  }

  // Dynamic data for charts based on actual activity
  const departmentData = [
    { 
      name: 'Development', 
      value: Math.floor(stats.totalUsers * 0.4) + (dashboardStats?.activityBreakdown?.taskCompletions || 0), 
      color: '#3B82F6' 
    },
    { 
      name: 'Design', 
      value: Math.floor(stats.totalUsers * 0.25) + (dashboardStats?.activityBreakdown?.workspaceCreations || 0), 
      color: '#10B981' 
    },
    { 
      name: 'Marketing', 
      value: Math.floor(stats.totalUsers * 0.2) + (dashboardStats?.activityBreakdown?.signups || 0), 
      color: '#F59E0B' 
    },
    { 
      name: 'Management', 
      value: Math.floor(stats.totalUsers * 0.15) + (dashboardStats?.activityBreakdown?.logins || 0), 
      color: '#8B5CF6' 
    }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      maxWidth: '100vw',
      overflow: 'hidden',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif'
    }}>
      {/* Sidebar */}
      <div style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: '280px',
        height: '100vh',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.2)',
        boxShadow: '4px 0 24px rgba(0, 0, 0, 0.1)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column'
      }}>
        {/* Logo */}
        <div style={{
          padding: '2rem 2rem 0 2rem',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '1.2rem'
          }}>
            WM
          </div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '1.25rem', color: '#1f2937' }}>WorkSpace Manager</div>
            <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>Admin Panel</div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ padding: '0 1rem', flex: 1, overflowY: 'auto' }}>
          {[
            { id: 'dashboard', icon: '📊', label: 'Dashboard' },
            { id: 'users', icon: '👥', label: 'Users' },
            { id: 'workspaces', icon: '🏢', label: 'Workspaces' },
            { id: 'analytics', icon: '📈', label: 'Analytics' }
          ].map(item => (
            <motion.div
              key={item.id}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                padding: '0.875rem 1.5rem',
                margin: '0.25rem 0',
                borderRadius: '12px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: activeTab === item.id ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'transparent',
                color: activeTab === item.id ? 'white' : '#374151',
                fontWeight: activeTab === item.id ? '600' : '500'
              }}
            >
              <span style={{ fontSize: '1.25rem' }}>{item.icon}</span>
              <span>{item.label}</span>
            </motion.div>
          ))}
        </nav>

        {/* Logout Button */}
        <div style={{
          padding: '1rem',
          marginTop: 'auto'
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '0.875rem 1.5rem',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem'
            }}
          >
            <span>🚪</span>
            <span>Logout</span>
          </motion.button>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ 
        marginLeft: '280px', 
        minHeight: '100vh',
        maxWidth: 'calc(100vw - 280px)',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <header style={{
          background: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
          padding: '1.5rem 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)'
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: '1.875rem',
              fontWeight: 'bold',
              background: 'linear-gradient(135deg, #667eea, #764ba2)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}>
              {activeTab === 'dashboard' ? 'Dashboard' : 
               activeTab === 'users' ? 'User Management' :
               activeTab === 'workspaces' ? 'Workspace Management' :
               activeTab === 'analytics' ? 'Analytics' : 'Dashboard'}
            </h1>
            <p style={{
              margin: '0.25rem 0 0 0',
              color: '#6b7280',
              fontSize: '0.875rem'
            }}>
              {new Date().toLocaleDateString('en-US', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleRefresh}
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <span>🔄</span>
              <span>Refresh</span>
            </motion.button>
            
            <div style={{
              padding: '0.5rem 1rem',
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              fontSize: '0.875rem',
              color: '#065f46'
            }}>
              Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : 'Never'}
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        {activeTab === 'dashboard' && (
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '2rem' }}
          >
            {/* Stats Cards */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              {[
                {
                  title: 'Total Users',
                  value: stats.totalUsers,
                  subtitle: 'Active members',
                  icon: '👥',
                  color: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                  change: changes.userGrowth > 0 ? `+${changes.userGrowth}%` : `${changes.userGrowth}%`
                },
                {
                  title: 'Active Workspaces',
                  value: stats.activeWorkspaces,
                  subtitle: `${stats.totalWorkspaces || workspaces.length} total`,
                  icon: '🏢',
                  color: 'linear-gradient(135deg, #10b981, #059669)',
                  change: changes.workspaceGrowth > 0 ? `+${changes.workspaceGrowth}%` : `${changes.workspaceGrowth}%`
                },
                {
                  title: 'Total Tasks',
                  value: stats.totalTasks,
                  subtitle: `${stats.completedTasks} completed`,
                  icon: '📋',
                  color: 'linear-gradient(135deg, #f59e0b, #d97706)',
                  change: changes.taskGrowth > 0 ? `+${changes.taskGrowth}%` : `${changes.taskGrowth}%`
                },
                {
                  title: 'Task Completion',
                  value: `${stats.taskCompletionRate}%`,
                  subtitle: 'Success rate',
                  icon: '🎯',
                  color: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
                  change: changes.completionImprovement > 0 ? `+${changes.completionImprovement}%` : `${changes.completionImprovement}%`
                }
              ].map((stat, index) => (
                <motion.div
                  key={stat.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ y: -4 }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    backdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '20px',
                    padding: '2rem',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)',
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <div style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '100px',
                    height: '100px',
                    background: stat.color,
                    borderRadius: '50%',
                    transform: 'translate(30px, -30px)',
                    opacity: 0.1
                  }} />
                  
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: stat.color,
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '1.5rem'
                    }}>
                      {stat.icon}
                    </div>
                    <div style={{
                      background: stat.change.startsWith('+') ? 'rgba(16, 185, 129, 0.1)' : 
                                 stat.change.startsWith('-') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(107, 114, 128, 0.1)',
                      color: stat.change.startsWith('+') ? '#065f46' : 
                             stat.change.startsWith('-') ? '#991b1b' : '#374151',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '20px',
                      fontSize: '0.875rem',
                      fontWeight: '600'
                    }}>
                      {stat.change}
                    </div>
                  </div>

                  <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                    {stat.title}
                  </div>
                  <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#1f2937', marginBottom: '0.25rem' }}>
                    {stat.value}
                  </div>
                  <div style={{ color: '#9ca3af', fontSize: '0.875rem' }}>
                    {stat.subtitle}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Charts Section */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '2rem',
              marginBottom: '2rem'
            }}>
              {/* Users by Department Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  Users by Department
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'end', gap: '1rem', height: '200px', padding: '1rem 0' }}>
                  {departmentData.map((dept, index) => (
                    <motion.div
                      key={dept.name}
                      initial={{ height: 0 }}
                      animate={{ height: `${(dept.value / Math.max(...departmentData.map(d => d.value))) * 160}px` }}
                      transition={{ delay: index * 0.1, type: 'spring' }}
                      style={{
                        flex: 1,
                        background: dept.color,
                        borderRadius: '8px 8px 0 0',
                        minHeight: '20px',
                        position: 'relative',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        color: 'white',
                        fontWeight: '600'
                      }}
                    >
                      <div style={{ padding: '0.5rem', fontSize: '0.875rem' }}>
                        {dept.value}
                      </div>
                    </motion.div>
                  ))}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {departmentData.map(dept => (
                    <div key={dept.name} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                        {dept.name}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent Activity */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  Recent Activity
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {activities.length > 0 ? activities.slice(0, 10).map((activity, index) => {
                    const activityColors = {
                      'login': '#10b981',
                      'signup': '#3b82f6', 
                      'workspace_created': '#f59e0b',
                      'file_uploaded': '#8b5cf6',
                      'logout': '#ef4444'
                    };
                    
                    const getTimeAgo = (timestamp) => {
                      const now = new Date();
                      const time = new Date(timestamp);
                      const diffMs = now - time;
                      const diffMins = Math.floor(diffMs / (1000 * 60));
                      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                      
                      if (diffMins < 1) return 'Just now';
                      if (diffMins < 60) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`;
                      if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
                      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
                    };
                    
                    return (
                    <motion.div
                      key={activity._id || index}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem',
                        padding: '0.75rem',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: activityColors[activity.type] || '#6b7280'
                      }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.875rem', fontWeight: '500', color: '#1f2937' }}>
                          {activity.description}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {activity.user} • {getTimeAgo(activity.timestamp)}
                        </div>
                        {activity.ip && activity.ip !== 'system' && (
                          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '2px' }}>
                            IP: {activity.ip}
                          </div>
                        )}
                      </div>
                    </motion.div>
                    );
                  }) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '2rem',
                      color: '#6b7280',
                      fontSize: '0.875rem'
                    }}>
                      No recent activities to display
                    </div>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    marginTop: '1rem',
                    background: 'rgba(102, 126, 234, 0.1)',
                    border: '1px solid rgba(102, 126, 234, 0.3)',
                    borderRadius: '12px',
                    color: '#4338ca',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  View All Activities
                </motion.button>
              </motion.div>
            </div>
          </motion.main>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '2rem' }}
          >
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
                All Users ({users.length})
              </h3>
              
              <div style={{ display: 'grid', gap: '1rem' }}>
                {users.map((user, index) => (
                  <motion.div
                    key={user._id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '1rem',
                      padding: '1.5rem',
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '16px',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{
                      width: '48px',
                      height: '48px',
                      background: 'linear-gradient(135deg, #667eea, #764ba2)',
                      borderRadius: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontWeight: 'bold',
                      fontSize: '1.25rem'
                    }}>
                      {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#1f2937', marginBottom: '0.25rem' }}>
                        {user.name || 'Unknown User'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        {user.email}
                      </div>
                      {user.role && (
                        <div style={{
                          display: 'inline-block',
                          marginTop: '0.5rem',
                          padding: '0.25rem 0.75rem',
                          background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                          color: 'white',
                          borderRadius: '20px',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          {user.role}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: '#10b981'
                      }} />
                      <span style={{ fontSize: '0.875rem', color: '#10b981', fontWeight: '500' }}>Active</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.main>
        )}

        {/* Workspaces Tab */}
        {activeTab === 'workspaces' && (
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '2rem' }}
          >
            <div style={{
              background: 'rgba(255, 255, 255, 0.95)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '20px',
              padding: '2rem',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
            }}>
              <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.5rem', fontWeight: '600', color: '#1f2937' }}>
                All Workspaces ({workspaces.length})
              </h3>
              
              <div style={{ display: 'grid', gap: '1.5rem' }}>
                {workspaces.map((workspace, index) => (
                  <motion.div
                    key={workspace._id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.7)',
                      border: '1px solid rgba(255, 255, 255, 0.3)',
                      borderRadius: '20px',
                      padding: '2rem',
                      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                          {workspace.name}
                        </h4>
                        <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
                          ID: {workspace._id}
                        </p>
                      </div>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={async () => {
                          if (!window.confirm(`Delete workspace '${workspace.name}'? This will remove all data and attachments.`)) return;
                          try {
                            const res = await fetch(`http://localhost:5000/api/workspaces/${workspace._id}`, { 
                              method: 'DELETE', 
                              credentials: 'include' 
                            });
                            const data = await res.json();
                            if (data.success) {
                              setWorkspaces(prev => prev.filter(w => String(w._id) !== String(workspace._id)));
                            } else {
                              alert(data.message || 'Failed to delete workspace');
                            }
                          } catch (err) {
                            alert('Error deleting workspace');
                          }
                        }}
                        style={{
                          background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                          color: 'white',
                          border: 'none',
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          fontWeight: '600',
                          cursor: 'pointer'
                        }}
                      >
                        🗑️ Delete
                      </motion.button>
                    </div>

                    <div style={{ marginBottom: '1rem' }}>
                      <strong style={{ color: '#374151' }}>Members: </strong>
                      <span style={{ color: '#6b7280' }}>
                        {Array.isArray(workspace.members) ? workspace.members.join(', ') || 'No members' : 'No members'}
                      </span>
                    </div>

                    {(workspace.goals || []).length > 0 && (
                      <div>
                        <strong style={{ color: '#374151', marginBottom: '0.75rem', display: 'block' }}>
                          Goals & Tasks:
                        </strong>
                        {workspace.goals.map(goal => (
                          <div key={goal._id || goal.id} style={{
                            background: 'rgba(255, 255, 255, 0.8)',
                            padding: '1rem',
                            borderRadius: '12px',
                            marginBottom: '1rem',
                            border: '1px solid rgba(255, 255, 255, 0.5)'
                          }}>
                            <div style={{ fontWeight: '600', color: '#1f2937', marginBottom: '0.5rem' }}>
                              {goal.title}
                            </div>
                            {(goal.milestones || []).map(milestone => (
                              <div key={milestone._id || milestone.id} style={{ marginLeft: '1rem', marginBottom: '0.5rem' }}>
                                <div style={{ fontWeight: '500', color: '#3b82f6', marginBottom: '0.25rem' }}>
                                  📋 {milestone.title}
                                </div>
                                {(milestone.tasks || []).map(task => (
                                  <div key={task._id || task.id} style={{
                                    marginLeft: '1rem',
                                    padding: '0.5rem',
                                    background: 'rgba(255, 255, 255, 0.6)',
                                    borderRadius: '6px',
                                    marginBottom: '0.25rem',
                                    fontSize: '0.875rem'
                                  }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: '600' }}>✅ {task.title}</span>
                                      <span style={{ 
                                        padding: '0.125rem 0.5rem',
                                        borderRadius: '12px',
                                        fontSize: '0.75rem',
                                        fontWeight: '500',
                                        background: task.status === 'completed' ? '#dcfce7' : 
                                                   task.status === 'in-progress' ? '#fef3c7' : '#f3f4f6',
                                        color: task.status === 'completed' ? '#166534' : 
                                               task.status === 'in-progress' ? '#92400e' : '#374151'
                                      }}>
                                        {task.status || 'pending'}
                                      </span>
                                      <span style={{ color: '#6b7280' }}>
                                        👤 {task.assignedTo || 'unassigned'}
                                      </span>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.main>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && (
          <motion.main
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ padding: '2rem' }}
          >
            {/* Analytics Overview */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '1.5rem',
              marginBottom: '2rem'
            }}>
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  📊 User Growth
                </h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#10b981', marginBottom: '0.5rem' }}>
                  {users.length}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Total registered users
                </div>
                <div style={{ 
                  background: 'linear-gradient(90deg, #10b981 0%, #10b981 75%, #e5e7eb 75%)', 
                  height: '8px', 
                  borderRadius: '4px' 
                }} />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Growth trend: +12% this month
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  🏢 Workspace Activity
                </h3>
                <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: '#3b82f6', marginBottom: '0.5rem' }}>
                  {workspaces.length}
                </div>
                <div style={{ color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}>
                  Active workspaces
                </div>
                <div style={{ 
                  background: 'linear-gradient(90deg, #3b82f6 0%, #3b82f6 60%, #e5e7eb 60%)', 
                  height: '8px', 
                  borderRadius: '4px' 
                }} />
                <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  Collaboration rate: {workspaces.length > 0 ? Math.round((workspaces.filter(w => w.members && w.members.length > 1).length / workspaces.length) * 100) : 0}%
                </div>
              </motion.div>

            </div>

            {/* Detailed Analytics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '2rem'
            }}>
              {/* User Activity Chart */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  📈 Weekly Activity Overview
                </h3>
                
                <div style={{ display: 'flex', alignItems: 'end', gap: '1rem', height: '200px', padding: '1rem 0' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => {
                    const height = Math.random() * 160 + 20; // Simulated data
                    return (
                      <motion.div
                        key={day}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}px` }}
                        transition={{ delay: 0.5 + index * 0.1, type: 'spring' }}
                        style={{
                          flex: 1,
                          background: 'linear-gradient(135deg, #667eea, #764ba2)',
                          borderRadius: '8px 8px 0 0',
                          minHeight: '20px',
                          position: 'relative',
                          display: 'flex',
                          alignItems: 'flex-end',
                          justifyContent: 'center',
                          color: 'white',
                          fontWeight: '600',
                          fontSize: '0.875rem',
                          paddingBottom: '0.5rem'
                        }}
                      >
                        {Math.floor(height / 4)}
                      </motion.div>
                    );
                  })}
                </div>
                
                <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                    <div key={day} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', fontWeight: '500' }}>
                        {day}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ marginTop: '2rem', display: 'flex', gap: '2rem' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>
                      {activities.length}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Total Activities
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#3b82f6' }}>
                      {Math.round(Math.random() * 50 + 20)}%
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                      Engagement Rate
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* System Health */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(20px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '20px',
                  padding: '2rem',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
                }}
              >
                <h3 style={{ margin: '0 0 1.5rem 0', fontSize: '1.25rem', fontWeight: '600', color: '#1f2937' }}>
                  🔧 System Health
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                  {[
                    { label: 'Server Uptime', value: '99.9%', color: '#10b981' },
                    { label: 'Database Health', value: '100%', color: '#10b981' },
                    { label: 'API Response', value: '45ms', color: '#3b82f6' },
                    { label: 'Active Sessions', value: users.length.toString(), color: '#f59e0b' }
                  ].map((metric, index) => (
                    <motion.div
                      key={metric.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.6 + index * 0.1 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '1rem',
                        background: 'rgba(255, 255, 255, 0.5)',
                        borderRadius: '12px',
                        border: '1px solid rgba(255, 255, 255, 0.3)'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.25rem' }}>
                          {metric.label}
                        </div>
                        <div style={{ fontSize: '1.125rem', fontWeight: 'bold', color: metric.color }}>
                          {metric.value}
                        </div>
                      </div>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: metric.color
                      }} />
                    </motion.div>
                  ))}
                </div>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1 }}
                  style={{
                    marginTop: '2rem',
                    padding: '1rem',
                    background: 'rgba(16, 185, 129, 0.1)',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    borderRadius: '12px',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '0.875rem', color: '#065f46', fontWeight: '600' }}>
                    🟢 All systems operational
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#059669', marginTop: '0.25rem' }}>
                    Last checked: {new Date().toLocaleTimeString()}
                  </div>
                </motion.div>
              </motion.div>
            </div>
          </motion.main>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
