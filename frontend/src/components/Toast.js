import React, { useEffect } from 'react';

export default function Toast({ toasts = [], removeToast }) {
  // Auto remove toasts after timeout
  useEffect(() => {
    const timers = toasts.map(t => {
      if (t.timeout === 0) return null;
      return setTimeout(() => removeToast(t.id), t.timeout || 3500);
    }).filter(Boolean);
    return () => timers.forEach(t => clearTimeout(t));
  }, [toasts, removeToast]);

  if (!toasts || toasts.length === 0) return null;

  const getToastStyle = (type) => ({
    success: {
      background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
      color: 'white',
      boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)'
    },
    error: {
      background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
      color: 'white',
      boxShadow: '0 10px 30px rgba(239, 68, 68, 0.3)'
    },
    info: {
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white',
      boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)'
    }
  });

  return (
    <div style={{ 
      position: 'fixed', 
      right: 24, 
      bottom: 24, 
      zIndex: 9999, 
      display: 'flex', 
      flexDirection: 'column', 
      gap: 12 
    }}>
      {toasts.map(t => (
        <div 
          key={t.id} 
          style={{
            minWidth: 280,
            padding: '16px 20px',
            borderRadius: '16px',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            animation: 'slideIn 0.3s ease-out',
            ...getToastStyle(t.type || 'info')
          }}
        >
          <div style={{ 
            fontSize: 14, 
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}>
            {t.type === 'success' && (
              <svg style={{ width: 20, height: 20 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            )}
            {t.type === 'error' && (
              <svg style={{ width: 20, height: 20 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            {(!t.type || t.type === 'info') && (
              <svg style={{ width: 20, height: 20 }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            )}
            {t.message}
          </div>
          <button 
            onClick={() => removeToast(t.id)} 
            style={{ 
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              color: 'white',
              padding: '4px 8px',
              fontSize: '12px',
              fontWeight: 600,
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(255, 255, 255, 0.2)';
            }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
