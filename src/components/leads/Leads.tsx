import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  MoreHorizontal, 
  Phone, 
  Mail, 
  MapPin, 
  Car, 
  Calendar as CalendarIcon,
  DollarSign,
  Save,
  X,
  Trash2,
  AlertTriangle,
  ShieldCheck,
  History
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  updateDoc, 
  doc, 
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Lead, LeadStatus, Seller } from '../../types';
import { motion, AnimatePresence } from 'motion/react';

const STATUS_LABELS: Record<LeadStatus, string> = {
  'new': 'Nuevo',
  'contacted': 'Contactado',
  'qualified': 'Calificado',
  'test-drive': 'Prueba de Manejo',
  'negotiation': 'Negociación',
  'closed-won': 'Ganado',
  'closed-lost': 'Perdido'
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  'new': 'bg-blue-100 text-blue-700',
  'contacted': 'bg-indigo-100 text-indigo-700',
  'qualified': 'bg-purple-100 text-purple-700',
  'test-drive': 'bg-amber-100 text-amber-700',
  'negotiation': 'bg-orange-100 text-orange-700',
  'closed-won': 'bg-emerald-100 text-emerald-700',
  'closed-lost': 'bg-rose-100 text-rose-700'
};

const LEAD_SOURCES = [
  'Consignacion',
  'Piso',
  'Llamada',
  'Facebook',
  'Pagina ANCA',
  'Campaña META',
  'Recomendado',
  'WHATSAPP'
];

interface LeadsProps {
  globalSearchQuery: string;
  seller: Seller | null;
}

