import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Users, 
  BarChart3, 
  LogOut, 
  Menu, 
  X,
  ChevronRight,
  TrendingUp,
  Plus,
  Settings as SettingsIcon,
  Search
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { auth } from '../../lib/firebase';
import { Seller } from '../../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  seller: Seller | null;
  logoUrl?: string | null;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onLogout: () => void;
}

export default function DashboardLayout({ 
  children, 
  activeTab, 
  setActiveTab, 
  seller, 
  logoUrl,
  searchQuery,
  setSearchQuery,
  onLogout
}: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'leads', label: 'Prospectos', icon: Users },
    { id: 'inventory', label: 'Inventario', icon: Car },
    { id: 'settings', label: 'Ajustes', icon: SettingsIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? 'w-64' : 'w-20'
        } bg-indigo-700 transition-all duration-300 ease-in-out flex flex-col z-30 shadow-xl`}
      >
        <div className="p-6 flex items-center justify-between border-b border-indigo-600/30">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-slate-900 p-1.5 rounded-lg shrink-0 shadow-lg border border-white/10 overflow-hidden flex items-center justify-center w-9 h-9">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
              ) : (
                <Car className="text-white w-6 h-6" />
              )}
            </div>
            {isSidebarOpen && (
              <div className="flex flex-col leading-tight">
                <span className="font-black text-sm tracking-tighter text-white uppercase italic">Automotriz</span>
                <span className="font-black text-xl tracking-tighter text-indigo-300 uppercase -mt-1">Gomez</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1 hover:bg-indigo-600 rounded-md text-white/70 lg:hidden"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-8 space-y-2">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-indigo-800 text-white shadow-inner' 
                  : 'text-indigo-100 hover:bg-indigo-600 hover:text-white'
              }`}
            >
              <item.icon size={22} className={`shrink-0 ${activeTab === item.id ? 'opacity-100' : 'opacity-70'}`} />
              {isSidebarOpen && <span className="font-medium whitespace-nowrap">{item.label}</span>}
              {activeTab === item.id && isSidebarOpen && (
                <motion.div 
                  layoutId="activeTab"
                  className="ml-auto"
                >
                  <ChevronRight size={16} className="opacity-70" />
                </motion.div>
              )}
            </button>
          ))}
        </nav>

        <div className="p-4 mt-auto">
          <div className="flex items-center gap-3 p-2 mb-4 overflow-hidden border-t border-indigo-600/30 pt-4">
            <div className="w-10 h-10 rounded-full bg-indigo-400/30 border border-white/20 shrink-0 uppercase flex items-center justify-center font-bold text-white">
              {seller?.name?.[0] || 'V'}
            </div>
            {isSidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {seller?.name || 'Vendedor'}
                </p>
                <p className="text-[10px] uppercase font-black text-indigo-200 truncate tracking-widest">{seller?.role === 'admin' ? 'Administrador' : 'Vendedor'}</p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className={`w-full flex items-center justify-center gap-3 py-2 text-sm font-medium text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors overflow-hidden ${
              !isSidebarOpen ? 'px-0' : 'px-4'
            }`}
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span>Cerrar Sesión</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-4 flex-1">
            <h2 className="text-xl font-black text-slate-800">
              {menuItems.find(i => i.id === activeTab)?.label}
            </h2>
            <div className="flex ml-4 md:ml-8 relative flex-1 max-w-lg">
              <input 
                type="text" 
                placeholder="Buscar VIN, cliente o modelo..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-100 rounded-full text-xs sm:text-sm border-none focus:ring-2 focus:ring-indigo-500 transition-all font-medium text-slate-700"
              />
              <Search className="absolute left-3 top-3 text-slate-400" size={16} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-0.5">Sesión Activa</p>
              <p className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                Bienvenido, <span className="text-indigo-600 italic underline decoration-2 underline-offset-4">{seller?.name?.split(' ')[0] || 'Vendedor'}</span>
              </p>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {children}
          </motion.div>
        </div>
      </main>
    </div>
  );
}
