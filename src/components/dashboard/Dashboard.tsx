import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Car, 
  DollarSign, 
  TrendingUp, 
  Clock, 
  CheckCircle2,
  Calendar,
  Search
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { collection, query, onSnapshot, where, Timestamp } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { Seller } from '../../types';

const data = [
  { name: 'Lun', leads: 4, sales: 1 },
  { name: 'Mar', leads: 7, sales: 2 },
  { name: 'Mie', leads: 5, sales: 1 },
  { name: 'Jue', leads: 9, sales: 3 },
  { name: 'Vie', leads: 8, sales: 2 },
  { name: 'Sab', leads: 12, sales: 4 },
  { name: 'Dom', leads: 6, sales: 1 },
];

const StatCard = ({ title, value, icon: Icon, change, trend }: any) => (
  <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-center justify-between mb-4">
      <div className="bg-indigo-50 p-3 rounded-2xl border border-indigo-100">
        <Icon size={24} className="text-indigo-600" />
      </div>
      <div className={`px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 ${
        trend === 'up' ? 'text-emerald-500' : 'text-rose-500'
      }`}>
        <TrendingUp size={12} className={trend === 'down' ? 'rotate-180' : ''} />
        {change}%
      </div>
    </div>
    <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">{title}</p>
    <h3 className={`text-3xl font-black ${title.includes('Ventas') ? 'text-indigo-600' : 'text-slate-800'}`}>{value}</h3>
  </div>
);

export default function Dashboard({ globalSearchQuery, seller }: { globalSearchQuery: string, seller: Seller | null }) {
  const isSearching = globalSearchQuery.trim().length > 0;
  const [stats, setStats] = useState({
    leadsHoy: 0,
    leadsMes: 0,
    ventasMes: 0
  });

  useEffect(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    const q = query(collection(db, 'leads'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allLeads = snapshot.docs.map(doc => ({
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));

      // Filter by seller if not admin
      const filteredLeads = seller?.role === 'admin' 
        ? allLeads 
        : allLeads.filter((l: any) => l.createdBy === seller?.id || (l.sellerName?.toLowerCase() === seller?.name?.toLowerCase()));

      const leadsHoy = filteredLeads.filter((l: any) => l.createdAt >= today).length;
      const leadsMes = filteredLeads.filter((l: any) => l.createdAt >= startOfMonth).length;
      const ventasMes = filteredLeads.filter((l: any) => l.createdAt >= startOfMonth && l.status === 'closed-won').length;

      setStats({
        leadsHoy,
        leadsMes,
        ventasMes
      });
    });

    return () => unsubscribe();
  }, [seller]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {isSearching && (
        <div className="bg-indigo-600 p-6 rounded-3xl text-white flex items-center justify-between shadow-lg shadow-indigo-100 mb-8 animate-pulse">
          <div className="flex items-center gap-4">
            <Search className="text-white shrink-0" size={24} />
            <div>
              <p className="font-black text-sm uppercase tracking-widest">Búsqueda Global Activa</p>
              <p className="text-indigo-100 text-xs font-bold">Cambia a "Prospectos" o "Inventario" para ver los resultados filtrados.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-bounce"></div>
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.2s]"></div>
            <div className="w-2 h-2 rounded-full bg-white animate-bounce [animation-delay:0.4s]"></div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard 
          title="Leads Hoy" 
          value={stats.leadsHoy.toString()} 
          icon={Users} 
          change="12" 
          trend="up" 
        />
        <StatCard 
          title="Leads del Mes" 
          value={stats.leadsMes.toString()} 
          icon={TrendingUp} 
          change="14.2" 
          trend="up" 
        />
        <StatCard 
          title="Ventas Mes" 
          value={stats.ventasMes.toString()} 
          icon={DollarSign} 
          change="15.8" 
          trend="up" 
        />
      </div>

      <div className="grid grid-cols-1 gap-8">
        {/* Weekly Activity */}
        <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Leads Recientes</h2>
              <p className="text-sm text-slate-400">Comparativa de prospectos vs ventas reales</p>
            </div>
            <button className="text-indigo-600 text-sm font-bold hover:underline">Ver todos</button>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} 
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 11, fontWeight: 600, fill: '#94a3b8' }} 
                />
                <Tooltip 
                  cursor={{ fill: '#f8fafc' }}
                  contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="leads" fill="#4f46e5" radius={[6, 6, 0, 0]} barSize={32} name="Prospectos" />
                <Bar dataKey="sales" fill="#10b981" radius={[6, 6, 0, 0]} barSize={32} name="Ventas" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