export default function Leads({ globalSearchQuery, seller }: LeadsProps) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const [formData, setFormData] = useState({
    customerName: '',
    gender: '' as 'Hombre' | 'Mujer' | '',
    phone: '',
    age: '',
    city: '',
    interestedVehicleModel: '',
    interestedVehicleYear: new Date().getFullYear(),
    purchaseMethod: '' as 'CONTADO' | 'CRÉDITO' | '',
    budget: '',
    downPayment: '',
    email: '',
    notes: '',
    source: '',
    status: 'new' as LeadStatus
  });

  const duplicates = useMemo(() => {
    if (!formData.customerName && !formData.phone && !formData.email) return [];
    
    return leads.filter(l => {
      // Don't flag the same lead being edited as a duplicate
      if (selectedLead && l.id === selectedLead.id) return false;
      
      const sameName = formData.customerName && l.customerName.toLowerCase() === formData.customerName.toLowerCase();
      const samePhone = formData.phone && l.phone === formData.phone;
      const sameEmail = formData.email && l.email && formData.email && l.email.toLowerCase() === formData.email.toLowerCase();
      
      return sameName || samePhone || sameEmail;
    });
  }, [formData.customerName, formData.phone, formData.email, leads, selectedLead]);

  useEffect(() => {
    // Fetch Leads
    const q = query(collection(db, 'leads'), orderBy('createdAt', 'desc'));
    const unsubscribeLeads = onSnapshot(q, 
      (snapshot) => {
        const leadsData = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            ...data,
            id: doc.id
          };
        }) as Lead[];
        setLeads(leadsData);
        setLoading(false);
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'leads');
        setLoading(false);
      }
    );

    // Fetch Sellers for filtering
    const sellersQ = query(collection(db, 'sellers'), orderBy('name', 'asc'));
    const unsubscribeSellers = onSnapshot(sellersQ, 
      (snapshot) => {
        const fullList = snapshot.docs.map(doc => {
          const data = doc.data();
          return { ...data, id: doc.id };
        }) as Seller[];

        // Deduplicar para que el filtro por equipo no muestre nombres repetidos
        const uniqueMap = new Map<string, Seller>();
        fullList.forEach(s => {
          const key = s.email?.toLowerCase() || s.name.toLowerCase();
          if (!uniqueMap.has(key) || s.uid) {
            uniqueMap.set(key, s);
          }
        });
        
        setSellers(Array.from(uniqueMap.values()));
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'sellers');
      }
    );

    return () => {
      unsubscribeLeads();
      unsubscribeSellers();
    };
  }, []);

  // Set default filter based on role
  useEffect(() => {
    if (seller && seller.role !== 'admin') {
      setSellerFilter(seller.id);
    }
  }, [seller]);

  const handleDeleteLead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    if (!isDeleting) {
      setIsDeleting(id);
      return;
    }

    try {
      await deleteDoc(doc(db, 'leads', id));
      setToast({ message: 'prospecto eliminado correctamente', type: 'success' });
      setIsDeleting(null);
    } catch (error: any) {
      handleFirestoreError(error, OperationType.DELETE, `leads/${id}`);
      setToast({ message: `Error al eliminar el prospecto`, type: 'error' });
      setIsDeleting(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (selectedLead?.id) {
        // Track changes for history
        const newHistory = [...(selectedLead.history || [])];
        const changes: string[] = [];

        if (formData.customerName !== selectedLead.customerName) changes.push(`Nombre: ${selectedLead.customerName} -> ${formData.customerName}`);
        if (formData.email !== selectedLead.email) changes.push(`cambio de correo de ${selectedLead.email || 'N/A'} a ${formData.email || 'N/A'}`);
        if (formData.phone !== selectedLead.phone) changes.push(`Teléfono: ${selectedLead.phone} -> ${formData.phone}`);
        if (Number(formData.budget) !== selectedLead.budget) changes.push(`Presupuesto: $${selectedLead.budget?.toLocaleString() || 0} -> $${Number(formData.budget).toLocaleString()}`);
        if (Number(formData.downPayment) !== selectedLead.downPayment) changes.push(`Enganche: $${selectedLead.downPayment?.toLocaleString() || 0} -> $${Number(formData.downPayment).toLocaleString()}`);
        if (formData.notes !== selectedLead.notes) changes.push(`NOTAS MODIFICADAS: ${formData.notes}`);
        if (formData.status !== selectedLead.status) changes.push(`Estado: ${STATUS_LABELS[selectedLead.status]} -> ${STATUS_LABELS[formData.status]}`);
        if (formData.interestedVehicleModel !== selectedLead.interestedVehicleModel) changes.push(`Vehículo: ${selectedLead.interestedVehicleModel || 'N/A'} -> ${formData.interestedVehicleModel || 'N/A'}`);

        if (changes.length > 0) {
          newHistory.unshift({
            date: new Date(),
            action: `CAMBIOS REALIZADOS - ${changes.join(' / ')}`,
            user: seller?.name || 'Sistema'
          });
        }

        await updateDoc(doc(db, 'leads', selectedLead.id), {
          ...formData,
          gender: formData.gender || null,
          purchaseMethod: formData.purchaseMethod || null,
          age: formData.age ? Number(formData.age) : null,
          budget: Number(formData.budget),
          downPayment: Number(formData.downPayment),
          interestedVehicleYear: Number(formData.interestedVehicleYear),
          updatedAt: serverTimestamp(),
          history: newHistory
        });
      } else {
        const initialHistory = [{
          date: new Date(),
          action: 'Prospecto creado',
          user: seller?.name || 'Sistema'
        }];

        await addDoc(collection(db, 'leads'), {
          ...formData,
          gender: formData.gender || null,
          purchaseMethod: formData.purchaseMethod || null,
          age: formData.age ? Number(formData.age) : null,
          budget: Number(formData.budget),
          downPayment: Number(formData.downPayment),
          interestedVehicleYear: Number(formData.interestedVehicleYear),
          createdBy: seller?.id || 'anonymous',
          sellerName: seller?.name || 'Vendedor',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          history: initialHistory
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'leads');
    }
  };

  const resetForm = () => {
    setFormData({
      customerName: '',
      gender: '',
      phone: '',
      age: '',
      city: '',
      interestedVehicleModel: '',
      interestedVehicleYear: new Date().getFullYear(),
      purchaseMethod: '',
      budget: '',
      downPayment: '',
      email: '',
      notes: '',
      source: '',
      status: 'new'
    });
    setSelectedLead(null);
    setShowHistory(false);
  };

  const openEditModal = (lead: Lead) => {
    setSelectedLead(lead);
    setFormData({
      customerName: lead.customerName,
      gender: lead.gender || '',
      phone: lead.phone,
      age: lead.age?.toString() || '',
      city: lead.city || '',
      interestedVehicleModel: lead.interestedVehicleModel || '',
      interestedVehicleYear: lead.interestedVehicleYear || new Date().getFullYear(),
      purchaseMethod: lead.purchaseMethod || '',
      budget: lead.budget?.toString() || '',
      downPayment: lead.downPayment?.toString() || '',
      email: lead.email || '',
      notes: lead.notes || '',
      source: lead.source || '',
      status: lead.status
    });
    setIsModalOpen(true);
  };

  const filteredLeads = leads.filter(l => {
    const query = globalSearchQuery.toLowerCase();
    const searchMatch = (
      l.customerName?.toLowerCase().includes(query) ||
      l.phone?.includes(globalSearchQuery) ||
      l.email?.toLowerCase().includes(query) ||
      l.interestedVehicleModel?.toLowerCase().includes(query) ||
      l.notes?.toLowerCase().includes(query)
    );

    // Encontrar el vendedor seleccionado en el filtro para comparar por nombre como respaldo
    const filteredSeller = sellers.find(s => s.id === sellerFilter) || (sellerFilter === seller?.id ? seller : null);
    
    const sellerMatch = sellerFilter === 'all' || 
                       l.createdBy === sellerFilter || 
                       (filteredSeller && l.sellerName?.toLowerCase().trim() === filteredSeller.name.toLowerCase().trim());

    return searchMatch && sellerMatch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Filters and Actions */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Seller Filter Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 w-full md:w-auto">
          {seller?.role === 'admin' ? (
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button 
                onClick={() => setSellerFilter('all')}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  sellerFilter === 'all' 
                    ? 'bg-white text-slate-900 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                Todos los Prospectos
              </button>
              {sellers.map((s) => (
                <button 
                  key={s.id}
                  onClick={() => setSellerFilter(s.id)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                    sellerFilter === s.id 
                      ? 'bg-white text-slate-900 shadow-sm' 
                      : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex p-1 bg-slate-100 rounded-2xl">
              <button 
                onClick={() => setSellerFilter('all')}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                  sellerFilter === 'all' 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Users size={14} />
                <span>Todos los Prospectos</span>
              </button>
              <button 
                onClick={() => setSellerFilter(seller?.id || 'all')}
                className={`px-4 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 ${
                  sellerFilter === seller?.id 
                    ? 'bg-white text-indigo-600 shadow-sm' 
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <ShieldCheck size={14} />
                <span>Mis Prospectos</span>
              </button>
            </div>
          )}
        </div>

        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="w-full md:w-auto flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95 shrink-0"
        >
          <Plus size={20} />
          <span>Agregar Prospecto</span>
        </button>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              toast.type === 'success' 
                ? 'bg-slate-900 border-emerald-500/20 text-white' 
                : 'bg-rose-600 border-rose-500 text-white'
            }`}>
              {toast.type === 'success' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center font-bold">✓</div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-rose-400 flex items-center justify-center font-bold">!</div>
              )}
              <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleting && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center space-y-6"
            >
              <div className="bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto text-rose-500 mb-2">
                <Trash2 size={40} />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black uppercase tracking-tighter text-slate-900">Confirmar Eliminación</h3>
                <p className="text-slate-500 text-sm font-medium">¿estas seguro que quieres eliminar este prospecto? Esta acción no se puede deshacer.</p>
              </div>
              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setIsDeleting(null)}
                  className="flex-1 px-8 py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-bold transition-all text-sm uppercase tracking-widest"
                >
                  No, Cancelar
                </button>
                <button 
                  onClick={() => handleDeleteLead(isDeleting)}
                  className="flex-1 px-8 py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-bold transition-all text-sm uppercase tracking-widest shadow-lg shadow-rose-100"
                >
                  Sí, Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Leads Table/Grid */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden min-h-[400px]">
        {loading ? (
          <div className="p-20 text-center text-slate-400 font-medium">Cargando prospectos...</div>
        ) : filteredLeads.length === 0 ? (
          <div className="p-20 text-center">
            <div className="bg-slate-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="text-slate-300" size={32} />
            </div>
            <h3 className="text-lg font-bold text-slate-800">No se encontraron prospectos</h3>
            <p className="text-slate-400 text-sm">Prueba con otra búsqueda o agrega uno nuevo.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="px-4 md:px-8 py-4">Cliente</th>
                  <th className="px-8 py-4 hidden lg:table-cell">Ubicación</th>
                  <th className="px-4 md:px-8 py-4">Interés</th>
                  <th className="px-8 py-4 hidden sm:table-cell">Finanzas</th>
                  <th className="px-8 py-4 hidden md:table-cell">Asesor</th>
                  <th className="px-4 md:px-8 py-4">Estado</th>
                  {seller?.role === 'admin' && <th className="px-8 py-4 text-center hidden sm:table-cell">Eliminar</th>}
                  <th className="px-4 md:px-8 py-4 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredLeads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-50/30 transition-colors group">
                    <td className="px-4 md:px-8 py-4">
                      <p className="font-bold text-slate-800 text-sm md:text-base">{lead.customerName}</p>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-slate-400 mt-1">
                        <Phone size={10} /> {lead.phone}
                      </div>
                    </td>
                    <td className="px-8 py-4 hidden lg:table-cell">
                      <div className="flex items-center gap-2 text-sm text-slate-600">
                        <MapPin size={14} className="text-slate-400" />
                        {lead.city || 'No especificada'}
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-4">
                      <div className="flex items-center gap-2 text-xs md:text-sm font-bold text-slate-700">
                        <Car size={14} className="text-indigo-500 shrink-0" />
                        <span className="truncate max-w-[100px] sm:max-w-none">
                          {lead.interestedVehicleModel || 'Cualquiera'} {lead.interestedVehicleYear ? `(${lead.interestedVehicleYear})` : ''}
                        </span>
                      </div>
                      <div className="text-[9px] md:text-[10px] text-slate-400 font-bold uppercase tracking-tight mt-1 hidden sm:block">
                         {lead.source || 'Sin origen'}
                      </div>
                    </td>
                    <td className="px-8 py-4 hidden sm:table-cell">
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-emerald-600">${lead.budget?.toLocaleString() || '0'}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase">Eng: ${lead.downPayment?.toLocaleString() || '0'}</p>
                      </div>
                    </td>
                    <td className="px-8 py-4 hidden md:table-cell">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-[9px] font-black text-indigo-600 border border-indigo-100 shadow-sm shrink-0">
                          {lead.sellerName?.substring(0, 2).toUpperCase() || 'V'}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-700 tracking-tight leading-none mb-0.5">{lead.sellerName || 'General'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 md:px-8 py-4">
                      <span className={`px-2 md:px-3 py-1 rounded-full text-[9px] md:text-[10px] font-black uppercase italic tracking-wider whitespace-nowrap ${STATUS_COLORS[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                    </td>
                    {seller?.role === 'admin' && (
                      <td className="px-8 py-4 text-center hidden sm:table-cell">
                        <button 
                          onClick={(e) => handleDeleteLead(lead.id, e)}
                          className={`p-2 rounded-lg transition-all ${
                            isDeleting === lead.id 
                              ? 'bg-rose-500 text-white animate-pulse' 
                              : 'text-slate-300 hover:bg-rose-50 hover:text-rose-500'
                          }`}
                          title="Eliminar Prospecto"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    )}
                    <td className="px-4 md:px-8 py-4 text-right">
                      <button 
                        onClick={() => openEditModal(lead)}
                        className="p-2 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 rounded-full transition-all"
                      >
                        <MoreHorizontal size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">
                    {selectedLead ? 'Editar Prospecto' : 'Nuevo Prospecto'}
                  </h2>
                  <div className="flex items-center gap-4 mt-1">
                    <p className="text-indigo-300 text-xs font-bold uppercase tracking-widest">Información de Venta</p>
                    {selectedLead && (
                      <button 
                        type="button"
                        onClick={() => setShowHistory(!showHistory)}
                        className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase transition-all ${
                          showHistory 
                            ? 'bg-indigo-500 text-white' 
                            : 'bg-white/10 text-white/70 hover:bg-white/20'
                        }`}
                      >
                        <History size={12} />
                        {showHistory ? 'Volver a Edición' : 'Ver Historial'}
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {showHistory ? (
                <div className="flex-1 overflow-y-auto p-8 space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Historial de Actividad</h3>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest italic">Timeline de Cambios</div>
                  </div>
                  
                  <div className="space-y-4">
                    {!selectedLead?.history || selectedLead.history.length === 0 ? (
                      <div className="py-12 text-center text-slate-400 italic">No hay historial registrado para este prospecto.</div>
                    ) : (
                      selectedLead.history.map((entry, idx) => (
                        <div key={idx} className="relative pl-8 pb-4 border-l-2 border-slate-100 last:pb-0">
                          <div className="absolute left-[-9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-indigo-500 shadow-sm" />
                          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100/50">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">
                                {entry.date?.toDate ? entry.date.toDate().toLocaleString() : new Date(entry.date).toLocaleString()}
                              </span>
                              <span className="text-[10px] font-bold text-slate-400 italic">Por: {entry.user || 'Sistema'}</span>
                            </div>
                            <p className="text-xs font-medium text-slate-700 leading-relaxed">{entry.action}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto">
                {duplicates.length > 0 && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-3xl flex items-start gap-4">
                    <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={20} />
                    <div>
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest">Posible Duplicado Detectado</p>
                      <p className="text-xs text-amber-700 mt-1 font-medium italic">
                        Ya existe un prospecto con este {
                          duplicates.some(d => d.phone === formData.phone) ? 'teléfono' : 
                          duplicates.some(d => d.email === formData.email) ? 'correo' : 'nombre'
                        }: <span className="font-black underline">{duplicates[0].customerName}</span>
                      </p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Basic Info */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Users size={12} /> Datos del Cliente
                    </h3>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                      <input 
                        required
                        type="text" 
                        value={formData.customerName}
                        onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                        placeholder="Ej. Juan Pérez"
                        className={`w-full px-4 py-3 bg-slate-50 border ${duplicates.some(d => d.customerName.toLowerCase() === formData.customerName.toLowerCase()) ? 'border-amber-400 shadow-amber-50' : 'border-slate-100'} rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-medium`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Teléfono</label>
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+52 ..."
                        className={`w-full px-4 py-3 bg-slate-50 border ${duplicates.some(d => d.phone === formData.phone) ? 'border-amber-400 shadow-amber-50' : 'border-slate-100'} rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-medium`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Edad</label>
                      <input 
                        type="number" 
                        value={formData.age}
                        onChange={(e) => setFormData({...formData, age: e.target.value})}
                        placeholder="Ej. 30"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Correo Electrónico</label>
                      <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        placeholder="ejemplo@correo.com"
                        className={`w-full px-4 py-3 bg-slate-50 border ${duplicates.some(d => d.email && d.email.toLowerCase() === formData.email.toLowerCase()) ? 'border-amber-400 shadow-amber-50' : 'border-slate-100'} rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-medium`}
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Ciudad</label>
                      <input 
                        type="text" 
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        placeholder="Ubicación"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Género</label>
                      <div className="flex gap-4 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formData.gender === 'Hombre' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-100' : 'text-slate-400 opacity-60'
                        }`}>
                          <input type="radio" className="hidden" name="gender" value="Hombre" checked={formData.gender === 'Hombre'} onChange={() => setFormData({...formData, gender: 'Hombre'})} />
                          Hombre
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          formData.gender === 'Mujer' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-100' : 'text-slate-400 opacity-60'
                        }`}>
                          <input type="radio" className="hidden" name="gender" value="Mujer" checked={formData.gender === 'Mujer'} onChange={() => setFormData({...formData, gender: 'Mujer'})} />
                          Mujer
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Vehicle Info */}
                  <div className="space-y-4">
                    <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <Car size={12} /> Interés de Compra
                    </h3>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Auto de Interés</label>
                      <input 
                        type="text" 
                        value={formData.interestedVehicleModel}
                        onChange={(e) => setFormData({...formData, interestedVehicleModel: e.target.value})}
                        placeholder="Ej. Mustang GT"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Año</label>
                      <input 
                        type="number" 
                        value={formData.interestedVehicleYear}
                        onChange={(e) => setFormData({...formData, interestedVehicleYear: Number(e.target.value)})}
                        placeholder="2024"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Método de Pago</label>
                      <div className="flex gap-4 p-1 bg-slate-50 rounded-2xl border border-slate-100">
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          formData.purchaseMethod === 'CONTADO' ? 'bg-white shadow-sm text-emerald-600 ring-1 ring-slate-100' : 'text-slate-400 opacity-60'
                        }`}>
                          <input type="radio" className="hidden" name="payment" value="CONTADO" checked={formData.purchaseMethod === 'CONTADO'} onChange={() => setFormData({...formData, purchaseMethod: 'CONTADO'})} />
                          CONTADO
                        </label>
                        <label className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[10px] font-black transition-all cursor-pointer ${
                          formData.purchaseMethod === 'CRÉDITO' ? 'bg-white shadow-sm text-indigo-600 ring-1 ring-slate-100' : 'text-slate-400 opacity-60'
                        }`}>
                          <input type="radio" className="hidden" name="payment" value="CRÉDITO" checked={formData.purchaseMethod === 'CRÉDITO'} onChange={() => setFormData({...formData, purchaseMethod: 'CRÉDITO'})} />
                          CRÉDITO
                        </label>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Presupuesto</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={formData.budget}
                            onChange={(e) => setFormData({...formData, budget: e.target.value})}
                            placeholder="Max"
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                          />
                          <DollarSign className="absolute left-2.5 top-3.5 text-emerald-500" size={14} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Enganche</label>
                        <div className="relative">
                          <input 
                            type="number" 
                            value={formData.downPayment}
                            onChange={(e) => setFormData({...formData, downPayment: e.target.value})}
                            placeholder="Inicial"
                            className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                          />
                          <DollarSign className="absolute left-2.5 top-3.5 text-indigo-500" size={14} />
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Origen del Cliente</label>
                      <select 
                        value={formData.source}
                        onChange={(e) => setFormData({...formData, source: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-medium text-slate-700"
                      >
                        <option value="">Seleccionar origen...</option>
                        {LEAD_SOURCES.map(source => (
                          <option key={source} value={source}>{source}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Notas (Información Vital)</label>
                  <textarea 
                    rows={3}
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    placeholder="Agrega detalles importantes sobre el cliente aquí..."
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner resize-none"
                  />
                </div>

                <div className="pt-4 flex flex-col md:flex-row gap-4 items-center justify-between border-t border-slate-100 mt-6">
                  <div className="w-full md:w-48">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1 mb-1 block">Estado del Lead</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as LeadStatus})}
                      className="w-full px-4 py-2.5 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    >
                      {Object.keys(STATUS_LABELS).map(status => (
                        <option key={status} value={status}>{STATUS_LABELS[status as LeadStatus]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-3 w-full md:w-auto">
                    <button 
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="flex-1 md:flex-none px-6 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button 
                      type="submit"
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-indigo-100 transition-all active:scale-95"
                    >
                      <Save size={18} />
                      <span>{selectedLead ? 'Guardar Cambios' : 'Crear Prospecto'}</span>
                    </button>
                  </div>
                </div>
              </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
