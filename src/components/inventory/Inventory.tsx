import React, { useState, useEffect } from 'react';
import { 
  Car, 
  Search, 
  Filter, 
  ChevronRight,
  TrendingUp,
  MapPin,
  Calendar as CalendarIcon,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
  ShieldCheck,
  Info
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy,
  updateDoc,
  doc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Vehicle, Seller, Lead } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryProps {
  globalSearchQuery: string;
  seller: Seller | null;
}

const STATUS_CONFIG = {
  'available': { label: 'Disponible', color: 'bg-emerald-500', bg: 'bg-emerald-50' },
  'reserved': { label: 'Apartado', color: 'bg-amber-500', bg: 'bg-amber-50' },
  'sold': { label: 'Vendido', color: 'bg-slate-400', bg: 'bg-slate-50' }
};

export default function Inventory({ globalSearchQuery, seller }: InventoryProps) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'stock' | 'reserved' | 'sold'>('stock');
  const [showLeadSelection, setShowLeadSelection] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          const vehiclesData = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              ...data,
              id: doc.id 
            };
          }) as Vehicle[];
          setVehicles(vehiclesData);
          setLoading(false);
        },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'vehicles');
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const leadsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Lead[];
      setLeads(leadsData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'leads');
    });
    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (newStatus: 'available' | 'reserved' | 'sold') => {
    if (!selectedVehicle?.id) return;
    
    try {
      await updateDoc(doc(db, 'vehicles', selectedVehicle.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        // Clear lead info if becoming available again
        ...(newStatus === 'available' ? { reservedByLeadId: null, reservedByLeadName: null } : {})
      });
      setSelectedVehicle(prev => prev ? { ...prev, status: newStatus } : null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${selectedVehicle.id}`);
    }
  };

  const handleReserveForLead = async (lead: Lead) => {
    if (!selectedVehicle?.id) return;

    try {
      await updateDoc(doc(db, 'vehicles', selectedVehicle.id), {
        status: 'reserved',
        reservedByLeadId: lead.id,
        reservedByLeadName: lead.customerName,
        updatedAt: serverTimestamp()
      });

      // Also update lead's history
      const newHistory = [...(lead.history || [])];
      newHistory.unshift({
        date: new Date(),
        action: `Unidad Apartada: ${selectedVehicle.make} ${selectedVehicle.model} (${selectedVehicle.year})`,
        user: seller?.name || 'Sistema'
      });

      await updateDoc(doc(db, 'leads', lead.id), {
        status: 'negotiation',
        interestedVehicleId: selectedVehicle.id,
        interestedVehicleModel: `${selectedVehicle.make} ${selectedVehicle.model}`,
        interestedVehicleYear: selectedVehicle.year,
        history: newHistory,
        updatedAt: serverTimestamp()
      });

      setSelectedVehicle(prev => prev ? { 
        ...prev, 
        status: 'reserved',
        reservedByLeadId: lead.id,
        reservedByLeadName: lead.customerName
      } : null);
      setShowLeadSelection(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `vehicles/${selectedVehicle.id}`);
    }
  };
  const filteredVehicles = vehicles.filter(v => {
    const query = globalSearchQuery.toLowerCase();
    const searchMatch = (
      v.model?.toLowerCase().includes(query) ||
      v.make?.toLowerCase().includes(query) ||
      v.vin?.toLowerCase().includes(query)
    );
    
    if (activeSubTab === 'stock') {
      return searchMatch && v.status === 'available';
    } else if (activeSubTab === 'reserved') {
      return searchMatch && v.status === 'reserved';
    } else {
      return searchMatch && v.status === 'sold';
    }
  });

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit">
        <button 
          onClick={() => setActiveSubTab('stock')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'stock' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Stock Actual
        </button>
        <button 
          onClick={() => setActiveSubTab('reserved')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'reserved' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Autos Reservados
        </button>
        <button 
          onClick={() => setActiveSubTab('sold')}
          className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSubTab === 'sold' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
        >
          Autos Vendidos
        </button>
      </div>

      {/* Inventory Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400">
          <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
          <p className="font-bold uppercase tracking-widest text-xs">Cargando Inventario...</p>
        </div>
      ) : filteredVehicles.length === 0 ? (
        <div className="p-20 text-center bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Search className="text-slate-300" size={32} />
          </div>
          <h3 className="text-lg font-bold text-slate-800">No se encontraron resultados</h3>
          <p className="text-slate-400 text-sm">Prueba con otro modelo o número de serie (VIN).</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredVehicles.map((vehicle) => (
              <motion.div
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={vehicle.id}
                className="bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group"
              >
                <div className="h-56 bg-slate-100 relative overflow-hidden">
                  <img 
                    src={vehicle.imageUrl || `https://picsum.photos/seed/${vehicle.id}/800/600`} 
                    alt={vehicle.model} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className={`absolute top-6 right-6 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest text-white shadow-lg ${STATUS_CONFIG[vehicle.status].color}`}>
                    {STATUS_CONFIG[vehicle.status].label}
                  </div>
                  {vehicle.inShowroom && (
                    <div className="absolute bottom-6 left-6 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-[9px] font-bold text-white flex items-center gap-2 border border-white/10 uppercase tracking-wider">
                      <Zap size={12} className="text-amber-400" />
                      En Piso de Venta
                    </div>
                  )}
                </div>
                
                <div className="p-8">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.2em] mb-1">{vehicle.make}</p>
                      <h3 className="text-xl font-black text-slate-800 tracking-tight leading-tight uppercase">{vehicle.model}</h3>
                    </div>
                    <p className="text-2xl font-black text-slate-900 leading-none">
                      <span className="text-xs align-top mt-1 mr-0.5 inline-block text-slate-400">$</span>
                      {vehicle.price.toLocaleString()}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                      <CalendarIcon size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{vehicle.year}</span>
                    </div>
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100/50">
                      <TrendingUp size={14} className="text-slate-400" />
                      <span className="text-xs font-bold text-slate-600">{vehicle.mileage.toLocaleString()} km</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motor</span>
                      <span className="text-xs font-black text-slate-700 uppercase italic tracking-tighter">{vehicle.engine || 'N/A'}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-50">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">VIN</span>
                      <span className="text-[10px] font-mono text-slate-400 font-bold tracking-widest">{vehicle.vin}</span>
                    </div>
                  </div>

                  <button 
                    onClick={() => setSelectedVehicle(vehicle)}
                    className="w-full mt-8 py-4 bg-slate-900 hover:bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all active:scale-95 shadow-xl shadow-slate-200"
                  >
                    Ver Detalles Completos
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
      {/* Vehicle Details Modal */}
      <AnimatePresence>
        {selectedVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-[3rem] shadow-2xl overflow-hidden flex flex-col md:flex-row"
            >
              <button 
                onClick={() => setSelectedVehicle(null)}
                className="absolute top-6 right-6 z-10 bg-white/20 hover:bg-white/40 backdrop-blur-md p-2 rounded-full text-white transition-colors border border-white/20"
              >
                <X size={24} />
              </button>

              {/* Image Side */}
              <div className="w-full md:w-1/2 h-[300px] md:h-auto bg-slate-200 relative">
                <img 
                  src={selectedVehicle.imageUrl || `https://picsum.photos/seed/${selectedVehicle.id}/1200/800`} 
                  alt={selectedVehicle.model} 
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <div className={`absolute top-10 left-10 px-6 py-2 rounded-full text-xs font-black uppercase tracking-widest text-white shadow-xl ${STATUS_CONFIG[selectedVehicle.status].color}`}>
                  {STATUS_CONFIG[selectedVehicle.status].label}
                </div>
              </div>

              {/* Content Side */}
              <div className="w-full md:w-1/2 p-10 md:p-14 overflow-y-auto">
                <div className="mb-8">
                  <p className="text-xs font-black text-indigo-500 uppercase tracking-[0.3em] mb-2">{selectedVehicle.make}</p>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase leading-tight">{selectedVehicle.model}</h2>
                  <p className="text-3xl font-black text-emerald-600 mt-2">
                    <span className="text-sm align-top mt-2 mr-1 inline-block">$</span>
                    {selectedVehicle.price.toLocaleString()}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                      <CalendarIcon size={18} className="text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Año</p>
                      <p className="text-sm font-black text-slate-800">{selectedVehicle.year}</p>
                    </div>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-3xl border border-slate-100 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-white shadow-sm flex items-center justify-center">
                      <TrendingUp size={18} className="text-indigo-500" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Kilometraje</p>
                      <p className="text-sm font-black text-slate-800">{selectedVehicle.mileage.toLocaleString()} km</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Estado de Inventario</label>
                    <div className="flex gap-2 p-1.5 bg-slate-100 rounded-2xl">
                      <button 
                        onClick={() => handleStatusChange('available')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          selectedVehicle.status === 'available' 
                            ? 'bg-white text-emerald-600 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Disponible
                      </button>
                      <button 
                        onClick={() => handleStatusChange('reserved')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          selectedVehicle.status === 'reserved' 
                            ? 'bg-white text-amber-600 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Apartado
                      </button>
                      <button 
                        onClick={() => handleStatusChange('sold')}
                        className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                          selectedVehicle.status === 'sold' 
                            ? 'bg-white text-slate-900 shadow-sm' 
                            : 'text-slate-400 hover:text-slate-600'
                        }`}
                      >
                        Vendido
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <Zap size={16} className="text-amber-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Motor / Potencia</span>
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase italic">{selectedVehicle.engine || 'Desconocido'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <MapPin size={16} className="text-rose-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Origen</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase">{selectedVehicle.origin || 'Agencia'}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                      <div className="flex items-center gap-3">
                        <Car size={16} className="text-blue-500" />
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transmisión</span>
                      </div>
                      <span className="text-[10px] font-black text-slate-700 uppercase">{selectedVehicle.transmission || 'Automático'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <ShieldCheck size={16} className="text-indigo-500" />
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Número de Serie (VIN)</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-500 font-bold tracking-widest uppercase">{selectedVehicle.vin}</span>
                  </div>
                  {selectedVehicle.status === 'reserved' && selectedVehicle.reservedByLeadName && (
                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <div className="flex items-center gap-3">
                        <Info size={16} className="text-amber-500" />
                        <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Apartado por:</span>
                      </div>
                      <span className="text-xs font-black text-amber-700 uppercase tracking-tight">{selectedVehicle.reservedByLeadName}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-3 p-4 bg-indigo-50 rounded-2xl text-indigo-700">
                    <Info size={16} />
                    <p className="text-xs font-bold font-sans tracking-tight">
                      Este vehículo ha sido inspeccionado y cuenta con toda su documentación en regla.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setShowLeadSelection(true)}
                    disabled={selectedVehicle.status !== 'available'}
                    className={`flex-1 py-5 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl transition-all active:scale-95 ${
                      selectedVehicle.status === 'available' 
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-100' 
                        : 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none'
                    }`}
                  >
                    Apartar Unidad
                  </button>
                  <button 
                    onClick={() => setSelectedVehicle(null)}
                    className="px-8 py-5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-3xl text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Lead Selection Modal */}
      <AnimatePresence>
        {showLeadSelection && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-8 border-b border-slate-50 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Apartar Unidad</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Selecciona al cliente prospecto</p>
                </div>
                <button 
                  onClick={() => setShowLeadSelection(false)}
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 space-y-6">
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input 
                    type="text"
                    placeholder="BUSCAR PROSPECTO POR NOMBRE O TELÉFONO..."
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    className="w-full bg-slate-50 border-none rounded-2xl py-4 pl-12 pr-6 text-xs font-bold uppercase tracking-widest text-slate-700 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
                  />
                </div>

                <div className="max-h-[40vh] overflow-y-auto space-y-3 pr-2 scrollbar-hide">
                  {leads
                    .filter(l => 
                      l.customerName.toLowerCase().includes(leadSearchQuery.toLowerCase()) || 
                      l.phone.includes(leadSearchQuery)
                    )
                    .map(lead => (
                      <button 
                        key={lead.id}
                        onClick={() => handleReserveForLead(lead)}
                        className="w-full bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-100 p-4 rounded-2xl flex items-center justify-between group transition-all"
                      >
                        <div className="text-left">
                          <p className="text-sm font-black text-slate-800 uppercase tracking-tight group-hover:text-indigo-600 transition-colors">{lead.customerName}</p>
                          <p className="text-[10px] font-bold text-slate-400 mt-1">{lead.phone}</p>
                        </div>
                        <ChevronRight className="text-slate-300 group-hover:text-indigo-400 transition-all" size={18} />
                      </button>
                    ))
                  }
                  {leads.filter(l => 
                    l.customerName.toLowerCase().includes(leadSearchQuery.toLowerCase()) || 
                    l.phone.includes(leadSearchQuery)
                  ).length === 0 && (
                    <div className="text-center py-8">
                      <p className="text-xs font-bold text-slate-400 italic">No se encontraron prospectos con esos datos.</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="p-8 bg-slate-50 mt-auto">
                <button 
                  onClick={() => setShowLeadSelection(false)}
                  className="w-full py-4 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancelar Operación
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
