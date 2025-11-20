import React, { useState, useEffect } from 'react';


function ProfilePage() {
  // Try to get signed in user email from localStorage or session (for Google login)
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Try to get email from localStorage (normal login)
    let email = localStorage.getItem('signedInEmail') || '';
    // If not found, try to get from session (Google login)
    if (!email && window.sessionStorage) {
      email = sessionStorage.getItem('signedInEmail') || '';
    }
    // If still not found, try to parse from cookies (for future extensibility)
    // (Optional: you can add cookie parsing here if needed)
    if (email) {
      fetch(`http://localhost:5000/api/user/${email}`, { credentials: 'include' })
        .then(res => res.json())
        .then(data => {
          if (data && data.name) {
            setProfile({ name: data.name, email: data.email, photo: localStorage.getItem('profilePic') || '' });
          } else {
            setProfile({ name: 'User', email: email, photo: localStorage.getItem('profilePic') || '' });
          }
          setLoading(false);
        })
        .catch(() => {
          setProfile({ name: 'User', email: email, photo: localStorage.getItem('profilePic') || '' });
          setLoading(false);
        });
    } else {
      setProfile({ name: 'User', email: '', photo: localStorage.getItem('profilePic') || '' });
      setLoading(false);
    }
  }, []);

  // Real-time stats state
  const [userStats, setUserStats] = useState({
    workspaces: 0,
    completedTasks: 0,
    collaborations: 0,
    timeLogged: 0
  });

  // Name editing state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');

  // Handle name editing
  const handleNameEdit = () => {
    setTempName(profile?.name || 'User');
    setIsEditingName(true);
  };

  const handleNameSave = async () => {
    if (tempName.trim() && profile?.email) {
      try {
        console.log('Attempting to update name:', tempName.trim(), 'for email:', profile.email);
        
        const response = await fetch(`http://localhost:5000/api/user/${profile.email}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: tempName.trim() }),
          credentials: 'include'
        });
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
          const data = await response.json();
          console.log('Update successful:', data);
          setProfile(p => ({ ...p, name: tempName.trim() }));
          localStorage.setItem('userName', tempName.trim());
          
          // Show success feedback
          alert('Name updated successfully!');
        } else {
          const errorData = await response.json();
          console.error('Server error:', errorData);
          alert('Failed to update name: ' + (errorData.message || 'Unknown error'));
        }
      } catch (error) {
        console.error('Network error updating name:', error);
        alert('Network error: Unable to update name. Please check your connection.');
      }
    } else {
      console.log('Validation failed - tempName:', tempName, 'profile email:', profile?.email);
      alert('Please enter a valid name');
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName('');
    setIsEditingName(false);
  };

  // Profile pic upload
  const handlePhotoChange = e => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setProfile(p => ({ ...p, photo: reader.result }));
        localStorage.setItem('profilePic', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  // Fetch user statistics
  const fetchUserStats = async () => {
    if (!profile?.email) return;
    
    try {
      const res = await fetch(`http://localhost:5000/api/workspaces/${profile.email}`);
      const workspaces = await res.json();
      
      let totalWorkspaces = workspaces.length;
      let completedTasks = 0;
      let collaborations = new Set();
      let totalHours = 0;
      
      workspaces.forEach(workspace => {
        // Add all members except current user to collaborations count
        workspace.members?.forEach(member => {
          if (member.toLowerCase() !== profile.email.toLowerCase()) {
            collaborations.add(member);
          }
        });
        
        // Count completed tasks
        workspace.goals?.forEach(goal => {
          goal.milestones?.forEach(milestone => {
            milestone.tasks?.forEach(task => {
              if (task.status === 'Done') {
                completedTasks++;
                // Simulate time tracking (in real app, this would come from actual time data)
                totalHours += Math.random() * 2; // Random hours between 0-2 per completed task
              }
            });
          });
        });
      });
      
      setUserStats({
        workspaces: totalWorkspaces,
        completedTasks,
        collaborations: collaborations.size,
        timeLogged: Math.round(totalHours)
      });
    } catch (err) {
      console.error('Error fetching user stats:', err);
    }
  };

  // Update stats when profile changes
  useEffect(() => {
    if (profile?.email) {
      fetchUserStats();
      // Set up interval to refresh stats every 30 seconds
      const interval = setInterval(fetchUserStats, 30000);
      return () => clearInterval(interval);
    }
  }, [profile?.email]);
  // Remove member (no longer needed)
  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      fontFamily: "'Inter', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
    }}>
      <aside style={{ 
        width: '280px', 
        background: 'rgba(255, 255, 255, 0.1)', 
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.2)',
        color: '#fff', 
        display: 'flex', 
        flexDirection: 'column', 
        padding: '2rem 1.5rem',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1)'
      }}>
        <h2 style={{ 
          margin: '0 0 2rem 0', 
          fontSize: '24px', 
          fontWeight: '800',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
        }} onClick={() => window.location.href = '/dashboard'}>Workspace</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <a href="/profile" style={{ 
            color: '#fff', 
            textDecoration: 'none',
            padding: '12px 16px',
            borderRadius: '12px',
            background: 'rgba(255, 255, 255, 0.2)',
            backdropFilter: 'blur(10px)',
            fontWeight: '600',
            transition: 'all 0.2s',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>Profile</a>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ 
          background: 'rgba(255, 255, 255, 0.95)', 
          backdropFilter: 'blur(20px)',
          padding: '16px 32px', 
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.2)'
        }}>
          <div style={{ 
            fontWeight: '800', 
            fontSize: '28px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>Profile</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <input type="text" placeholder="Search..." style={{ 
              padding: '12px 16px', 
              borderRadius: '12px', 
              border: '1px solid rgba(255, 255, 255, 0.3)', 
              background: 'rgba(255, 255, 255, 0.8)',
              backdropFilter: 'blur(10px)',
              color: '#374151',
              fontWeight: '500',
              boxShadow: '0 4px 15px rgba(0, 0, 0, 0.1)',
              outline: 'none',
              transition: 'all 0.2s'
            }} />
            <span role="img" aria-label="notifications" style={{ fontSize: '20px', cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>🔔</span>
            <span role="img" aria-label="profile" style={{ fontSize: '20px', cursor: 'pointer', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}>👤</span>
          </div>
        </header>
        <main style={{ 
          flex: 1, 
          padding: '20px', 
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          paddingTop: '40px',
          gap: '20px'
        }}>
          <h2 style={{ 
            marginBottom: '8px',
            fontSize: '32px',
            fontWeight: '800',
            background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.9) 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            textAlign: 'center'
          }}>My Profile</h2>
          {/* Profile Info Card - Made Smaller */}
          <div style={{ 
            background: 'rgba(255, 255, 255, 0.25)', 
            backdropFilter: 'blur(20px)',
            borderRadius: '18px', 
            boxShadow: '0 12px 30px rgba(0, 0, 0, 0.1)', 
            padding: '24px', 
            width: '100%',
            maxWidth: '380px',
            color: '#fff', 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            gap: '16px',
            border: '1px solid rgba(255, 255, 255, 0.3)'
          }}>
              <div style={{ 
                position: 'relative',
                marginBottom: '4px' 
              }}>
                <label htmlFor="profilePicUpload" style={{ cursor: 'pointer', display: 'block' }}>
                  {profile && profile.photo ? (
                    <img src={profile.photo} alt="Profile" style={{ 
                      width: 70, 
                      height: 70, 
                      borderRadius: '50%', 
                      objectFit: 'cover', 
                      border: '3px solid rgba(255, 255, 255, 0.3)',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                      transition: 'all 0.3s ease'
                    }} />
                  ) : (
                    <div style={{ 
                      width: 70, 
                      height: 70, 
                      borderRadius: '50%', 
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      color: '#fff', 
                      fontSize: '28px', 
                      fontWeight: '800',
                      boxShadow: '0 6px 20px rgba(0, 0, 0, 0.2)',
                      border: '3px solid rgba(255, 255, 255, 0.3)',
                      cursor: 'pointer',
                      transition: 'all 0.3s ease',
                      position: 'relative'
                    }}>
                      <span>+</span>
                      <div style={{
                        position: 'absolute',
                        bottom: '-5px',
                        right: '-5px',
                        fontSize: '10px',
                        background: 'rgba(0,0,0,0.5)',
                        borderRadius: '8px',
                        padding: '2px 4px',
                        pointerEvents: 'none'
                      }}>📷</div>
                    </div>
                  )}
                </label>
                <input id="profilePicUpload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
                
                {/* Camera icon for image upload - only show when there's already a profile picture */}
                {profile && profile.photo && (
                  <label htmlFor="profilePicUpload" style={{
                    position: 'absolute',
                    bottom: '4px',
                    right: '4px',
                    width: '24px',
                    height: '24px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
                    border: '2px solid rgba(255, 255, 255, 0.4)',
                    transition: 'all 0.3s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.transform = 'scale(1.1)';
                    e.target.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.transform = 'scale(1)';
                    e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
                  }}
                  >
                    <span style={{ fontSize: '10px', color: '#fff', fontWeight: '700' }}>📷</span>
                  </label>
                )}
              </div>
              
              <div style={{ textAlign: 'center', width: '100%' }}>
                {/* Name Section with Edit Functionality */}
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '3px' }}>
                  {isEditingName ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
                      <input
                        type="text"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.9)',
                          border: '2px solid rgba(102, 126, 234, 0.5)',
                          borderRadius: '8px',
                          padding: '6px 12px',
                          fontSize: '16px',
                          fontWeight: '600',
                          color: '#374151',
                          textAlign: 'center',
                          minWidth: '120px',
                          maxWidth: '200px',
                          outline: 'none'
                        }}
                        autoFocus
                        onKeyPress={(e) => {
                          if (e.key === 'Enter') handleNameSave();
                          if (e.key === 'Escape') handleNameCancel();
                        }}
                      />
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          onClick={handleNameSave}
                          style={{
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleNameCancel}
                          style={{
                            background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                            border: 'none',
                            borderRadius: '6px',
                            padding: '4px 8px',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '600',
                            transition: 'all 0.2s'
                          }}
                          onMouseEnter={(e) => e.target.style.transform = 'scale(1.05)'}
                          onMouseLeave={(e) => e.target.style.transform = 'scale(1)'}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '700',
                        color: '#fff',
                        textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
                      }}>
                        {loading ? 'Loading...' : profile ? profile.name : 'User'}
                      </div>
                      <button
                        onClick={handleNameEdit}
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          border: 'none',
                          borderRadius: '50%',
                          width: '20px',
                          height: '20px',
                          color: '#fff',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: '700',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.3s ease',
                          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.transform = 'scale(1.1)';
                          e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.transform = 'scale(1)';
                          e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.2)';
                        }}
                      >
                        ✎
                      </button>
                    </>
                  )}
                </div>
                <div style={{
                  fontSize: '13px',
                  opacity: 0.8,
                  marginBottom: '16px',
                  color: 'rgba(255, 255, 255, 0.8)'
                }}>
                  {loading ? '' : profile ? profile.email : ''}
                </div>
                
                <div style={{ 
                  background: 'rgba(255, 255, 255, 0.15)', 
                  borderRadius: '10px',
                  padding: '12px',
                  marginBottom: '16px',
                  backdropFilter: 'blur(10px)',
                  border: '1px solid rgba(255, 255, 255, 0.2)'
                }}>
                  <div style={{ fontSize: '10px', opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '1px' }}>Account Status</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    <div style={{ width: '6px', height: '6px', background: '#10b981', borderRadius: '50%' }}></div>
                    <span style={{ fontSize: '12px', fontWeight: '600' }}>Active</span>
                  </div>
                </div>
              </div>
              
              <button
                style={{ 
                  padding: '10px 20px', 
                  background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)', 
                  color: '#fff', 
                  border: 'none', 
                  borderRadius: '12px', 
                  fontWeight: '700', 
                  cursor: 'pointer', 
                  fontSize: '13px',
                  boxShadow: '0 6px 15px rgba(239, 68, 68, 0.3)',
                  transition: 'all 0.3s ease',
                  backdropFilter: 'blur(10px)',
                  width: '100%'
                }}
                onClick={() => {
                  localStorage.clear();
                  window.location.href = '/signup';
                }}
                onMouseEnter={(e) => {
                  e.target.style.transform = 'translateY(-2px)';
                  e.target.style.boxShadow = '0 10px 25px rgba(239, 68, 68, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.target.style.transform = 'translateY(0px)';
                  e.target.style.boxShadow = '0 6px 15px rgba(239, 68, 68, 0.3)';
                }}
              >
                🚪 Logout
              </button>
            </div>

          {/* Real-time Stats Section */}
          <div style={{
            width: '100%',
            maxWidth: '600px',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '16px',
            marginTop: '8px'
          }}>
            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(15px)',
              borderRadius: '18px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>🏢</div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '800', 
                marginBottom: '6px',
                background: 'linear-gradient(135deg, #fff 0%, rgba(255,255,255,0.8) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>{userStats.workspaces}</div>
              <div style={{ 
                fontSize: '13px', 
                opacity: 0.9,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Workspaces</div>
              <div style={{ 
                fontSize: '10px', 
                opacity: 0.6, 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>Updated {new Date().toLocaleTimeString()}</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(15px)',
              borderRadius: '18px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>✅</div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '800', 
                marginBottom: '6px',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>{userStats.completedTasks}</div>
              <div style={{ 
                fontSize: '13px', 
                opacity: 0.9,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Completed Tasks</div>
              <div style={{ 
                fontSize: '10px', 
                opacity: 0.6, 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>Updated {new Date().toLocaleTimeString()}</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(15px)',
              borderRadius: '18px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>👥</div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '800', 
                marginBottom: '6px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>{userStats.collaborations}</div>
              <div style={{ 
                fontSize: '13px', 
                opacity: 0.9,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Collaborations</div>
              <div style={{ 
                fontSize: '10px', 
                opacity: 0.6, 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>Updated {new Date().toLocaleTimeString()}</div>
            </div>

            <div style={{
              background: 'rgba(255, 255, 255, 0.25)',
              backdropFilter: 'blur(15px)',
              borderRadius: '18px',
              padding: '24px',
              textAlign: 'center',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#fff',
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              boxShadow: '0 8px 25px rgba(0, 0, 0, 0.1)'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'translateY(-4px)';
              e.target.style.boxShadow = '0 12px 35px rgba(0, 0, 0, 0.15)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0px)';
              e.target.style.boxShadow = '0 8px 25px rgba(0, 0, 0, 0.1)';
            }}
            >
              <div style={{ fontSize: '28px', marginBottom: '12px', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' }}>⏱️</div>
              <div style={{ 
                fontSize: '24px', 
                fontWeight: '800', 
                marginBottom: '6px',
                background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: '0 2px 4px rgba(0, 0, 0, 0.1)'
              }}>{userStats.timeLogged}h</div>
              <div style={{ 
                fontSize: '13px', 
                opacity: 0.9,
                fontWeight: '600',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>Time Logged</div>
              <div style={{ 
                fontSize: '10px', 
                opacity: 0.6, 
                marginTop: '4px',
                fontStyle: 'italic'
              }}>Updated {new Date().toLocaleTimeString()}</div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ProfilePage;
