import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Input validation
    if (!email || !password) {
      alert('Please enter both email and password');
      return;
    }

    console.log('Attempting login for:', email);

    try {
      // Send login data to backend
      const response = await fetch('http://localhost:5000/api/signin', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: email.trim(), password }),
        credentials: 'include'
      });

      console.log('Login response status:', response.status);

      const data = await response.json();
      console.log('Login response data:', data);

      if (data.success && data.user) {
        // Store user info in localStorage
        localStorage.setItem('signedInEmail', data.user.email);
        localStorage.setItem('userRole', data.user.role);
        
        console.log('Login successful, redirecting...');
        
        // Redirect based on role
        if (data.user.role === 'admin') {
          navigate('/admin');
        } else {
          navigate('/dashboard');
        }
      } else {
        console.error('Login failed:', data.message);
        alert(data.message || 'Login failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Login error:', error);
      alert('Network error. Please check if the server is running on port 5000.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '20px'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ width: '100%', maxWidth: '420px' }}
      >
        <motion.form 
          onSubmit={handleSubmit}
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            borderRadius: '24px',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.1)',
            padding: '40px',
            border: '1px solid rgba(255, 255, 255, 0.2)'
          }}
          whileHover={{ scale: 1.02 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            style={{ textAlign: 'center', marginBottom: '32px' }}
          >
            <h2 style={{
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#1a202c',
              marginBottom: '8px',
              margin: 0
            }}>Welcome Back</h2>
            <p style={{
              color: '#718096',
              fontSize: '16px',
              margin: 0
            }}>Sign in to your account</p>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <label htmlFor="email" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  fontSize: '16px',
                  transition: 'all 0.2s',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.8)',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter your email"
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <label htmlFor="password" style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#4a5568',
                marginBottom: '8px'
              }}>
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  border: '2px solid #e2e8f0',
                  fontSize: '16px',
                  transition: 'all 0.2s',
                  outline: 'none',
                  background: 'rgba(255, 255, 255, 0.8)',
                  boxSizing: 'border-box'
                }}
                placeholder="Enter your password"
                onFocus={(e) => {
                  e.target.style.borderColor = '#667eea';
                  e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#e2e8f0';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </motion.div>

            <motion.button
              type="submit"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                fontWeight: '600',
                padding: '14px 24px',
                borderRadius: '12px',
                border: 'none',
                fontSize: '16px',
                cursor: 'pointer',
                boxShadow: '0 10px 20px rgba(102, 126, 234, 0.3)',
                transition: 'all 0.2s'
              }}
            >
              Sign In
            </motion.button>
          </div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            style={{ marginTop: '32px' }}
          >
            <div style={{ position: 'relative', marginBottom: '24px' }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: 0,
                right: 0,
                height: '1px',
                background: '#e2e8f0'
              }}></div>
              <div style={{
                position: 'relative',
                textAlign: 'center',
                background: 'white',
                padding: '0 16px',
                fontSize: '14px',
                color: '#718096',
                display: 'inline-block',
                left: '50%',
                transform: 'translateX(-50%)'
              }}>
                Or continue with
              </div>
            </div>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                try {
                  console.log('Initiating Google OAuth...');
                  // Test backend connectivity first
                  const testResponse = await fetch('http://localhost:5000/api/current_user', {
                    credentials: 'include'
                  });
                  console.log('Backend test:', testResponse.status);
                  
                  // Redirect to Google OAuth
                  window.location.href = 'http://localhost:5000/auth/google';
                } catch (error) {
                  console.error('Google OAuth Error:', error);
                  alert('Cannot connect to server. Please ensure the backend is running on port 5000.');
                }
              }}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '12px 24px',
                border: '2px solid #e2e8f0',
                borderRadius: '12px',
                background: 'white',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontSize: '16px',
                fontWeight: '500',
                color: '#4a5568'
              }}
            >
              <img 
                src="https://developers.google.com/identity/images/g-logo.png" 
                alt="Google" 
                style={{ width: '20px', height: '20px', marginRight: '12px' }}
              />
              Continue with Google
            </motion.button>

            <div style={{ textAlign: 'center', paddingTop: '16px' }}>
              <span style={{ color: '#718096' }}>Don't have an account? </span>
              <motion.button
                type="button"
                whileHover={{ scale: 1.05 }}
                onClick={() => window.location.href = '/signup'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#667eea',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontSize: '16px'
                }}
              >
                Sign Up
              </motion.button>
            </div>
          </motion.div>
        </motion.form>
      </motion.div>
    </div>
  );
}

export default LoginPage;
