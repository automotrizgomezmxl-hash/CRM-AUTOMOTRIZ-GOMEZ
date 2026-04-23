/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  signInAnonymously,
  User 
} from 'firebase/auth';
import { auth, db } from './lib/firebase';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './components/dashboard/Dashboard';
import Leads from './components/leads/Leads';
import Inventory from './components/inventory/Inventory';
import Settings from './components/settings/Settings';
import Login from './components/auth/Login';
import { Seller } from './types';
import { Loader2 } from 'lucide-react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// Main component
export default function App() {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [searchQuery, setSearchQuery] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  useEffect(() => {
    const reauth = async () => {
      const savedSellerStr = localStorage.getItem('activeSeller');
      if (savedSellerStr) {
        const savedSeller = JSON.parse(savedSellerStr);
        // Solo iniciamos sesión anónima si NO es un admin
        // Los admins usan su sesión de Google persistente de Firebase
        if (savedSeller.role !== 'admin') {
          try {
            await signInAnonymously(auth);
            setSeller(savedSeller);
          } catch (err: any) {
            console.error("Error re-authenticating anonymously", err);
            setSeller(savedSeller);
          }
        } else {
          // Para admins, esperamos un momento a que Firebase Auth recupere la sesión de Google
          // Pero establecemos el estado local inmediatamente para la UI
          setSeller(savedSeller);
        }
      }
      setLoading(false);
    };

    // 2. Fetch global settings
    const unsubConfig = onSnapshot(doc(db, 'config', 'global'), 
      (doc) => {
        if (doc.exists()) {
          setLogoUrl(doc.data().logoUrl);
        }
      },
      (error) => {
        console.error("Error cargando configuración global:", error);
      }
    );

    reauth();
    return () => unsubConfig();
  }, []);

  const handleUpdateLogo = async (newUrl: string | null) => {
    setLogoUrl(newUrl);
    try {
      await setDoc(doc(db, 'config', 'global'), {
        logoUrl: newUrl
      }, { merge: true });
    } catch (e) {
      console.error("Error saving logo", e);
    }
  };

  const handleLogin = (newSeller: Seller) => {
    setSeller(newSeller);
    localStorage.setItem('activeSeller', JSON.stringify(newSeller));
  };

  const handleLogout = () => {
    setSeller(null);
    localStorage.removeItem('activeSeller');
    auth.signOut();
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!seller) {
    return <Login onLogin={handleLogin} logoUrl={logoUrl} />;
  }

  const renderContent = () => {
    switch(activeTab) {
      case 'dashboard': return <Dashboard globalSearchQuery={searchQuery} seller={seller} />;
      case 'leads': return <Leads globalSearchQuery={searchQuery} seller={seller} />;
      case 'inventory': return <Inventory globalSearchQuery={searchQuery} seller={seller} />;
      case 'settings': return <Settings logoUrl={logoUrl} setLogoUrl={handleUpdateLogo} seller={seller} />;
      default: return <Dashboard globalSearchQuery={searchQuery} seller={seller} />;
    }
  };

  return (
    <DashboardLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      seller={seller} 
      logoUrl={logoUrl}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      onLogout={handleLogout}
    >
      {renderContent()}
    </DashboardLayout>
  );
}
