import React, { useState, useEffect } from 'react';

function SettingsPage() {
  // Get signed up user info from localStorage
  const [profile, setProfile] = useState({
    name: localStorage.getItem('signedUpName') || 'User',
    email: localStorage.getItem('signedInEmail') || 'user@email.com',
    photo: localStorage.getItem('profilePic') || ''
  });
  // Members state
  const [members, setMembers] = useState([
    { name: profile.name, email: profile.email, owner: true },
    // Example: { name: 'Jane Smith', email: 'jane@email.com', owner: false }
  ]);
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
  // Remove member
  const handleRemoveMember = idx => {
    setMembers(m => m.filter((_, i) => i !== idx));
  };
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#FAF9EE' }}>
      <aside style={{ width: '220px', background: '#A6B2A0', color: '#222', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem' }}>
        <h2 style={{ margin: '0 0 2rem 0', fontSize: '1.5rem' }}>Workspace</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        </nav>
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header style={{ background: '#F3F3F2', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Settings</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <input type="text" placeholder="Search..." style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #A6B2A0', background: '#FAF9EE', color: '#222' }} />
            <span role="img" aria-label="notifications" style={{ fontSize: '1.3rem', cursor: 'pointer' }}>🔔</span>
            <span role="img" aria-label="profile" style={{ fontSize: '1.3rem', cursor: 'pointer' }}>👤</span>
          </div>
        </header>
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto', background: '#FAF9EE' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Profile</h2>
          <div style={{ background: '#F3F3F2', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem', minWidth: '220px', maxWidth: '400px', color: '#222', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label htmlFor="profilePicUpload" style={{ cursor: 'pointer' }}>
                {profile.photo ? (
                  <img src={profile.photo} alt="Profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '2px solid #A6B2A0' }} />
                ) : (
                  <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#D9CCBC', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#A6B2A0', fontSize: '2.2rem', fontWeight: 700 }}>+</div>
                )}
              </label>
              <input id="profilePicUpload" type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            </div>
            <p><strong>Name:</strong> {profile.name}</p>
            <p><strong>Email:</strong> {profile.email}</p>
            <button style={{ marginTop: '1rem', padding: '0.5rem 1rem', background: '#A6B2A0', color: '#222', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>Update Profile</button>
          </div>
          <h2 style={{ margin: '2.5rem 0 1.5rem 0' }}>Workspace Members</h2>
          <div style={{ background: '#F3F3F2', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.07)', padding: '1.5rem', minWidth: '220px', maxWidth: '400px', color: '#222' }}>
            <ul style={{ paddingLeft: '1rem', marginBottom: '1rem' }}>
              {members.map((m, idx) => (
                <li key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.7rem', marginBottom: '0.5rem' }}>
                  <span>{m.name} {m.owner ? '(Owner)' : ''}</span>
                  {!m.owner && (
                    <button onClick={() => handleRemoveMember(idx)} style={{ background: '#D9CCBC', color: '#222', border: 'none', borderRadius: '4px', padding: '0.2rem 0.7rem', cursor: 'pointer', fontWeight: 'bold' }}>Remove</button>
                  )}
                </li>
              ))}
            </ul>
            {/* Optionally, add member UI here if needed */}
          </div>
        </main>
      </div>
    </div>
  );
}

export default SettingsPage;
