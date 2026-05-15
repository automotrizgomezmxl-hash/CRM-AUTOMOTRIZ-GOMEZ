import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc,
  setDoc,
  doc as fireDoc,
  limit,
  serverTimestamp,
  onSnapshot,
  orderBy
} from 'firebase/firestore';
import { signInWithPopup, GoogleAuthProvider, signInAnonymously } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { Seller } from '../../types';
import { LogIn, Car, Loader2, AlertCircle, ChevronRight, Users, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface LoginProps {
  onLogin: (seller: Seller) => void;
  logoUrl: string | null;
}

export default function Login({ onLogin, logoUrl }: LoginProps) {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'admin' | 'team'>('team');

  useEffect(() => {
    const q = query(collection(db, 'sellers'));
    const unsubscribe = onSnapshot(q, 
      (snapshot) => {
        const list = snapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        })) as Seller[];
        
        // Deduplicar localmente: si hay un doc con UID (sesión) y uno sin UID (manual),
        // preferimos el manual para mostrar el nombre "limpio" o el que tenga más info.
        const uniqueMap = new Map<string, Seller>();
        list.forEach(s => {
          const key = (s.email?.toLowerCase() || s.name.toLowerCase()).trim();
          
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, s);
          } else {
            // Si ya existe, preferimos el que NO sea una sesión técnica (los que NO tienen pickerId o tienen campos extra)
            const existing = uniqueMap.get(key)!;
            if (s.role === 'admin' || (!s.uid && existing.uid)) {
              uniqueMap.set(key, s);
            }
          }
        });
        
        const finalSellers = Array.from(uniqueMap.values());
        setSellers(finalSellers);
        if (finalSellers.length === 0) setView('admin');
        setLoadingSellers(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, 'sellers');
        setLoadingSellers(false);
        setError("Error al cargar equipo. Verifica tu conexión.");
      }
    );

    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) throw new Error("No se pudo obtener el correo de Google");

      const q = query(collection(db, 'sellers'), where('email', '==', user.email.toLowerCase()));
      const snap = await getDocs(q);

      let seller: Seller;

      if (snap.empty) {
        // ... (resto del código de admin igual)
        const adminEmail = 'automotrizgomezmxl@gmail.com';
        const fallbackAdmin = 'jozzcolors@gmail.com';
        
        if (user.email.toLowerCase() === adminEmail || user.email.toLowerCase() === fallbackAdmin) {
          const adminData = {
            name: user.displayName || 'ADMIN',
            email: user.email.toLowerCase(),
            role: 'admin' as const,
            uid: user.uid,
            createdAt: serverTimestamp()
          };
          
          await setDoc(fireDoc(db, 'sellers', user.uid), adminData);
          seller = { id: user.uid, ...adminData } as Seller;
        } else {
          throw new Error('Cuenta no autorizada como administrador.');
        }
      } else {
        // Si ya existe, tenemos que asegurarnos de que el documento use el UID como ID
        // para cumplir con las reglas de seguridad sin crear duplicados
        const existingDocs = snap.docs;
        const targetDoc = existingDocs.find(d => d.id === user.uid) || existingDocs[0];
        const data = targetDoc.data();
        
        // Si el documento existente NO tiene el ID del UID, lo migramos
        if (targetDoc.id !== user.uid) {
          await setDoc(fireDoc(db, 'sellers', user.uid), { 
            ...data, 
            uid: user.uid, 
            updatedAt: serverTimestamp() 
          });
          // Nota: No borramos el viejo aquí por seguridad de datos asociados (Leads),
          // pero ya no lo mostraremos en la lista gracias al filtro de arriba.
        } else {
          await setDoc(fireDoc(db, 'sellers', user.uid), { 
            ...data, 
            uid: user.uid, 
            updatedAt: serverTimestamp() 
          }, { merge: true });
        }
        
        seller = { id: user.uid, ...data, uid: user.uid } as Seller;
      }

      onLogin(seller);
    } catch (err: any) {
      setError(err.code === 'auth/popup-closed-by-user' ? 'Ventana cerrada.' : (err.message || 'Error de acceso.'));
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleSelectSeller = async (selectedSeller: Seller) => {
    setError(null);
    setIsAuthenticating(true);
    try {
      const cred = await signInAnonymously(auth);
      const uid = cred.user.uid;

      // Migrar o actualizar el documento para que use el UID anónimo como ID de documento
      // Esto es CRITICO para que las reglas de Firebase den permiso
      await setDoc(fireDoc(db, 'sellers', uid), {
        ...selectedSeller,
        uid: uid,
        updatedAt: serverTimestamp()
      });

      // Si el ID seleccionado era diferente al UID (ej. un ID aleatorio de addDoc),
      // lo marcamos internamente para que el filtro de la lista lo ignore y no se duplique visualmente.
      onLogin({ ...selectedSeller, id: uid, uid });
    } catch (err: any) {
      console.error(err);
      setError('Error al conectar con el servidor.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="bg-slate-900 p-6 rounded-[2.5rem] mb-6 shadow-2xl shadow-indigo-100 flex items-center justify-center w-24 h-24 mx-auto border-4 border-white">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            ) : (
              <Car size={40} className="text-white" />
            )}
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-1">Automotriz Gomez</h1>
          <p className="text-[10px] font-black text-indigo-600 uppercase tracking-[0.2em]">Panel de Control CRM</p>
        </div>

        <motion.div 
          layout
          className="bg-white rounded-[2.5rem] shadow-2xl shadow-indigo-100/50 border border-slate-100 overflow-hidden"
        >
          <div className="flex border-b border-slate-50">
            <button 
              onClick={() => setView('team')}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'team' ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Equipo de Ventas
            </button>
            <button 
              onClick={() => setView('admin')}
              className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${view === 'admin' ? 'text-indigo-600 bg-indigo-50/30' : 'text-slate-400 hover:text-slate-600'}`}
            >
              Administrador
            </button>
          </div>

          <div className="p-8">
            <AnimatePresence mode="wait">
              {view === 'team' ? (
                <motion.div 
                  key="team"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <Users className="text-indigo-500" size={20} />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Selecciona tu usuario</h2>
                  </div>

                  {loadingSellers ? (
                    <div className="py-10 flex justify-center">
                      <Loader2 className="animate-spin text-indigo-600" size={24} />
                    </div>
                  ) : sellers.filter(s => s.role !== 'admin').length === 0 ? (
                    <div className="bg-slate-50 p-6 rounded-2xl text-center">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">No hay vendedores registrados aún</p>
                    </div>
                  ) : (
                    <div className="max-h-64 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
                      {sellers.filter(s => s.role !== 'admin').map((s) => (
                        <button
                          key={s.id}
                          disabled={isAuthenticating}
                          onClick={() => handleSelectSeller(s)}
                          className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-50 hover:bg-indigo-50 border border-slate-100 hover:border-indigo-200 transition-all text-left group disabled:opacity-50"
                        >
                          <div>
                            <p className="font-bold text-slate-800 text-sm group-hover:text-indigo-700">{s.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider italic">Ventas</p>
                          </div>
                          <ChevronRight size={18} className="text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-1 transition-all" />
                        </button>
                      ))}
                    </div>
                  )}
                </motion.div>
              ) : (
                <motion.div 
                  key="admin"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="space-y-6"
                >
                  <div className="flex items-center gap-3 mb-6">
                    <ShieldCheck className="text-indigo-500" size={20} />
                    <h2 className="text-sm font-black text-slate-800 uppercase tracking-tight">Acceso de Control</h2>
                  </div>

                  <button 
                    onClick={handleGoogleLogin}
                    disabled={isAuthenticating}
                    className="w-full flex items-center justify-center gap-4 bg-white hover:bg-slate-50 border-2 border-slate-100 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all active:scale-95 shadow-sm disabled:opacity-50"
                  >
                    {isAuthenticating ? (
                      <Loader2 className="animate-spin text-indigo-600" size={20} />
                    ) : (
                      <img src="https://www.gstatic.com/firebase/hub/sdk/impl/auth/google.png" className="w-5 h-5" alt="Google" />
                    )}
                    {isAuthenticating ? 'Validando...' : 'Entrar como Propietario'}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
              <div className="mt-6 bg-rose-50 text-rose-600 p-4 rounded-2xl flex items-start gap-3 border border-rose-100 animate-shake">
                <AlertCircle className="shrink-0 mt-0.5" size={16} />
                <p className="text-[9px] font-black uppercase tracking-wider leading-relaxed">{error}</p>
              </div>
            )}
          </div>

          <div className="bg-slate-50 border-t border-slate-100 p-6 text-center">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Administración de Inventario Gomez
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
