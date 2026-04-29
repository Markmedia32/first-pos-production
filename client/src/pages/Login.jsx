import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

const Login = () => {
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [status, setStatus] = useState({ loading: false, error: '' });
  const navigate = useNavigate();

  const handleInput = (e) => {
    setCredentials({ ...credentials, [e.target.name]: e.target.value });
  };

  const submitAccess = async (e) => {
  e.preventDefault();

  console.log("🔥 LOGIN ATTEMPT STARTED");
  console.log("🌐 API BASE URL:", API_BASE_URL);
  console.log("📡 Full URL:", `${API_BASE_URL}/api/login`);
  console.log("📦 Credentials:", credentials);

  setStatus({ loading: true, error: '' });

  try {
    const response = await axios.post(
      `${API_BASE_URL}/api/login`,
      credentials
    );

    console.log("✅ RESPONSE STATUS:", response.status);
    console.log("✅ RESPONSE DATA:", response.data);

    const { data } = response;

    if (data.success) {
      console.log("🎉 LOGIN SUCCESS");
      localStorage.setItem('user', JSON.stringify(data.user));
      navigate('/pos');
    } else {
      console.log("⚠️ LOGIN FAILED - NO SUCCESS FLAG");
      setStatus({ loading: false, error: 'Access Denied: Check Credentials' });
    }

  } catch (err) {
    console.log("❌ LOGIN ERROR:");
    console.log("Message:", err.message);
    console.log("Response:", err.response?.data);
    console.log("Status:", err.response?.status);

    setStatus({ loading: false, error: 'Access Denied: Check Credentials' });
  }
};

  return (
    <div className="login-viewport">
      <div className="login-card-container">
        <div className="login-branding">
          <h1>First<br/>Class</h1>
          <div className="accent-line"></div>
          <p>World Logistics & POS</p>
        </div>

        <form className="login-form" onSubmit={submitAccess}>
          {status.error && <div className="login-error-toast">{status.error}</div>}
          
          <div className="input-field-group">
            <input 
              name="username"
              type="text" 
              placeholder="Username" 
              onChange={handleInput}
              required 
            />
            <div className="input-focus-indicator"></div>
          </div>

          <div className="input-field-group">
            <input 
              name="password" 
              type="password" 
              placeholder="Password" 
              onChange={handleInput}
              required 
            />
            <div className="input-focus-indicator"></div>
          </div>

          <button type="submit" className="login-cta" disabled={status.loading}>
            {status.loading ? 'SIGNING IN...' : 'LAUNCH DASHBOARD'}
          </button>
        </form>
      </div>
      <div className="ambient-background"></div>
    </div>
  );
};

export default Login;