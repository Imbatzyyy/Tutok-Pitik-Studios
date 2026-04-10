export type UserRole = 'super_admin' | 'admin' | 'staff' | 'customer' | 'guest';

export interface User {
  id: string;
  username?: string;
  fullName: string;
  email: string;
  phone?: string;
  role: UserRole;
  profilePicture?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Booking {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  service: string;
  date: string;
  startTime: string;
  endTime: string;
  duration: number;
  price: number;
  transportation: number;
  totalPrice: number;
  location: string;
  message?: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  createdAt: string;
  updatedAt?: string;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  createdAt: string;
  status: 'unread' | 'read' | 'replied';
}

export interface PortfolioImage {
  id: string;
  url: string;
  title: string;
  category: string;
  subcategory: string;
  isFavorite?: boolean;
}
