import React from 'react';

function ProjectPage() {
  return (
    <div style={{ display: 'flex', height: '100vh', background: '#f5f6fa' }}>
      {/* Sidebar */}
      <aside style={{ width: '220px', background: '#232946', color: '#fff', display: 'flex', flexDirection: 'column', padding: '1.5rem 1rem' }}>
        <h2 style={{ margin: '0 0 2rem 0', fontSize: '1.5rem' }}>Workspace</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        </nav>
      </aside>

      {/* Main Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Navbar */}
        <header style={{ background: '#fff', padding: '1rem 2rem', boxShadow: '0 2px 4px rgba(0,0,0,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 'bold', fontSize: '1.2rem' }}>Project</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <input type="text" placeholder="Search..." style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid #ccc' }} />
            <span role="img" aria-label="notifications" style={{ fontSize: '1.3rem', cursor: 'pointer' }}>🔔</span>
            <span role="img" aria-label="profile" style={{ fontSize: '1.3rem', cursor: 'pointer' }}>👤</span>
          </div>
        </header>

        {/* Kanban Board Placeholder */}
        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          <h2 style={{ marginBottom: '1.5rem' }}>Kanban Board</h2>
          <div style={{ display: 'flex', gap: '2rem' }}>
            <div style={{ background: '#e0e7ff', borderRadius: '8px', padding: '1rem', minWidth: '220px', flex: 1 }}>
              <h3>To Do</h3>
              {/* Tasks will go here */}
            </div>
            <div style={{ background: '#ffe7c2', borderRadius: '8px', padding: '1rem', minWidth: '220px', flex: 1 }}>
              <h3>In Progress</h3>
              {/* Tasks will go here */}
            </div>
            <div style={{ background: '#c2ffd6', borderRadius: '8px', padding: '1rem', minWidth: '220px', flex: 1 }}>
              <h3>Done</h3>
              {/* Tasks will go here */}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default ProjectPage;
