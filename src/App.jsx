import React, { useState, useEffect, useRef } from 'react';
import { 
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  LayoutDashboard, Trees, Hammer, Layers, Flame, UploadCloud, Settings, 
  UserPlus, LogOut, Calendar, RefreshCw, AlertTriangle, CheckCircle, 
  Info, ShieldAlert, FileSpreadsheet, Plus, Trash2, Eye, Bell
} from 'lucide-react';

const COLORS = ['#4F46E5', '#7C3AED', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#06B6D4'];

export default function App() {
  // Global States
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [startDate, setStartDate] = useState('2026-06-07');
  const [endDate, setEndDate] = useState('2026-06-18');
  const [factory, setFactory] = useState('all');
  
  // Dashboard & Module Data States
  const [ceoData, setCeoData] = useState(null);
  const [timberData, setTimberData] = useState(null);
  const [peelingData, setPeelingData] = useState(null);
  const [prepressData, setPrepressData] = useState(null);
  const [hotpressData, setHotpressData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [settings, setSettings] = useState({});
  const [alerts, setAlerts] = useState([]);

  // UI States
  const [loading, setLoading] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeAlertCount, setActiveAlertCount] = useState(0);
  const [message, setMessage] = useState(null); // {type: 'success'|'error', text: ''}
  
  // Login State
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Upload States
  const [uploadFileType, setUploadFileType] = useState('timber');
  const [selectedFile, setSelectedFile] = useState(null);
  const [dupWarning, setDupWarning] = useState(null); // {message: '', date_range: {}}

  // User Management State
  const [newUserUsername, setNewUserUsername] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserRole, setNewUserRole] = useState('department_head');
  const [newUserDept, setNewUserDept] = useState('Peeling');

  // Trigger Notifications Clear/Autoclose
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  // Fetch data wrapper
  const fetchWithAuth = async (url, options = {}) => {
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    try {
      const res = await fetch(url, { ...options, headers });
      if (res.status === 401) {
        handleLogout();
        throw new Error("Session expired. Please log in again.");
      }
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Server error occurred");
      }
      return await res.json();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
      console.error(err);
      return null;
    }
  };

  // Login handler
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData();
    formData.append('username', loginUsername);
    formData.append('password', loginPassword);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        body: formData
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.detail || "Invalid login credentials");
      }
      const data = await res.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setToken(data.access_token);
      setUser(data.user);
      setMessage({ type: 'success', text: "Successfully logged in." });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Logout handler
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
  };

  // Main fetch functions
  const fetchCeoDashboard = async () => {
    setLoading(true);
    const data = await fetchWithAuth(`/api/dashboard/ceo?start_date=${startDate}&end_date=${endDate}`);
    if (data) {
      setCeoData(data);
      setAlerts(data.alerts || []);
      setActiveAlertCount(data.alerts ? data.alerts.length : 0);
    }
    setLoading(false);
  };

  const fetchModuleData = async () => {
    if (activeTab === 'timber') {
      const data = await fetchWithAuth(`/api/modules/timber?start_date=${startDate}&end_date=${endDate}`);
      if (data) setTimberData(data);
    } else if (activeTab === 'peeling') {
      const data = await fetchWithAuth(`/api/modules/peeling?start_date=${startDate}&end_date=${endDate}`);
      if (data) setPeelingData(data);
    } else if (activeTab === 'prepress') {
      const data = await fetchWithAuth(`/api/modules/prepress?start_date=${startDate}&end_date=${endDate}`);
      if (data) setPrepressData(data);
    } else if (activeTab === 'hotpress') {
      const data = await fetchWithAuth(`/api/modules/hotpress?start_date=${startDate}&end_date=${endDate}`);
      if (data) setHotpressData(data);
    } else if (activeTab === 'uploads') {
      const data = await fetchWithAuth('/api/upload/history');
      if (data) setHistoryData(data);
    } else if (activeTab === 'settings') {
      const settingsData = await fetchWithAuth('/api/settings');
      if (settingsData) setSettings(settingsData);
      
      if (user?.role === 'super_admin') {
        const auditData = await fetchWithAuth('/api/audit-logs');
        if (auditData) setAuditLogs(auditData);
        
        const usersData = await fetchWithAuth('/api/users');
        if (usersData) setUsersList(usersData);
      }
    }
  };

  // Fetch trigger on filter change
  useEffect(() => {
    if (token) {
      fetchCeoDashboard();
      fetchModuleData();
    }
  }, [token, startDate, endDate, activeTab]);

  // Handle file uploads
  const handleUploadSubmit = async (e, overwriteValue = false) => {
    if (e) e.preventDefault();
    if (!selectedFile) {
      setMessage({ type: 'error', text: "Please select an Excel file first." });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('file_type', uploadFileType);
    formData.append('overwrite', overwriteValue ? "true" : "false");

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Failed to upload file.");
      }

      if (data.duplicate_warning) {
        setDupWarning(data);
      } else {
        setMessage({ type: 'success', text: data.message });
        setDupWarning(null);
        setSelectedFile(null);
        // Refresh upload logs
        fetchModuleData();
        fetchCeoDashboard();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  // Add new user
  const handleCreateUser = async (e) => {
    e.preventDefault();
    const formData = new FormData();
    formData.append('username', newUserUsername);
    formData.append('password', newUserPassword);
    formData.append('role', newUserRole);
    if (newUserRole === 'department_head') {
      formData.append('department', newUserDept);
    }

    const data = await fetchWithAuth('/api/users', {
      method: 'POST',
      body: formData
    });

    if (data && data.success) {
      setMessage({ type: 'success', text: data.message });
      setNewUserUsername('');
      setNewUserPassword('');
      // Reload users
      const usersData = await fetchWithAuth('/api/users');
      if (usersData) setUsersList(usersData);
    }
  };

  // Delete user
  const handleDeleteUser = async (userId) => {
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    const data = await fetchWithAuth(`/api/users/${userId}`, {
      method: 'DELETE'
    });
    if (data && data.success) {
      setMessage({ type: 'success', text: data.message });
      // Reload users
      const usersData = await fetchWithAuth('/api/users');
      if (usersData) setUsersList(usersData);
    }
  };

  // Update Settings
  const handleUpdateSettings = async (e) => {
    e.preventDefault();
    const data = await fetchWithAuth('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
    if (data && data.success) {
      setMessage({ type: 'success', text: data.message });
      fetchCeoDashboard();
    }
  };

  // Export module CSV
  const triggerCSVExport = () => {
    let mod = activeTab;
    if (mod === 'dashboard') mod = 'peeling'; // default fallback
    const url = `/api/export/csv?module=${mod}&start_date=${startDate}&end_date=${endDate}`;
    
    // Create hidden download link
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `plystory_${mod}_report.csv`);
    // Pass JWT via query param or fetch. Since query param is simpler, we hit it. 
    // Wait, to download with JWT header we should fetch first and convert to blob:
    fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.blob())
    .then(blob => {
      const blobUrl = window.URL.createObjectURL(blob);
      link.href = blobUrl;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    })
    .catch(err => setMessage({ type: 'error', text: "Failed to download export." }));
  };

  // If not logged in, render Login Page
  if (!token || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-bg p-4 relative overflow-hidden">
        {/* Abstract background glows */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-indigo-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 pointer-events-none"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-violet-600 rounded-full mix-blend-screen filter blur-[150px] opacity-20 pointer-events-none"></div>

        <div className="w-full max-w-md glass-panel rounded-2xl p-8 border border-slate-800 shadow-2xl relative z-10">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-500 bg-clip-text text-transparent mb-2">
              PLYSTORY
            </h1>
            <p className="text-slate-400 text-sm">Manufacturing Intelligence System (MIS)</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Username</label>
              <input 
                type="text" 
                required
                className="w-full px-4 py-3 form-input"
                placeholder="Enter username (e.g. admin)"
                value={loginUsername}
                onChange={e => setLoginUsername(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <input 
                type="password" 
                required
                className="w-full px-4 py-3 form-input"
                placeholder="Enter password (e.g. admin123)"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
              />
            </div>
            
            {message && message.type === 'error' && (
              <div className="p-3 bg-red-950/30 border border-red-500/30 text-red-400 text-sm rounded-lg flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{message.text}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium rounded-lg shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98] transition duration-200 flex justify-center items-center gap-2"
            >
              {loading ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                "Access Dashboard"
              )}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-800 text-center text-xs text-slate-500">
            Plystory Northeast Plywood Pvt. Ltd. • v1.0
          </div>
        </div>
      </div>
    );
  }

  // Allowed tabs based on roles
  const canUpload = user.role === 'super_admin';
  const canEditSettings = user.role === 'super_admin';

  return (
    <div className="min-h-screen bg-[#050811] text-slate-100 flex flex-col md:flex-row">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-[#0a0f1d] border-r border-slate-900 flex flex-col shrink-0">
        {/* Brand / Logo */}
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent tracking-widest">
              PLYSTORY
            </h1>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Intelligence MIS</p>
          </div>
          <div className="px-2 py-1 bg-indigo-950/60 border border-indigo-500/30 rounded text-[10px] text-indigo-400 font-bold capitalize">
            {user.role.replace('_', ' ')}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {[
            { id: 'dashboard', label: 'CEO Dashboard', icon: LayoutDashboard },
            { id: 'timber', label: 'Timber Purchases', icon: Trees },
            { id: 'peeling', label: 'Peeling Production', icon: Hammer },
            { id: 'prepress', label: 'Pre-Press Output', icon: Layers },
            { id: 'hotpress', label: 'Hot-Press Ingestion', icon: Flame },
          ].map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition duration-150 ${
                  active 
                    ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' 
                    : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-4 h-4 ${active ? 'text-indigo-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}

          {canUpload && (
            <button
              onClick={() => setActiveTab('uploads')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition duration-150 ${
                activeTab === 'uploads' 
                  ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' 
                  : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
              }`}
            >
              <UploadCloud className="w-4 h-4 text-slate-500" />
              <span>Upload Reports</span>
            </button>
          )}

          <button
            onClick={() => setActiveTab('settings')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition duration-150 ${
              activeTab === 'settings' 
                ? 'bg-indigo-600/10 border border-indigo-500/20 text-indigo-400' 
                : 'text-slate-400 hover:bg-slate-900/60 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span>Settings & Logs</span>
          </button>
        </nav>

        {/* User Info & Logout */}
        <div className="p-4 border-t border-slate-900 bg-[#070b14] flex items-center justify-between">
          <div className="truncate pr-2">
            <p className="text-xs text-slate-500">Logged in as</p>
            <p className="text-sm font-bold text-slate-300 truncate">@{user.username}</p>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/20 rounded-lg transition"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Global Floating Toast Alerts */}
        {message && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl border flex items-center gap-3 shadow-2xl animate-bounce ${
            message.type === 'success' 
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-300' 
              : 'bg-red-950/90 border-red-500/50 text-red-300'
          }`}>
            {message.type === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400" /> : <AlertTriangle className="w-5 h-5 text-red-400" />}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        )}

        {/* Header Filters & Notifications */}
        <header className="p-6 border-b border-slate-900 bg-[#0a0f1d]/50 backdrop-blur-md sticky top-0 z-30 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="flex items-center gap-2 self-start">
            <span className="text-slate-500 capitalize">{activeTab} View</span>
            <span className="text-slate-700">/</span>
            <span className="text-xs text-slate-400 font-bold bg-slate-900 px-2 py-1 rounded">Factory 1 Northeast</span>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
            {/* Date Range Selector */}
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <input 
                type="date" 
                className="bg-transparent border-none text-slate-300 outline-none text-xs"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span className="text-slate-600">to</span>
              <input 
                type="date" 
                className="bg-transparent border-none text-slate-300 outline-none text-xs"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={`p-2 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-900 hover:border-slate-700 transition relative ${
                  activeAlertCount > 0 ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                <Bell className="w-4 h-4" />
                {activeAlertCount > 0 && (
                  <span className="absolute top-0 right-0 w-2 h-2 bg-amber-500 rounded-full animate-ping"></span>
                )}
              </button>
              
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 glass-panel rounded-xl border border-slate-800 shadow-2xl p-4 space-y-3 z-50">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">System Alerts ({activeAlertCount})</span>
                  </div>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {alerts.length === 0 ? (
                      <p className="text-xs text-slate-500 py-4 text-center">No active system warnings.</p>
                    ) : (
                      alerts.map((al, idx) => (
                        <div key={idx} className={`p-2.5 rounded-lg border text-xs flex gap-2 ${
                          al.type === 'danger' 
                            ? 'bg-red-950/20 border-red-500/30 text-red-400' 
                            : al.type === 'warning'
                              ? 'bg-amber-950/20 border-amber-500/30 text-amber-400'
                              : 'bg-blue-950/20 border-blue-500/30 text-blue-400'
                        }`}>
                          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                          <span>{al.message}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Refresh Data */}
            <button 
              onClick={() => { fetchCeoDashboard(); fetchModuleData(); }}
              className="p-2 bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg transition"
              title="Refresh Data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* CSV Export Button */}
            {['dashboard', 'timber', 'peeling', 'prepress', 'hotpress'].includes(activeTab) && (
              <button 
                onClick={triggerCSVExport}
                className="px-3 py-2 bg-indigo-600/10 border border-indigo-500/30 hover:bg-indigo-600/20 text-indigo-400 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </header>

        {/* Dashboard Loading Overlay */}
        {loading && (
          <div className="flex items-center justify-center p-12 bg-slate-950/10">
            <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mr-3" />
            <span className="text-slate-400 text-sm font-semibold">Aggregating factory reports...</span>
          </div>
        )}

        {/* Render Tab Contents */}
        <div className="p-6 space-y-6 flex-1">
          
          {/* TAB 1: CEO DASHBOARD */}
          {activeTab === 'dashboard' && ceoData && (
            <div className="space-y-6">
              {/* KPIs Grid */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {ceoData.kpis.map((kpi, idx) => (
                  <div key={idx} className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 shadow-md">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{kpi.title}</p>
                    <p className="text-2xl font-black mt-2 bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent">
                      {kpi.value}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1.5 truncate">{kpi.description}</p>
                  </div>
                ))}
              </div>

              {/* Main Visuals Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Visual 1: Stage Production Trend (Ceo dashboard Trend Graph) */}
                <div className="glass-panel rounded-xl p-5 border border-slate-800 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Production Stages Daily Yield (SQFT)</h3>
                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ceoData.trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorPeeling" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorPrepress" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#7C3AED" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorHotpress" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f3f4f6' }} />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                        <Area type="monotone" dataKey="peeling" name="Peeling" stroke="#4F46E5" fillOpacity={1} fill="url(#colorPeeling)" strokeWidth={2} />
                        <Area type="monotone" dataKey="prepress" name="Pre-Press" stroke="#7C3AED" fillOpacity={1} fill="url(#colorPrepress)" strokeWidth={2} />
                        <Area type="monotone" dataKey="hotpress" name="Hot-Press" stroke="#10B981" fillOpacity={1} fill="url(#colorHotpress)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Visual 2: Hot Press Rejections by thickness */}
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">HotPress Rejection Analysis</h3>
                  <div className="h-80 w-full flex flex-col justify-between">
                    {ceoData.rejections.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-20">No rejections reported in range.</p>
                    ) : (
                      <>
                        <div className="h-60 w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={ceoData.rejections}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="rejects"
                                nameKey="thickness"
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                              >
                                {ceoData.rejections.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        <div className="text-[10px] text-slate-500 border-t border-slate-900 pt-3 text-center uppercase tracking-wider">
                          Rejects grouped by panel thickness (mm)
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Lower Section Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Machinery Production Output */}
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Peeling Machine Output (SQFT)</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ceoData.performance.peeling_machines}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="machine" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Bar dataKey="sqft" name="Output SQFT" fill="#4F46E5" radius={[4, 4, 0, 0]}>
                          {ceoData.performance.peeling_machines.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Hot Press Contractor Production */}
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Hot Press Contractors Output (SQFT)</h3>
                  <div className="h-64 w-full">
                    {ceoData.performance.hotpress_contractors.length === 0 ? (
                      <p className="text-slate-500 text-xs text-center py-20">No contractor data found.</p>
                    ) : (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={ceoData.performance.hotpress_contractors}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                          <XAxis dataKey="contractor" stroke="#475569" fontSize={10} />
                          <YAxis stroke="#475569" fontSize={10} />
                          <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                          <Bar dataKey="sqft" name="Output SQFT" fill="#10B981" radius={[4, 4, 0, 0]}>
                            {ceoData.performance.hotpress_contractors.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[(index + 2) % COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TIMBER PURCHASE MODULE */}
          {activeTab === 'timber' && timberData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchase Qty</p>
                  <p className="text-2xl font-black mt-2 text-slate-200">{timberData.kpis.total_qty}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Purchase Value</p>
                  <p className="text-2xl font-black mt-2 text-indigo-400">{timberData.kpis.total_val}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Average Unit Cost</p>
                  <p className="text-2xl font-black mt-2 text-emerald-400">{timberData.kpis.avg_cost}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Supplier Count</p>
                  <p className="text-2xl font-black mt-2 text-amber-500">{timberData.kpis.supplier_count}</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Daily Purchase Weight Trend (kg)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={timberData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Area type="monotone" dataKey="qty" name="Net Weight" stroke="#4F46E5" fill="#4F46E5" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Purchase Weight by Supplier (kg)</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={timberData.suppliers}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name.substring(0, 12)}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {timberData.suppliers.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Logs Table */}
              <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Timber Procurement Log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                        <th className="p-4">Received Date</th>
                        <th className="p-4">Bill No</th>
                        <th className="p-4">Supplier</th>
                        <th className="p-4">Species</th>
                        <th className="p-4 text-right">Net Weight (kg)</th>
                        <th className="p-4 text-right">Bill Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {timberData.records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/35 transition">
                          <td className="p-4">{r.date}</td>
                          <td className="p-4 text-slate-300 font-medium">{r.bill_no || "N/A"}</td>
                          <td className="p-4">{r.supplier}</td>
                          <td className="p-4 text-indigo-400 font-semibold">{r.item}</td>
                          <td className="p-4 text-right font-medium">{r.net_weight ? r.net_weight.toLocaleString() : 0}</td>
                          <td className="p-4 text-right text-emerald-400 font-semibold">{r.value ? r.value.toLocaleString() : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PEELING PRODUCTION MODULE */}
          {activeTab === 'peeling' && peelingData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Output (SQFT)</p>
                  <p className="text-2xl font-black mt-2 text-indigo-400">{peelingData.kpis.total_production}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Volume (CBM)</p>
                  <p className="text-2xl font-black mt-2 text-slate-200">{peelingData.kpis.total_cbm}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peeling Machine Hours</p>
                  <p className="text-2xl font-black mt-2 text-amber-500">{peelingData.kpis.working_hours}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peeling Efficiency</p>
                  <p className="text-2xl font-black mt-2 text-emerald-400">{peelingData.kpis.avg_output}</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-panel rounded-xl p-5 border border-slate-800 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Peeling Production Trend</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={peelingData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Area type="monotone" dataKey="sqft" name="Output SQFT" stroke="#10B981" fill="#10B981" fillOpacity={0.15} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Output Thickness Distribution</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={peelingData.thickness}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {peelingData.thickness.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Log Table */}
              <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Peeling Production log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                        <th className="p-4">Peeling Date</th>
                        <th className="p-4">Machine</th>
                        <th className="p-4">Contractor</th>
                        <th className="p-4">Thickness</th>
                        <th className="p-4">Size</th>
                        <th className="p-4 text-right">Pcs</th>
                        <th className="p-4 text-right">Production (SQFT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {peelingData.records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/35 transition">
                          <td className="p-4">{r.date}</td>
                          <td className="p-4 text-slate-300 font-medium">{r.machine}</td>
                          <td className="p-4 text-slate-400">{r.contractor}</td>
                          <td className="p-4 text-indigo-400 font-bold">{r.thickness} mm</td>
                          <td className="p-4">{r.size}</td>
                          <td className="p-4 text-right font-medium">{r.pcs}</td>
                          <td className="p-4 text-right text-emerald-400 font-semibold">{r.sqft ? r.sqft.toLocaleString() : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: PRE-PRESS OUTPUT */}
          {activeTab === 'prepress' && prepressData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prepress Good Boards</p>
                  <p className="text-2xl font-black mt-2 text-indigo-400">{prepressData.kpis.total_production}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Prepress Volume (CBM)</p>
                  <p className="text-2xl font-black mt-2 text-slate-200">{prepressData.kpis.total_cbm}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Panel Pieces</p>
                  <p className="text-2xl font-black mt-2 text-amber-500">{prepressData.kpis.total_pcs}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Est. Glue Consumption</p>
                  <p className="text-2xl font-black mt-2 text-emerald-400">{prepressData.kpis.glue_consumed}</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-panel rounded-xl p-5 border border-slate-800 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Glued Production Yield vs Glue Consumption</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={prepressData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="sqft" name="Output SQFT" stroke="#7C3AED" fill="#7C3AED" fillOpacity={0.1} strokeWidth={2} />
                        <Area type="monotone" dataKey="glue" name="Glue Used (kg)" stroke="#EC4899" fill="#EC4899" fillOpacity={0.1} strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Estimated Glue usage by Glue Type</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={prepressData.glue_types}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          outerRadius={70}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, value }) => `${name}: ${value.toFixed(0)}kg`}
                        >
                          {prepressData.glue_types.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Log Table */}
              <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Prepress production log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                        <th className="p-4">Prepress Date</th>
                        <th className="p-4">Lot Number</th>
                        <th className="p-4">Glue Type</th>
                        <th className="p-4">Thickness</th>
                        <th className="p-4">Process</th>
                        <th className="p-4 text-right">Pcs</th>
                        <th className="p-4 text-right">Production (SQFT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {prepressData.records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/35 transition">
                          <td className="p-4">{r.date}</td>
                          <td className="p-4 text-slate-300 font-medium">{r.lot_number}</td>
                          <td className="p-4 text-indigo-400 font-semibold">{r.glue_type}</td>
                          <td className="p-4 font-bold">{r.thickness} mm</td>
                          <td className="p-4">{r.process}</td>
                          <td className="p-4 text-right font-medium">{r.pcs}</td>
                          <td className="p-4 text-right text-emerald-400 font-semibold">{r.sqft ? r.sqft.toLocaleString() : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: HOT-PRESS OUTPUT */}
          {activeTab === 'hotpress' && hotpressData && (
            <div className="space-y-6">
              {/* KPIs */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pressed Boards (SQFT)</p>
                  <p className="text-2xl font-black mt-2 text-indigo-400">{hotpressData.kpis.total_production}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pressed Volume (CBM)</p>
                  <p className="text-2xl font-black mt-2 text-slate-200">{hotpressData.kpis.total_cbm}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejection Count</p>
                  <p className="text-2xl font-black mt-2 text-red-500">{hotpressData.kpis.reject_pcs}</p>
                </div>
                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rejection Rate %</p>
                  <p className="text-2xl font-black mt-2 text-emerald-400">{hotpressData.kpis.reject_rate}</p>
                </div>
              </div>

              {/* Charts Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="glass-panel rounded-xl p-5 border border-slate-800 lg:col-span-2">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">HotPress Production vs Rejection Trend</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={hotpressData.trend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#101827" />
                        <XAxis dataKey="date" stroke="#475569" fontSize={10} />
                        <YAxis stroke="#475569" fontSize={10} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b' }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="sqft" name="Output (SQFT)" fill="#4F46E5" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="rejects" name="Rejections (pcs)" fill="#EF4444" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="glass-panel rounded-xl p-5 border border-slate-800">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contractor Rejection Rates</h3>
                  <div className="space-y-4 max-h-64 overflow-y-auto">
                    {hotpressData.contractors.map((c, idx) => (
                      <div key={idx} className="p-3 bg-slate-950 border border-slate-900 rounded-lg flex flex-col gap-1.5 text-xs">
                        <div className="flex justify-between font-bold text-slate-300">
                          <span>{c.contractor}</span>
                          <span className={`${c.rate > 5 ? 'text-red-400' : 'text-emerald-400'}`}>{c.rate}% Rejection</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Pressed: {c.total} pcs</span>
                          <span>Rejects: {c.reject} pcs</span>
                        </div>
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${c.rate > 5 ? 'bg-red-500' : 'bg-indigo-500'}`} 
                            style={{ width: `${Math.min(c.rate * 5, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Log Table */}
              <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden">
                <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Hot-Press Production log</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                        <th className="p-4">Hot-Press Date</th>
                        <th className="p-4">Slip No</th>
                        <th className="p-4">Lot Number</th>
                        <th className="p-4">Thickness</th>
                        <th className="p-4">Size Set</th>
                        <th className="p-4 text-right">Pcs Pressed</th>
                        <th className="p-4 text-right">Pcs Rejected</th>
                        <th className="p-4 text-right">Production (SQFT)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {hotpressData.records.map((r, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/35 transition">
                          <td className="p-4">{r.date}</td>
                          <td className="p-4 text-slate-400">{r.slip_no}</td>
                          <td className="p-4 text-slate-300 font-medium">{r.lot_number}</td>
                          <td className="p-4 text-indigo-400 font-bold">{r.thickness} mm</td>
                          <td className="p-4">{r.size}</td>
                          <td className="p-4 text-right font-medium">{r.pcs}</td>
                          <td className={`p-4 text-right font-bold ${r.reject_pcs > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                            {r.reject_pcs}
                          </td>
                          <td className="p-4 text-right text-emerald-400 font-semibold">{r.sqft ? r.sqft.toLocaleString() : 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: DATA UPLOAD SCREEN */}
          {activeTab === 'uploads' && canUpload && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="glass-panel rounded-xl p-8 border border-slate-800 shadow-lg space-y-6">
                <div>
                  <h2 className="text-lg font-black tracking-tight flex items-center gap-2 text-indigo-400">
                    <UploadCloud className="w-5 h-5" />
                    <span>Excel Report Uploader</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">Upload daily Excel reports to automatically update dashboards and KPIs.</p>
                </div>

                <form onSubmit={e => handleUploadSubmit(e, false)} className="space-y-6">
                  {/* Select Report Type */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { id: 'timber', label: 'Timber Purchase', src: 'TIMBERpurchasereport.xls' },
                      { id: 'peeling', label: 'Peeling Production', src: 'PeelingReport.xls' },
                      { id: 'prepress', label: 'Pre-Press Out', src: 'PREPRESSDatewise.xls' },
                      { id: 'hotpress', label: 'Hot-Press Stock', src: 'HotPressMatStockReport.xls' }
                    ].map(type => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => { setUploadFileType(type.id); setDupWarning(null); }}
                        className={`p-4 rounded-xl border text-center flex flex-col justify-between items-center transition ${
                          uploadFileType === type.id 
                            ? 'bg-indigo-600/10 border-indigo-500/60 text-indigo-400 font-semibold shadow-lg shadow-indigo-500/5' 
                            : 'bg-slate-950/40 border-slate-900 text-slate-400 hover:border-slate-800'
                        }`}
                      >
                        <span className="text-xs mb-1.5">{type.label}</span>
                        <span className="text-[10px] text-slate-500 select-all font-mono font-bold bg-slate-900/60 px-1 py-0.5 rounded">
                          {type.src}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* File Pick Area */}
                  <div className="border border-dashed border-slate-800 rounded-xl p-8 text-center bg-slate-950/20 hover:bg-slate-950/30 transition flex flex-col items-center justify-center gap-3">
                    <UploadCloud className="w-10 h-10 text-indigo-400/60" />
                    <div className="text-xs">
                      <span className="font-semibold text-slate-300">Click to upload a file</span>
                    </div>
                    <input 
                      type="file" 
                      accept=".xls,.xlsx"
                      required
                      className="text-xs text-slate-400 cursor-pointer max-w-xs"
                      onChange={e => { setSelectedFile(e.target.files[0]); setDupWarning(null); }}
                    />
                    {selectedFile && (
                      <div className="mt-2 text-xs font-mono text-indigo-400 font-bold bg-indigo-950/30 border border-indigo-500/20 px-3 py-1 rounded">
                        Selected: {selectedFile.name} ({Math.round(selectedFile.size / 1024)} KB)
                      </div>
                    )}
                  </div>

                  {/* Duplicate Detection Prompt */}
                  {dupWarning && (
                    <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-3">
                      <div className="flex gap-2 text-xs font-bold text-amber-400">
                        <AlertTriangle className="w-5 h-5 shrink-0" />
                        <span>Duplicate Records Warning</span>
                      </div>
                      <p className="text-xs text-amber-200">{dupWarning.message}</p>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => handleUploadSubmit(null, true)}
                          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-bold transition"
                        >
                          Yes, Overwrite Data
                        </button>
                        <button
                          type="button"
                          onClick={() => setDupWarning(null)}
                          className="px-4 py-2 bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition"
                        >
                          Cancel Upload
                        </button>
                      </div>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !selectedFile || !!dupWarning}
                    className="w-full py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg font-bold text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Process and Load Data"}
                  </button>
                </form>
              </div>

              {/* Upload History Table */}
              <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Reports Upload History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                        <th className="p-4">Upload Timestamp</th>
                        <th className="p-4">File Name</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Uploaded By</th>
                        <th className="p-4 text-right">Rows Parsed</th>
                        <th className="p-4">Status</th>
                        <th className="p-4">Logs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-900">
                      {historyData.map((h, idx) => (
                        <tr key={idx} className="hover:bg-slate-900/35 transition">
                          <td className="p-4 font-mono text-slate-400">{h.uploaded_at}</td>
                          <td className="p-4 font-medium text-slate-300 truncate max-w-[150px]">{h.filename}</td>
                          <td className="p-4 font-mono uppercase text-[10px] text-indigo-400 font-bold">{h.file_type}</td>
                          <td className="p-4">@{h.uploaded_by}</td>
                          <td className="p-4 text-right font-medium">{h.record_count}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              h.status === 'Success' 
                                ? 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400' 
                                : 'bg-red-950/50 border border-red-500/30 text-red-400'
                            }`}>
                              {h.status}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400 truncate max-w-xs">{h.logs}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 7: ADMIN SETTINGS & AUDIT TRAIL */}
          {activeTab === 'settings' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              
              {/* Lower Level: Configuration Constants (Editable by super admins) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="glass-panel rounded-xl p-6 border border-slate-800 shadow-md lg:col-span-1 h-fit">
                  <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Formula parameters</h3>
                  <form onSubmit={handleUpdateSettings} className="space-y-4">
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Timber Density (kg/CBM)</label>
                      <input 
                        type="number" 
                        required
                        disabled={!canEditSettings}
                        className="w-full px-3 py-2 text-xs form-input"
                        value={settings.timber_density || ''}
                        onChange={e => setSettings({ ...settings, timber_density: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Glue per Prepress SQFT (kg)</label>
                      <input 
                        type="number" 
                        step="0.001"
                        required
                        disabled={!canEditSettings}
                        className="w-full px-3 py-2 text-xs form-input"
                        value={settings.glue_consumption_factor || ''}
                        onChange={e => setSettings({ ...settings, glue_consumption_factor: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Peeling Target Recovery (%)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        required
                        disabled={!canEditSettings}
                        className="w-full px-3 py-2 text-xs form-input"
                        value={settings.peeling_target_recovery || ''}
                        onChange={e => setSettings({ ...settings, peeling_target_recovery: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Low Prod Warning (SQFT/day)</label>
                      <input 
                        type="number" 
                        required
                        disabled={!canEditSettings}
                        className="w-full px-3 py-2 text-xs form-input"
                        value={settings.low_production_threshold || ''}
                        onChange={e => setSettings({ ...settings, low_production_threshold: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 font-semibold uppercase tracking-wider mb-2">High Rejection Warning (%)</label>
                      <input 
                        type="number" 
                        step="0.1"
                        required
                        disabled={!canEditSettings}
                        className="w-full px-3 py-2 text-xs form-input"
                        value={settings.high_rejection_threshold || ''}
                        onChange={e => setSettings({ ...settings, high_rejection_threshold: e.target.value })}
                      />
                    </div>
                    {canEditSettings && (
                      <button 
                        type="submit"
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Update Constants</span>
                      </button>
                    )}
                  </form>
                </div>

                {/* User Accounts Management (Super Admin only) */}
                <div className="glass-panel rounded-xl p-6 border border-slate-800 shadow-md lg:col-span-2 space-y-6">
                  <div>
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-1">User Account Management</h3>
                    <p className="text-[10px] text-slate-500">Configure dashboard user accesses and role limits.</p>
                  </div>
                  
                  {user.role === 'super_admin' ? (
                    <div className="space-y-6">
                      {/* Create User Form */}
                      <form onSubmit={handleCreateUser} className="p-4 bg-slate-950/40 border border-slate-900 rounded-xl space-y-4">
                        <div className="flex gap-2 items-center text-xs font-bold text-indigo-400 mb-1">
                          <UserPlus className="w-4 h-4" />
                          <span>Create New User Account</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                          <input 
                            type="text" 
                            required 
                            placeholder="Username"
                            className="px-3 py-2 text-xs form-input"
                            value={newUserUsername}
                            onChange={e => setNewUserUsername(e.target.value)}
                          />
                          <input 
                            type="password" 
                            required 
                            placeholder="Password"
                            className="px-3 py-2 text-xs form-input"
                            value={newUserPassword}
                            onChange={e => setNewUserPassword(e.target.value)}
                          />
                          <select 
                            className="px-3 py-2 text-xs form-input"
                            value={newUserRole}
                            onChange={e => setNewUserRole(e.target.value)}
                          >
                            <option value="super_admin">Super Admin</option>
                            <option value="management">Management</option>
                            <option value="department_head">Department Head</option>
                          </select>
                          
                          {newUserRole === 'department_head' && (
                            <select 
                              className="px-3 py-2 text-xs form-input"
                              value={newUserDept}
                              onChange={e => setNewUserDept(e.target.value)}
                            >
                              <option value="Timber">Timber Dept</option>
                              <option value="Peeling">Peeling Dept</option>
                              <option value="PrePress">Pre-Press Dept</option>
                              <option value="HotPress">Hot-Press Dept</option>
                            </select>
                          )}
                        </div>
                        <button 
                          type="submit"
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 w-full sm:w-auto"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add User</span>
                        </button>
                      </form>

                      {/* Users List Table */}
                      <div className="border border-slate-900 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900">
                              <th className="p-3">Username</th>
                              <th className="p-3">Role</th>
                              <th className="p-3">Department</th>
                              <th className="p-3">Created</th>
                              <th className="p-3 text-center">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900">
                            {usersList.map((u, idx) => (
                              <tr key={idx} className="hover:bg-slate-900/25 transition">
                                <td className="p-3 font-semibold text-slate-300">@{u.username}</td>
                                <td className="p-3 font-mono text-[10px] text-indigo-400 font-bold uppercase">{u.role}</td>
                                <td className="p-3 text-slate-400">{u.department || 'All'}</td>
                                <td className="p-3 text-slate-500">{u.created_at}</td>
                                <td className="p-3 text-center">
                                  <button
                                    onClick={() => handleDeleteUser(u.id)}
                                    disabled={u.username === user.username}
                                    className="p-1.5 text-red-500 hover:text-red-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                    title="Delete Account"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 bg-slate-950/20 border border-slate-900 rounded-xl text-xs text-slate-400 flex items-center gap-2">
                      <Info className="w-4 h-4 text-slate-500" />
                      <span>Role restricts user credentials modifications. Ask Super Admin to change accounts.</span>
                    </div>
                  )}

                </div>
              </div>

              {/* Audit Trail Logging (Super Admin only) */}
              {user.role === 'super_admin' && (
                <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden shadow-lg">
                  <div className="p-5 border-b border-slate-900 bg-slate-900/20">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Audit Trail Log (Last 100 entries)</h3>
                  </div>
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-900 sticky top-0">
                          <th className="p-4">Timestamp</th>
                          <th className="p-4">Actor</th>
                          <th className="p-4">Action</th>
                          <th className="p-4">Details</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-900">
                        {auditLogs.map((l, idx) => (
                          <tr key={idx} className="hover:bg-slate-900/35 transition">
                            <td className="p-4 font-mono text-slate-500">{l.timestamp}</td>
                            <td className="p-4 font-bold text-indigo-400">@{l.username}</td>
                            <td className="p-4 text-slate-300 font-medium">{l.action}</td>
                            <td className="p-4 text-slate-400 font-mono text-[10px] whitespace-pre-wrap max-w-md">{l.details}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            </div>
          )}

        </div>

        {/* Footer */}
        <footer className="p-6 border-t border-slate-900 text-center text-xs text-slate-500 bg-[#060a12]/20 mt-auto">
          Plystory Manufacturing Intelligence Platform v1.0 • Northeast Plywood Pvt. Ltd.
        </footer>
      </main>
    </div>
  );
}
