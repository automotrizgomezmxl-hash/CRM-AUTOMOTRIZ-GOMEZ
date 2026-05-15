export type VehicleStatus = 'available' | 'reserved' | 'sold';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'test-drive' | 'negotiation' | 'closed-won' | 'closed-lost';
export type AppointmentType = 'test-drive' | 'delivery' | 'follow-up' | 'negotiation';
export type UserRole = 'admin' | 'user';

export interface Vehicle {
  id?: string;
  make: string;
  model: string;
  year: number;
  price: number;
  status: VehicleStatus;
  vin: string;
  mileage: number;
  engine?: string;
  cylinders?: number;
  entryDate?: any;
  inShowroom?: boolean;
  color: string;
  origin?: 'Fronterizo' | 'Agencia' | 'Nacional' | 'Agencia/sin GTA' | 'Agencia/con GTA' | 'Nacional de agencia' | 'Nacional por aduana' | 'EU';
  transmission?: 'Manual' | 'Automático';
  imageUrl?: string;
  notes?: string;
  reservedByLeadId?: string;
  reservedByLeadName?: string;
  createdAt: any;
  updatedAt?: any;
}

export interface Seller {
  id: string;
  uid?: string;
  name: string;
  email?: string;
  role: UserRole;
  active?: boolean;
}

export interface LeadHistoryEntry {
  date: any;
  action: string;
  user?: string;
}

export interface Lead {
  id: string;
  customerName: string;
  gender?: 'Hombre' | 'Mujer';
  email: string;
  phone: string;
  age?: number;
  city?: string;
  source: string;
  status: LeadStatus;
  purchaseMethod?: 'CONTADO' | 'CRÉDITO';
  interestedVehicleId?: string;
  interestedVehicleModel?: string;
  interestedVehicleYear?: number;
  budget?: number;
  downPayment?: number;
  assignedTo?: string;
  notes?: string;
  createdBy?: string;
  sellerName?: string;
  createdAt: any;
  updatedAt: any;
  history?: LeadHistoryEntry[];
}

export interface Appointment {
  id?: string;
  leadId: string;
  vehicleId?: string;
  date: any;
  type: AppointmentType;
  status: 'scheduled' | 'completed' | 'cancelled';
  notes?: string;
}

export interface AppUser {
  uid: string;
  displayName: string;
  email: string;
  role: UserRole;
}
