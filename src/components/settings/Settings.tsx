import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Car, 
  Plus, 
  Trash2, 
  Camera, 
  UserPlus, 
  Save,
  CheckCircle2,
  BarChart3,
  X,
  Calendar as CalendarIcon
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  doc,
  updateDoc
} from 'firebase/firestore';
import { 
  ref, 
  uploadBytes, 
  getDownloadURL 
} from 'firebase/storage';
import { db, storage, auth } from '../../lib/firebase';
import { Vehicle, Seller, UserRole } from '../../types';

interface SettingsProps {
  logoUrl: string | null;
  setLogoUrl: (url: string | null) => void;
  seller: Seller | null;
}

export default function Settings({ logoUrl, setLogoUrl, seller }: SettingsProps) {
  const [vendedores, setVendedores] = useState<Seller[]>([]);
  const [isSellerModalOpen, setIsSellerModalOpen] = useState(false);
  const [sellerFormData, setSellerFormData] = useState({ name: '', role: 'user' as UserRole });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => {
    const q = query(collection(db, 'sellers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fullList = snapshot.docs.map(doc => {
        const data = doc.data();
        return { ...data, id: doc.id };
      }) as Seller[];

      const uniqueMap = new Map<string, Seller>();
      fullList.forEach(s => {
        const key = s.email?.toLowerCase() || s.name.toLowerCase();
        if (!uniqueMap.has(key) || s.uid) {
          uniqueMap.set(key, s);
        }
      });
      
      setVendedores(Array.from(uniqueMap.values()));
    });
    return () => unsubscribe();
  }, []);

  const handleAddSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'sellers'), {
        ...sellerFormData,
        createdAt: serverTimestamp()
      });
      setIsSellerModalOpen(false);
      setSellerFormData({ name: '', role: 'user' });
    } catch (error) {
      console.error("Error adding seller", error);
    }
  };

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [sellerToDelete, setSellerToDelete] = useState<{id: string, name: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const confirmDelete = async () => {
    if (!sellerToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'sellers', sellerToDelete.id));
      setToast({ message: `${sellerToDelete.name} eliminado`, type: 'success' });
      setIsDeleteModalOpen(false);
      setSellerToDelete(null);
    } catch (error: any) {
      setToast({ message: 'Error: ' + error.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteSeller = (id: string, name: string) => {
    setSellerToDelete({ id, name });
    setIsDeleteModalOpen(true);
  };

  const [inventoryItems, setInventoryItems] = useState<Vehicle[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'vehicles'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const vehicleData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        };
      }) as Vehicle[];
      setInventoryItems(vehicleData);
    });
    return () => unsubscribe();
  }, []);

  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const [uploading, setUploading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [vehicleFormData, setVehicleFormData] = useState({
    model: '',
    year: new Date().getFullYear(),
    mileage: '',
    engine: '',
    cylinders: '',
    vin: '',
    price: '',
    inShowroom: 'SI',
    entryDate: new Date().toISOString().split('T')[0],
    notes: '',
    imageUrl: ''
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputInnerRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Basic size validation (e.g., limit to 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setModalError('La imagen es demasiado grande. El límite es 10MB.');
        return;
      }

      setSelectedFile(file);
      
      // Efficient preview using Object URL instead of Data URL (Base64)
      const preview = URL.createObjectURL(file);
      setPreviewUrl(preview);
    }
  };

  const transformDriveUrl = (url: string) => {
    if (!url) return '';
    
    // Si ya es un link de contenido directo, no hacer nada
    if (url.includes('googleusercontent.com/d/')) return url;

    let id = '';
    // Patrones comunes de IDs de Google Drive (suelen tener entre 25 y 40 caracteres)
    const patterns = [
      /\/file\/d\/([a-zA-Z0-9_-]{25,})/,
      /[?&]id=([a-zA-Z0-9_-]{25,})/,
      /\/open\?id=([a-zA-Z0-9_-]{25,})/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        id = match[1];
        break;
      }
    }
    
    if (id) {
      // Este formato es mucho más confiable para mostrar imágenes en aplicaciones web
      return `https://lh3.googleusercontent.com/d/${id}`;
    }
    
    return url;
  };

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validaciones básicas de formulario
    if (!vehicleFormData.model || !vehicleFormData.price || !vehicleFormData.year) {
      setModalError('Por favor completa los campos obligatorios (Modelo, Año, Precio).');
      return;
    }
    
    setUploading(true);
    setModalError(null);
    try {
      let finalImageUrl = transformDriveUrl(vehicleFormData.imageUrl);

      if (selectedFile) {
        try {
          console.log("Iniciando subida a Storage:", selectedFile.name);
          // Ruta simplificada para evitar problemas de caracteres
          const cleanName = selectedFile.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileRef = ref(storage, `vehicles/${Date.now()}_${cleanName}`);
          
          // Subida con metadatos para ayudar a Firebase
          const metadata = {
            contentType: selectedFile.type,
          };
          
          const snapshot = await uploadBytes(fileRef, selectedFile, metadata);
          finalImageUrl = await getDownloadURL(snapshot.ref);
          console.log("Subida exitosa. URL:", finalImageUrl);
        } catch (storageErr: any) {
          console.error("Error crítico en Storage:", storageErr);
          
          let friendlyMsg = "Error en el servidor de imágenes.";
          if (storageErr.code === 'storage/unauthorized') {
            friendlyMsg = "PERMISOS DENEGADOS: Debes habilitar las 'Reglas de Storage' en tu consola de Firebase para permitir subidas públicas.";
          } else if (storageErr.code === 'storage/project-not-found') {
            friendlyMsg = "PROYECTO NO ENCONTRADO: Verifica la configuración de tu bucket en Firebase.";
          } else if (storageErr.code === 'storage/retry-limit-exceeded') {
            friendlyMsg = "TIEMPO AGOTADO: La conexión es lenta o el servidor no responde.";
          }
          
          throw new Error(`${friendlyMsg}\n\nDetalle técnico: ${storageErr.message}`);
        }
      }

      const vehicleData = {
        make: 'Automotriz Gomez', 
        model: vehicleFormData.model,
        year: Number(vehicleFormData.year),
        price: Number(vehicleFormData.price),
        mileage: Number(vehicleFormData.mileage),
        engine: vehicleFormData.engine,
        cylinders: Number(vehicleFormData.cylinders),
        vin: vehicleFormData.vin,
        inShowroom: vehicleFormData.inShowroom === 'SI',
        entryDate: vehicleFormData.entryDate,
        notes: vehicleFormData.notes,
        imageUrl: finalImageUrl,
        status: 'available' as const,
        color: 'Pendiente',
        updatedAt: serverTimestamp()
      };

      if (selectedVehicle?.id) {
        await updateDoc(doc(db, 'vehicles', selectedVehicle.id), vehicleData);
      } else {
        await addDoc(collection(db, 'vehicles'), {
          ...vehicleData,
          createdAt: serverTimestamp()
        });
      }
      setIsVehicleModalOpen(false);
      resetVehicleForm();
    } catch (error: any) {
      console.error("Error saving vehicle", error);
      setModalError(error.message || 'Error inesperado al guardar el vehículo.');
    } finally {
      setUploading(false);
    }
  };

  const [isDeleteVehicleModalOpen, setIsDeleteVehicleModalOpen] = useState(false);
  const [vehicleToDelete, setVehicleToDelete] = useState<{id: string, model: string} | null>(null);

  const confirmDeleteVehicle = async () => {
    if (!vehicleToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleToDelete.id));
      setToast({ message: 'Vehículo eliminado', type: 'success' });
      setIsDeleteVehicleModalOpen(false);
      setVehicleToDelete(null);
    } catch (error: any) {
      setToast({ message: 'Error: ' + error.message, type: 'error' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteVehicle = (id: string, model: string) => {
    setVehicleToDelete({ id, model });
    setIsDeleteVehicleModalOpen(true);
  };

  const openEditVehicleModal = (vehicle: Vehicle) => {
    setSelectedVehicle(vehicle);
    setSelectedFile(null);
    setPreviewUrl(null);
    setModalError(null);
    setVehicleFormData({
      model: vehicle.model,
      year: vehicle.year,
      mileage: vehicle.mileage.toString(),
      engine: vehicle.engine || '',
      cylinders: vehicle.cylinders?.toString() || '',
      vin: vehicle.vin,
      price: vehicle.price.toString(),
      inShowroom: vehicle.inShowroom ? 'SI' : 'NO',
      entryDate: vehicle.entryDate || new Date().toISOString().split('T')[0],
      notes: vehicle.notes || '',
      imageUrl: vehicle.imageUrl || ''
    });
    setIsVehicleModalOpen(true);
  };

  const resetVehicleForm = () => {
    setSelectedVehicle(null);
    setSelectedFile(null);
    // Revoke object URL to prevent memory leaks
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setModalError(null);
    setVehicleFormData({
      model: '',
      year: new Date().getFullYear(),
      mileage: '',
      engine: '',
      cylinders: '',
      vin: '',
      price: '',
      inShowroom: 'SI',
      entryDate: new Date().toISOString().split('T')[0],
      notes: '',
      imageUrl: ''
    });
  };

  const [tempLogoUrl, setTempLogoUrl] = useState(logoUrl || '');

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-20 relative">
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200]"
          >
            <div className={`px-8 py-4 rounded-2xl shadow-2xl flex items-center gap-4 border ${
              toast.type === 'success' 
                ? 'bg-slate-900 border-emerald-500/20 text-white' 
                : 'bg-rose-600 border-rose-500 text-white'
            }`}>
              {toast.type === 'success' ? (
                <div className="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center font-bold text-[10px]">✓</div>
              ) : (
                <div className="w-6 h-6 rounded-full bg-rose-400 flex items-center justify-center font-bold text-[10px]">!</div>
              )}
              <span className="text-sm font-black uppercase tracking-widest">{toast.message}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">¿Eliminar Vendedor?</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">Estás a punto de borrar a <span className="text-rose-600 font-bold">{sellerToDelete?.name}</span> de forma permanente.</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDelete}
                  disabled={isDeleting}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, Eliminar Ahora'}
                </button>
                <button 
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 border border-slate-100 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isDeleteVehicleModalOpen && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xl">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 text-center"
            >
              <div className="w-20 h-20 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Car size={40} />
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter mb-2">¿Eliminar Auto?</h3>
              <p className="text-sm text-slate-500 mb-8 font-medium">Vas a borrar el <span className="text-rose-600 font-bold">{vehicleToDelete?.model}</span> del inventario permanentemente.</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={confirmDeleteVehicle}
                  disabled={isDeleting}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl shadow-rose-100 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isDeleting ? 'Eliminando...' : 'Sí, Eliminar del Inventario'}
                </button>
                <button 
                  onClick={() => setIsDeleteVehicleModalOpen(false)}
                  className="w-full py-4 text-xs font-black text-slate-400 uppercase tracking-widest hover:text-slate-600 border border-slate-100 rounded-2xl transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSellerModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-10 bg-indigo-700 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">Vendedor</h2>
                  <p className="text-indigo-200 text-[10px] font-black uppercase tracking-widest mt-1 italic">Acceso al Sistema</p>
                </div>
                <button 
                  onClick={() => setIsSellerModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddSeller} className="p-10 space-y-6">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Nombre Completo</label>
                  <input 
                    type="text" 
                    required
                    value={sellerFormData.name}
                    onChange={(e) => setSellerFormData({...sellerFormData, name: e.target.value})}
                    placeholder="Ej. Carlos Ruiz"
                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner font-bold"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Rol de Usuario</label>
                  <select 
                    value={sellerFormData.role}
                    onChange={(e) => setSellerFormData({...sellerFormData, role: e.target.value as any})}
                    className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-black text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                  >
                    <option value="user">Vendedor (Estándar)</option>
                    <option value="admin">Administrador (Control Total)</option>
                  </select>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsSellerModalOpen(false)}
                    className="flex-1 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cerrar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isVehicleModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-10 bg-slate-900 text-white flex justify-between items-center shrink-0">
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tighter">
                    {selectedVehicle ? 'Editar Auto' : 'Agregar Auto'}
                  </h2>
                  <p className="text-indigo-400 text-[10px] font-black uppercase tracking-widest mt-1 italic">
                    {selectedVehicle ? 'Modificar Información' : 'Ingreso de Inventario'}
                  </p>
                </div>
                <button 
                  onClick={() => setIsVehicleModalOpen(false)}
                  className="bg-white/10 hover:bg-white/20 p-2 rounded-full transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAddVehicle} className="p-10 overflow-y-auto space-y-6">
                {modalError && (
                  <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-[10px] font-black uppercase tracking-widest animate-pulse">
                    <X size={16} className="shrink-0" />
                    <p>{modalError}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Fecha de Ingreso</label>
                    <input 
                      type="date" 
                      required
                      value={vehicleFormData.entryDate}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, entryDate: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Modelo / Nombre</label>
                    <input 
                      type="text" 
                      required
                      value={vehicleFormData.model}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, model: e.target.value})}
                      placeholder="Ej. Ford Mustang GT"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Kilometraje</label>
                    <input 
                      type="number" 
                      required
                      value={vehicleFormData.mileage}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, mileage: e.target.value})}
                      placeholder="0"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Motor</label>
                    <input 
                      type="text" 
                      value={vehicleFormData.engine}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, engine: e.target.value})}
                      placeholder="Ej. 5.0L V8"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Cilindros</label>
                    <input 
                      type="number" 
                      value={vehicleFormData.cylinders}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, cylinders: e.target.value})}
                      placeholder="8"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Serie (VIN)</label>
                    <input 
                      type="text" 
                      required
                      value={vehicleFormData.vin}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, vin: e.target.value})}
                      placeholder="Número de serie"
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Precio</label>
                    <div className="relative">
                      <input 
                        type="number" 
                        required
                        value={vehicleFormData.price}
                        onChange={(e) => setVehicleFormData({...vehicleFormData, price: e.target.value})}
                        placeholder="0.00"
                        className="w-full pl-10 pr-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                      />
                      <span className="absolute left-4 top-3.5 text-emerald-600 font-bold">$</span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">En Piso</label>
                    <select 
                      value={vehicleFormData.inShowroom}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, inShowroom: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                    >
                      <option value="SI">SI</option>
                      <option value="NO">NO</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Fotografía del Vehículo</label>
                  <div className="flex flex-col gap-4">
                    <div className="flex gap-2">
                        <input 
                          type="text"
                          value={vehicleFormData.imageUrl}
                          onChange={(e) => {
                            const url = e.target.value;
                            setVehicleFormData({...vehicleFormData, imageUrl: transformDriveUrl(url)});
                            setPreviewUrl(null);
                            setSelectedFile(null);
                          }}
                          placeholder="Link de Drive o imagen (opcional)"
                          className="flex-1 px-5 py-3 bg-slate-50 border-none rounded-2xl text-[10px] focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                        />
                    </div>
                    {(previewUrl || vehicleFormData.imageUrl) ? (
                      <div className="w-full h-40 rounded-[2.5rem] overflow-hidden border-2 border-slate-100 shadow-sm relative group bg-slate-50">
                        <img 
                          src={previewUrl || vehicleFormData.imageUrl} 
                          alt="Vista previa" 
                          className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-700" 
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <button 
                            type="button"
                            onClick={() => fileInputInnerRef.current?.click()}
                            className="bg-white/20 backdrop-blur-md border border-white/30 text-white px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-white/40 transition-all"
                          >
                            Cambiar Imagen
                          </button>
                        </div>
                        <input 
                          type="file" 
                          accept="image/*"
                          ref={fileInputInnerRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </div>
                    ) : (
                      <div className="relative group">
                        <input 
                          type="file" 
                          accept="image/*"
                          ref={fileInputRef}
                          onChange={handleFileChange}
                          className="hidden"
                        />
                        <button 
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center justify-center gap-4 w-full p-10 border-2 border-dashed border-slate-200 rounded-[2.5rem] hover:border-indigo-400 hover:bg-indigo-50/30 transition-all cursor-pointer group"
                        >
                          <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 group-hover:scale-110 transition-transform">
                            <Camera className="text-indigo-600" size={32} />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-bold text-slate-700">Haz clic para subir fotografía</p>
                            <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Formatos PNG, JPG o WEBP</p>
                          </div>
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">Notas Adicionales</label>
                  <textarea 
                    value={vehicleFormData.notes}
                    onChange={(e) => setVehicleFormData({...vehicleFormData, notes: e.target.value})}
                    placeholder="Detalles sobre el estado del vehículo..."
                    rows={3}
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-3xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all shadow-inner"
                  ></textarea>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsVehicleModalOpen(false)}
                    className="flex-1 py-4 text-sm font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={uploading}
                    className={`flex-[2] bg-slate-900 hover:bg-indigo-600 text-white py-4 rounded-[2rem] text-sm font-black uppercase tracking-widest shadow-xl shadow-indigo-100 transition-all active:scale-95 flex items-center justify-center gap-3 ${uploading ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {uploading ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    ) : (
                      selectedVehicle ? <Save size={20} /> : <Plus size={20} />
                    )}
                    {uploading ? 'Subiendo...' : (selectedVehicle ? 'Guardar Cambios' : 'Agregar al Sistema')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Branding Section */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Imagen de Marca</h2>
          <p className="text-sm text-slate-400">Personaliza el logotipo de Automotriz Gomez</p>
        </div>
        <div className="p-8 flex flex-col md:flex-row gap-8 items-center">
          <div className="bg-slate-900 w-32 h-32 rounded-3xl flex items-center justify-center overflow-hidden shadow-xl border border-slate-800 shrink-0">
            {tempLogoUrl ? (
              <img src={tempLogoUrl} alt="Preview Logo" className="w-full h-full object-contain p-2" referrerPolicy="no-referrer" />
            ) : (
              <Car size={48} className="text-white" />
            )}
          </div>
          <div className="flex-1 w-full space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-1">URL del Logotipo</label>
              <input 
                type="text" 
                value={tempLogoUrl}
                onChange={(e) => setTempLogoUrl(transformDriveUrl(e.target.value))}
                placeholder="URL del Logotipo (soporta Drive)"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-300"
              />
            </div>
            <button 
              onClick={() => setLogoUrl(tempLogoUrl)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-xl text-xs font-bold transition-all shadow-lg shadow-indigo-100 flex items-center gap-2 active:scale-95"
            >
              <Save size={16} />
              Actualizar Logo Global
            </button>
          </div>
        </div>
      </section>

      {/* Sales Agents Section */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800">Gestión de Vendedores</h2>
            <p className="text-sm text-slate-400">Agrega o administra tu equipo de ventas</p>
          </div>
          <button 
            onClick={() => setIsSellerModalOpen(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-lg shadow-indigo-100 active:scale-95"
          >
            <UserPlus size={16} />
            <span>Agregar Vendedor</span>
          </button>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50/50">
                <th className="px-8 py-4">Nombre</th>
                <th className="px-8 py-4">Rol</th>
                <th className="px-8 py-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {vendedores.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-8 py-10 text-center text-slate-400 text-sm font-bold uppercase tracking-widest">
                    No hay vendedores registrados
                  </td>
                </tr>
              ) : (
                vendedores.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50/30 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold text-xs uppercase">
                          {v.name[0]}
                        </div>
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2">
                            <span className="font-black text-slate-700 text-sm">{v.name}</span>
                            {auth.currentUser?.uid === v.id && (
                              <span className="bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase px-2 py-0.5 rounded-full tracking-tighter shadow-sm">Tú</span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-mono italic">ID: {v.id.substring(0, 6)}...</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase italic ${
                        v.role === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {v.role === 'admin' ? 'Administrador' : 'Vendedor'}
                      </span>
                    </td>
                    <td className="px-8 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button 
                          type="button"
                          disabled={auth.currentUser?.uid === v.id || isDeleting}
                          onClick={() => handleDeleteSeller(v.id, v.name)}
                          className="w-12 h-12 flex items-center justify-center text-white bg-rose-600 rounded-2xl transition-all active:scale-90 shadow-lg hover:bg-rose-700 disabled:opacity-20 disabled:grayscale disabled:cursor-not-allowed"
                          title={auth.currentUser?.uid === v.id ? "NO PUEDES ELIMINARTE A TI MISMO" : "ELIMINAR VENDEDOR"}
                        >
                          <Trash2 size={24} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Inventory Management Section */}
      <section className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Gestión de Inventario</h2>
            <p className="text-sm text-slate-400">Control total de tus unidades y catálogos</p>
          </div>
          <button 
            onClick={() => setIsVehicleModalOpen(true)}
            className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full text-xs font-bold transition-all shadow-lg active:scale-95"
          >
            <Plus size={16} />
            <span>Agregar Auto</span>
          </button>
        </div>
        
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {inventoryItems.length === 0 ? (
            <div className="col-span-full py-20 text-center text-slate-400 font-medium">
              No hay vehículos registrados en el inventario.
            </div>
          ) : (
            inventoryItems.map((item) => (
              <div key={item.id} className="flex items-center gap-4 p-4 rounded-2xl border border-slate-50 hover:border-indigo-100 transition-all group">
                <div className="relative w-20 h-20 rounded-xl overflow-hidden shrink-0 bg-slate-100">
                  {item.imageUrl ? (
                    <img src={item.imageUrl} alt={item.model} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <Car size={32} />
                    </div>
                  )}
                  <button className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera size={20} className="text-white" />
                  </button>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-slate-800 text-sm truncate">{item.model}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">VIN: {item.vin?.slice(-6) || 'N/A'}</p>
                    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md ${item.inShowroom ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                      {item.inShowroom ? 'En Piso' : 'Bodega'}
                    </span>
                  </div>
                  <div className="mt-2 flex gap-2">
                    <button 
                      onClick={() => openEditVehicleModal(item)}
                      className="text-[10px] bg-slate-100 hover:bg-indigo-100 hover:text-indigo-600 text-slate-600 px-3 py-1 rounded-full font-bold transition-all"
                    >
                      Modificar
                    </button>
                    <button 
                      onClick={() => item.id && handleDeleteVehicle(item.id, item.model)}
                      className="text-[10px] bg-rose-600 hover:bg-rose-700 text-white px-4 py-1.5 rounded-full font-bold transition-all shadow-sm active:scale-95"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        
        <div className="p-6 bg-slate-50/50 border-t border-slate-100 flex justify-end gap-3">
          <button className="px-6 py-2.5 rounded-2xl text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors">
            Descartar
          </button>
          <button className="flex items-center gap-2 bg-slate-900 text-white px-8 py-2.5 rounded-2xl text-xs font-bold shadow-lg shadow-slate-200 active:scale-95 transition-all">
            <Save size={16} />
            <span>Guardar Cambios</span>
          </button>
        </div>
      </section>

      {/* System Settings */}
      <section className="bg-indigo-900 rounded-3xl p-8 text-white relative overflow-hidden">
        <div className="relative z-10">
          <h2 className="text-xl font-black mb-2 uppercase tracking-tighter">Configuración del Sistema</h2>
          <p className="text-indigo-200 text-sm mb-6 max-w-md italic">Ajusta los parámetros generales de tu Automotriz Gomez Pro.</p>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
              <CheckCircle2 className="text-emerald-400 mb-2" size={20} />
              <h4 className="font-bold text-sm">Notificaciones</h4>
              <p className="text-[10px] text-indigo-300">Alertas de nuevos leads activadas</p>
            </div>
            <div className="bg-white/10 p-4 rounded-2xl border border-white/10 hover:bg-white/20 transition-colors cursor-pointer">
              <BarChart3 className="text-indigo-400 mb-2" size={20} />
              <h4 className="font-bold text-sm">Reportes Mensuales</h4>
              <p className="text-[10px] text-indigo-300">Resumen automático cada día 1</p>
            </div>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10">
          <Car size={200} />
        </div>
      </section>
    </div>
  );
}
