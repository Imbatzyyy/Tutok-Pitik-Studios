import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import StatsBar from './components/StatsBar';
import About from './components/About';
import Services from './components/Services';
import Portfolio from './components/Portfolio';
import Contact from './components/Contact';
import Footer from './components/Footer';
import Lightbox from './components/Lightbox';
import SuccessModal from './components/SuccessModal';
import ScrollToTop from './components/ScrollToTop';
import Auth from './components/Auth';
import UserProfile from './components/UserProfile';
import AdminDashboard from './components/AdminDashboard';
import LoadingScreen from './components/LoadingScreen';
import ResetPasswordPage from './components/ResetPasswordPage';
import { supabase } from './lib/supabase';
import type { User } from './lib/types';
import './styles/globals.css';

interface ModalData {
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
}

export default function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [lightboxActive, setLightboxActive] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [modalActive, setModalActive] = useState(false);
  const [modalData, setModalData] = useState<ModalData | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  // Supabase Session Management - Version 123
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing Supabase auth...');
        
        // Get current session from Supabase
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setGuestUser();
          return;
        }

        if (session?.user) {
          console.log('Active session found, fetching user profile...');
          
          // Fetch user profile from database
          const { data: userProfile, error: profileError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) {
            console.error('Error fetching profile:', profileError);
            setGuestUser();
          } else if (userProfile) {
            console.log('User profile loaded:', userProfile);
            const userData: User = {
              id: userProfile.id,
              firstName: userProfile.full_name?.split(' ')[0] || '',
              lastName: userProfile.full_name?.split(' ').slice(1).join(' ') || '',
              username: userProfile.username || '',
              fullName: userProfile.full_name,
              email: userProfile.email,
              phone: userProfile.phone || '',
              role: userProfile.role,
              profilePicture: userProfile.profile_picture_url || '',
              joinDate: userProfile.created_at
            };
            setUser(userData);
          }
        } else {
          console.log('No active session, setting guest user');
          setGuestUser();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setGuestUser();
      }
      // Removed setIsLoading(false) - let LoadingScreen control this
    };

    initializeAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event);
      
      if (event === 'SIGNED_IN' && session?.user) {
        // Fetch user profile
        const { data: userProfile } = await supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (userProfile) {
          const userData: User = {
            id: userProfile.id,
            firstName: userProfile.full_name?.split(' ')[0] || '',
            lastName: userProfile.full_name?.split(' ').slice(1).join(' ') || '',
            username: userProfile.username || '',
            fullName: userProfile.full_name,
            email: userProfile.email,
            phone: userProfile.phone || '',
            role: userProfile.role,
            profilePicture: userProfile.profile_picture_url || '',
            joinDate: userProfile.created_at
          };
          setUser(userData);
        }
      } else if (event === 'SIGNED_OUT') {
        setGuestUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const setGuestUser = () => {
    const guestUser: User = {
      id: 'guest',
      fullName: 'Guest User',
      email: '',
      role: 'guest'
    };
    setUser(guestUser);
  };

  const handleAuthSuccess = (userData: User) => {
    setUser(userData);
    setAuthModalOpen(false);
  };

  const handleLogout = async () => {
    try {
      console.log('Logging out...');
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('Logout error:', error);
      }
      setGuestUser();
      setProfileModalOpen(false);
      setAdminDashboardOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
      setGuestUser();
    }
  };

  const handleUpdateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const handleOpenLightbox = (index: number) => {
    setCurrentImageIndex(index);
    setLightboxActive(true);
  };

  const handleBookingSuccess = (data: ModalData) => {
    setModalData(data);
    setModalActive(true);
  };

  const handleLoadingComplete = () => {
    setIsLoading(false);
  };

  if (window.location.pathname === '/reset-password') {
    return <ResetPasswordPage />;
  }

  if (isLoading) {
    return <LoadingScreen onLoadingComplete={handleLoadingComplete} />;
  }

  return (
    <div className="App">
      <Navigation 
        onOpenAuth={() => setAuthModalOpen(true)}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenAdmin={() => setAdminDashboardOpen(true)}
        user={user}
      />
      <Hero onOpenAuth={() => setAuthModalOpen(true)} />
      <StatsBar />
      <About />
      <Services />
      <Portfolio onOpenLightbox={handleOpenLightbox} />
      <Contact 
        onSuccess={handleBookingSuccess}
        user={user}
        onShowLogin={() => setAuthModalOpen(true)}
      />
      <Footer />

      <Lightbox
        active={lightboxActive}
        currentIndex={currentImageIndex}
        onClose={() => setLightboxActive(false)}
        onNavigate={setCurrentImageIndex}
        user={user}
      />

      <SuccessModal
        active={modalActive}
        data={modalData}
        onClose={() => setModalActive(false)}
      />

      <Auth
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

      <UserProfile
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
      />

      <AdminDashboard
        isOpen={adminDashboardOpen}
        onClose={() => setAdminDashboardOpen(false)}
        user={user}
      />

      <ScrollToTop />
    </div>
  );
}