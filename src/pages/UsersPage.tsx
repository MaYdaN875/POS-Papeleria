import React, { useState, useEffect } from 'react';
import { UserPlus, UserCog, Trash2, Shield, User, Mail, Lock, RefreshCw } from 'lucide-react';
import { getUsers, createUser, updateUser, deleteUser, AdminUser } from '../services/userService';
import '../styles/UsersPage.css';

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Formulario
  const [currentId, setCurrentId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('cashier');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    const res = await getUsers();
    if (res.ok && res.users) {
      setUsers(res.users);
      setError(null);
    } else {
      setError(res.message || 'Error al cargar usuarios');
    }
    setLoading(false);
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setCurrentId(null);
    setName('');
    setIdentifier('');
    setPassword('');
    setRole('cashier');
    setShowModal(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    setIsEditing(true);
    setCurrentId(user.id);
    setName(user.name);
    setIdentifier(user.identifier);
    setPassword(''); // No mostrar pass actual
    setRole(user.role || 'cashier');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let res;
    
    if (isEditing && currentId) {
      res = await updateUser({ id: currentId, name, identifier, password, role });
    } else {
      res = await createUser({ name, identifier, password, role });
    }

    if (res.ok) {
      setShowModal(false);
      loadUsers();
    } else {
      alert(res.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Estás seguro de eliminar este usuario?')) return;
    const res = await deleteUser(id);
    if (res.ok) {
      loadUsers();
    } else {
      alert(res.message);
    }
  };

  const getAvatarColor = (name: string) => {
    const colors = ['#4f46e5', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#059669'];
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  return (
    <div className="users-page">
      <header className="users-header">
        <div className="title-section">
          <h1>Gestión de Usuarios</h1>
          <p>Administra quién tiene acceso al Punto de Venta</p>
        </div>
        <button className="add-user-btn" onClick={handleOpenAdd}>
          <UserPlus size={20} />
          Nuevo Usuario
        </button>
      </header>

      {loading && (
        <div className="users-loading">
          <RefreshCw className="spin" size={40} />
          <p>Cargando usuarios...</p>
        </div>
      )}

      {error && <div className="users-error">{error}</div>}

      {!loading && !error && (
        <div className="users-grid">
          {users.map((user) => {
            const userName = user.name || user.identifier || 'Usuario';
            return (
              <div key={user.id} className="user-card">
                <div className="user-avatar" style={{ backgroundColor: getAvatarColor(userName) }}>
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="user-info">
                  <h3>{userName}</h3>
                  <p><Mail size={14} /> {user.identifier}</p>
                <span className={`role-badge ${user.role}`}>
                  {user.role === 'admin' ? <Shield size={12} /> : <User size={12} />}
                  {user.role === 'admin' ? 'Administrador' : 'Cajero'}
                </span>
              </div>
              <div className="user-actions">
                <button onClick={() => handleOpenEdit(user)} title="Editar"><UserCog size={18} /></button>
                <button onClick={() => handleDelete(user.id)} title="Eliminar" className="delete-btn"><Trash2 size={18} /></button>
              </div>
            </div>
          )})}
        </div>
      )}

      {showModal && (
        <div className="modal-overlay">
          <div className="user-modal">
            <h2>{isEditing ? 'Editar Usuario' : 'Nuevo Usuario'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre Completo</label>
                <div className="input-with-icon">
                  <User size={18} />
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} required placeholder="Ej. Juan Pérez" />
                </div>
              </div>
              <div className="form-group">
                <label>Usuario / Email</label>
                <div className="input-with-icon">
                  <Mail size={18} />
                  <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)} required placeholder="ejemplo@godart.com" />
                </div>
              </div>
              <div className="form-group">
                <label>Contraseña {isEditing && '(Dejar vacío para no cambiar)'}</label>
                <div className="input-with-icon">
                  <Lock size={18} />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required={!isEditing} placeholder="••••••••" />
                </div>
              </div>
              <div className="form-group">
                <label>Rol de Sistema</label>
                <select value={role} onChange={(e) => setRole(e.target.value)}>
                  <option value="cashier">Cajero (Solo ventas y caja)</option>
                  <option value="admin">Administrador (Acceso total)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="cancel-btn" onClick={() => setShowModal(false)}>Cancelar</button>
                <button type="submit" className="save-btn">Guardar Usuario</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsersPage;
