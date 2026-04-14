import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    // Por ahora solo navegamos al dashboard
    navigate('/dashboard');
  };

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="login-header-logo">
          <div className="login-header-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14,2 14,8 20,8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
          </div>
          <div>
            <span className="login-header-title">Digital Atelier</span>
            <span className="login-header-subtitle">STATIONERY POS</span>
          </div>
        </div>

        <div className="login-server-status">
          <span className="login-server-dot"></span>
          Servidor Conectado
        </div>
      </header>

      {/* Login Card */}
      <div className="login-card-wrapper">
        <form className="login-card" onSubmit={handleLogin}>
          <h1 className="login-title">Bienvenido de nuevo</h1>
          <p className="login-subtitle">
            Accede al panel administrativo de la papelería
          </p>

          <div className="login-field">
            <label className="login-label">USUARIO / EMAIL</label>
            <div className="login-input-wrapper">
              <User size={18} className="login-input-icon" />
              <input
                type="text"
                placeholder="ej. admin@atelier.com"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="login-field">
            <label className="login-label">CONTRASEÑA</label>
            <div className="login-input-wrapper">
              <Lock size={18} className="login-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="login-btn">
            Iniciar Sesión <ArrowRight size={18} />
          </button>

          <a href="#" className="login-forgot">
            Recuperar Contraseña
          </a>
        </form>
      </div>

      {/* Decorative elements */}
      <div className="login-decoration">
        <div className="login-decoration-circle login-decoration-circle--1"></div>
        <div className="login-decoration-circle login-decoration-circle--2"></div>
      </div>
    </div>
  );
}
