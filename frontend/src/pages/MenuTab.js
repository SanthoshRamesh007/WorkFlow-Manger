import React from 'react';

function MenuTab({ icon, label, active }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.4rem',
      fontWeight: active ? 'bold' : 'normal',
      color: active ? '#2563eb' : '#222',
      borderBottom: active ? '2.5px solid #2563eb' : '2.5px solid transparent',
      padding: '0.3rem 0.7rem',
      cursor: 'pointer',
      fontSize: '1.05rem',
      background: 'none',
      borderRadius: '4px',
      transition: 'color 0.2s, border-bottom 0.2s',
      whiteSpace: 'nowrap'
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </div>
  );
}

export default MenuTab;
