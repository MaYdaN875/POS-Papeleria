import { useState, useEffect } from 'react';
import { 
  Save, 
  Store, 
  Receipt, 
  Settings as SettingsIcon,
  RefreshCw,
  AlertTriangle,
  Printer,
  Moon,
  Volume2,
  Percent
} from 'lucide-react';
import { getGlobalSettings, saveGlobalSettings, GlobalSettings } from '../services/settingsService';
import '../styles/SettingsPage.css';

export default function SettingsPage() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });
  const [activeTab, setActiveTab] = useState<'general' | 'ticket' | 'system' | 'appearance'>('general');

  useEffect(() => {
    loadSettings();
    
    // Al desmontar, restaurar el tema a lo que esté en el servidor
    // por si el usuario cambió el switch pero no le dio a guardar
    return () => {
      getGlobalSettings().then(res => {
        if (res.ok && res.settings) {
          document.documentElement.setAttribute('data-theme', res.settings.theme || 'light');
        }
      });
    };
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    const res = await getGlobalSettings();
    if (res.ok && res.settings) {
      setSettings(res.settings);
    } else {
      setMessage({ text: res.message || 'Error al cargar ajustes', type: 'error' });
    }
    setLoading(false);
  };

  // Aplicar el tema al instante cuando cambia el toggle
  useEffect(() => {
    if (settings) {
      document.documentElement.setAttribute('data-theme', settings.theme || 'light');
    }
  }, [settings?.theme]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    
    if (!settings) return;

    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setSettings({ ...settings, [name]: checked });
    } else if (type === 'number') {
      setSettings({ ...settings, [name]: parseInt(value) || 0 });
    } else {
      setSettings({ ...settings, [name]: value });
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage({ text: '', type: '' });
    
    const res = await saveGlobalSettings(settings);
    
    if (res.ok) {
      setMessage({ text: 'Ajustes guardados exitosamente en el servidor.', type: 'success' });
      // Limpiar mensaje después de 3 segundos
      setTimeout(() => setMessage({ text: '', type: '' }), 3000);
    } else {
      setMessage({ text: res.message || 'Error al guardar', type: 'error' });
    }
    setSaving(false);
  };

  if (loading || !settings) {
    return (
      <div className="settings-page settings-loading">
        <RefreshCw className="settings-spinner" size={32} />
        <p>Cargando configuraciones...</p>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <div className="settings-header">
        <div className="settings-title-area">
          <h1 className="settings-title">Ajustes del Sistema</h1>
          <p className="settings-subtitle">Configuraciones globales que aplican a todas las cajas</p>
        </div>
        <button 
          className="settings-save-btn" 
          onClick={handleSave} 
          disabled={saving}
        >
          {saving ? <RefreshCw className="settings-spinner" size={20} /> : <Save size={20} />}
          <span>Guardar Cambios</span>
        </button>
      </div>

      {message.text && (
        <div className={`settings-alert settings-alert--${message.type}`}>
          {message.type === 'error' ? <AlertTriangle size={20} /> : <Store size={20} />}
          <span>{message.text}</span>
        </div>
      )}

      <div className="settings-layout">
        {/* Sidebar Nav */}
        <div className="settings-nav">
          <button 
            className={`settings-nav-btn ${activeTab === 'general' ? 'active' : ''}`}
            onClick={() => setActiveTab('general')}
          >
            <Store size={18} />
            Negocio
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'ticket' ? 'active' : ''}`}
            onClick={() => setActiveTab('ticket')}
          >
            <Receipt size={18} />
            Ticket / Recibo
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'appearance' ? 'active' : ''}`}
            onClick={() => setActiveTab('appearance')}
          >
            <Moon size={18} />
            Apariencia y Sonidos
          </button>
          <button 
            className={`settings-nav-btn ${activeTab === 'system' ? 'active' : ''}`}
            onClick={() => setActiveTab('system')}
          >
            <SettingsIcon size={18} />
            Sistema y Caja
          </button>
        </div>

        {/* Content Area */}
        <div className="settings-content">
          
          {/* TAB: GENERAL */}
          {activeTab === 'general' && (
            <div className="settings-section animate-fade-in">
              <h2 className="settings-section-title">Información del Negocio</h2>
              <div className="settings-grid">
                <div className="settings-field">
                  <label>Nombre de la Papelería</label>
                  <input 
                    type="text" 
                    name="storeName" 
                    value={settings.storeName} 
                    onChange={handleChange}
                    placeholder="Ej. Papelería Godart"
                  />
                </div>
                <div className="settings-field">
                  <label>Teléfono Principal</label>
                  <input 
                    type="text" 
                    name="storePhone" 
                    value={settings.storePhone} 
                    onChange={handleChange}
                    placeholder="Ej. 33 1112 4070"
                  />
                </div>
                <div className="settings-field settings-field--full">
                  <label>Dirección Física</label>
                  <input 
                    type="text" 
                    name="storeAddress" 
                    value={settings.storeAddress} 
                    onChange={handleChange}
                    placeholder="Ej. 3909 Av Presa de Osorio"
                  />
                </div>
                <div className="settings-field">
                  <label>Ciudad / Estado</label>
                  <input 
                    type="text" 
                    name="storeCity" 
                    value={settings.storeCity} 
                    onChange={handleChange}
                    placeholder="Ej. Guadalajara, Jalisco"
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB: TICKET */}
          {activeTab === 'ticket' && (
            <div className="settings-section animate-fade-in">
              <h2 className="settings-section-title">Configuración del Ticket Impreso</h2>
              <div className="settings-grid">
                <div className="settings-field settings-field--full">
                  <label>Sitio Web (Texto visible en el ticket)</label>
                  <input 
                    type="text" 
                    name="storeWebsite" 
                    value={settings.storeWebsite} 
                    onChange={handleChange}
                    placeholder="Ej. godart-papelería.com"
                  />
                </div>
                <div className="settings-field settings-field--full">
                  <label>Enlace URL (Para generar el Código QR)</label>
                  <input 
                    type="url" 
                    name="storeWebsiteUrl" 
                    value={settings.storeWebsiteUrl} 
                    onChange={handleChange}
                    placeholder="Ej. https://www.godart-papelería.com"
                  />
                </div>
                <div className="settings-field settings-field--full">
                  <label>Mensaje de Agradecimiento</label>
                  <input 
                    type="text" 
                    name="ticketThanksMessage" 
                    value={settings.ticketThanksMessage} 
                    onChange={handleChange}
                    placeholder="Ej. ¡Gracias por su compra, vuelva pronto!"
                  />
                </div>
                <div className="settings-field">
                  <label>Tamaño de Impresora</label>
                  <select 
                    name="printerSize" 
                    value={settings.printerSize} 
                    onChange={(e) => setSettings({ ...settings, printerSize: e.target.value as '80mm' | '58mm' })}
                    className="settings-select"
                  >
                    <option value="80mm">80mm (Estándar grande)</option>
                    <option value="58mm">58mm (Pequeña)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB: APPEARANCE */}
          {activeTab === 'appearance' && (
            <div className="settings-section animate-fade-in">
              <h2 className="settings-section-title">Apariencia y Sonidos</h2>
              
              <div className="settings-card">
                <div className="settings-card-header">
                  <Moon size={24} className="settings-card-icon" />
                  <div>
                    <h3>Modo Oscuro</h3>
                    <p>Cambia los colores de la aplicación a tonos oscuros, ideal para trabajar de noche.</p>
                  </div>
                  <label className="settings-switch">
                    <input 
                      type="checkbox" 
                      name="theme"
                      checked={settings.theme === 'dark'}
                      onChange={(e) => setSettings({ ...settings, theme: e.target.checked ? 'dark' : 'light' })}
                    />
                    <span className="settings-slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <Volume2 size={24} className="settings-card-icon" />
                  <div>
                    <h3>Sonidos del Sistema</h3>
                    <p>Activa el beep del escáner y el sonido de la caja registradora al cobrar.</p>
                  </div>
                  <label className="settings-switch">
                    <input 
                      type="checkbox" 
                      name="enableSounds"
                      checked={settings.enableSounds}
                      onChange={handleChange}
                    />
                    <span className="settings-slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB: SYSTEM */}
          {activeTab === 'system' && (
            <div className="settings-section animate-fade-in">
              <h2 className="settings-section-title">Preferencias de Caja y Sistema</h2>
              
              <div className="settings-card">
                <div className="settings-card-header">
                  <Printer size={24} className="settings-card-icon" />
                  <div>
                    <h3>Impresión Automática</h3>
                    <p>Abrir la ventana de impresión automáticamente al cobrar una venta.</p>
                  </div>
                  <label className="settings-switch">
                    <input 
                      type="checkbox" 
                      name="autoPrintTicket"
                      checked={settings.autoPrintTicket}
                      onChange={handleChange}
                    />
                    <span className="settings-slider"></span>
                  </label>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <AlertTriangle size={24} className="settings-card-icon" style={{color: '#f59e0b'}} />
                  <div>
                    <h3>Alerta de Stock Bajo</h3>
                    <p>Considerar que un producto tiene "Stock Bajo" cuando queden esta cantidad o menos.</p>
                  </div>
                  <div className="settings-number-input">
                    <input 
                      type="number" 
                      name="lowStockThreshold"
                      value={settings.lowStockThreshold}
                      onChange={handleChange}
                      min="0"
                      max="100"
                    />
                    <span>unidades</span>
                  </div>
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <Percent size={24} className="settings-card-icon" />
                  <div>
                    <h3>Porcentaje de IVA</h3>
                    <p>Define el porcentaje de impuestos global. Ponlo en 0 para no desglosar IVA.</p>
                  </div>
                  <div className="settings-number-input">
                    <input 
                      type="number" 
                      name="taxRate"
                      value={settings.taxRate}
                      onChange={handleChange}
                      min="0"
                      max="100"
                    />
                    <span>%</span>
                  </div>
                </div>
              </div>

              <div className="settings-card settings-card--danger">
                <div className="settings-card-header">
                  <RefreshCw size={24} className="settings-card-icon" />
                  <div>
                    <h3>Limpiar Caché Local</h3>
                    <p>Fuerza al sistema a recargar productos y categorías desde cero. Útil si hiciste cambios manuales en la base de datos.</p>
                  </div>
                  <button 
                    className="settings-action-btn"
                    onClick={() => {
                      localStorage.removeItem('pos_products');
                      localStorage.removeItem('pos_categories');
                      window.location.reload();
                    }}
                  >
                    Sincronizar Ahora
                  </button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
