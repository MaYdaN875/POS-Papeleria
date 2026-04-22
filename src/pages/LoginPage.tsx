import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react';
import { login, isAuthenticated, checkServerStatus } from '../services/authService';
import '../styles/LoginPage.css';

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);

  // Si ya está logueado, ir al dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/dashboard', { replace: true });
    }
  }, [navigate]);

  // Verificar estado del servidor
  useEffect(() => {
    checkServerStatus().then(setServerOnline);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Ingresa usuario y contraseña');
      return;
    }

    setLoading(true);

    const result = await login(email.trim(), password);

    setLoading(false);

    if (result.ok) {
      navigate('/dashboard');
    } else {
      setError(result.message || 'Credenciales incorrectas');
    }
  };

  return (
    <div className="login-page">
      {/* Header */}
      <header className="login-header">
        <div className="login-header-logo">
          <div className="login-header-logo-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
            </svg>
          </div>
          <div>
            <span className="login-header-title">Papelería Godart</span>
            <span className="login-header-subtitle">PUNTO DE VENTA</span>
          </div>
        </div>

        <div
          className={`login-server-status ${
            serverOnline === false ? 'login-server-status--offline' : ''
          }`}
        >
          <span
            className={`login-server-dot ${
              serverOnline === false ? 'login-server-dot--offline' : ''
            }`}
          ></span>
          {serverOnline === null
            ? 'Verificando...'
            : serverOnline
              ? 'Servidor Conectado'
              : 'Servidor No Disponible'}
        </div>
      </header>

      {/* Login Card */}
      <div className="login-card-wrapper">
        <form className="login-card" onSubmit={handleLogin}>
          <h1 className="login-title">Bienvenido de nuevo</h1>
          <p className="login-subtitle">
            Accede al panel administrativo de la papelería
          </p>

          {error && (
            <div className="login-error">
              {error}
            </div>
          )}

          <div className="login-field">
            <label className="login-label">USUARIO / EMAIL</label>
            <div className="login-input-wrapper">
              <User size={18} className="login-input-icon" />
              <input
                type="text"
                placeholder="ej. admin@godart.com"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
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
                disabled={loading}
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

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <>
                <Loader2 size={18} className="login-spinner" /> Conectando...
              </>
            ) : (
              <>
                Iniciar Sesión <ArrowRight size={18} />
              </>
            )}
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
