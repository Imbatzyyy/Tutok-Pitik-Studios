import { useState, useEffect } from 'react';
import Navigation from './components/Navigation';
import Hero from './components/Hero';
import StatsBar from './components/StatsBar';
import About from './components/About';
import Services from './components/Services';
import Portfolio, { portfolioImages as defaultPortfolioImages } from './components/Portfolio';
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
  const [authModalView, setAuthModalView] = useState<'signin' | 'signup' | 'reset'>('signin');
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [adminDashboardOpen, setAdminDashboardOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [portfolioCatalog, setPortfolioCatalog] = useState(defaultPortfolioImages);

  useEffect(() => {
    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=Inter:wght@300;400;500;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }, []);

  const buildUserFromProfile = (userProfile: any, authUser?: any): User => ({
    id: userProfile.id,
    firstName: userProfile.full_name?.split(' ')[0] || '',
    lastName: userProfile.full_name?.split(' ').slice(1).join(' ') || '',
    username: userProfile.username || authUser?.user_metadata?.username || '',
    fullName: userProfile.full_name,
    email: userProfile.email,
    phone: userProfile.phone || authUser?.user_metadata?.phone || '',
    role: userProfile.role,
    profilePicture: userProfile.profile_picture_url || authUser?.user_metadata?.profile_picture_url || '',
    joinDate: userProfile.created_at
  });


  const buildUserFromAuthUser = (authUser: any): User => ({
    id: authUser.id,
    firstName: authUser.user_metadata?.full_name?.split(' ')[0] || '',
    lastName: authUser.user_metadata?.full_name?.split(' ').slice(1).join(' ') || '',
    username: authUser.user_metadata?.username || '',
    fullName: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User',
    email: authUser.email || '',
    phone: authUser.user_metadata?.phone || '',
    role: authUser.user_metadata?.role || 'customer',
    profilePicture: authUser.user_metadata?.profile_picture_url || '',
    joinDate: authUser.created_at || new Date().toISOString(),
  });

  const resolveSessionUser = async (authUser: any) => {
    const userProfile = await fetchUserProfileWithRetry(authUser.id);
    return userProfile ? buildUserFromProfile(userProfile, authUser) : buildUserFromAuthUser(authUser);
  };

  const normalizePortfolioImage = (item: any, index: number) => ({
    id: item.id || `portfolio-${index}`,
    src: item.src || item.image_url || item.url || item.imageData || '',
    url: item.url || item.image_url || item.src || item.imageData || '',
    imageData: item.imageData || item.image_url || item.url || item.src || '',
    category: item.category || 'portrait',
    subCategory: item.subCategory || item.subcategory || 'street',
    title: item.title || `Portfolio Item ${index + 1}`,
    description: item.description || '',
  });

  const loadPortfolioCatalog = async () => {
    try {
      const { data, error } = await supabase
        .from('portfolio_images')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error loading portfolio catalog from Supabase:', error);
        setPortfolioCatalog(defaultPortfolioImages);
        return;
      }

      const items = Array.isArray(data) ? data : [];
      if (items.length === 0) {
        setPortfolioCatalog(defaultPortfolioImages);
        return;
      }

      setPortfolioCatalog(items.map(normalizePortfolioImage));
    } catch (error) {
      console.error('Error loading portfolio catalog:', error);
      setPortfolioCatalog(defaultPortfolioImages);
    }
  };

  const fetchUserProfileWithRetry = async (userId: string, retries = 5, delayMs = 400) => {
    for (let attempt = 0; attempt < retries; attempt += 1) {
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!profileError && userProfile) {
        return userProfile;
      }

      if (attempt < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }

    return null;
  };

  const openAuthModal = (view: 'signin' | 'signup' | 'reset' = 'signin') => {
    setAuthModalView(view);
    setAuthModalOpen(true);
  };

  useEffect(() => {
    loadPortfolioCatalog();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const applyResolvedUser = async (authUser: any) => {
      const resolvedUser = await resolveSessionUser(authUser);
      if (!cancelled) {
        setUser(resolvedUser);
      }
    };

    const initializeAuth = async () => {
      try {
        console.log('Initializing Supabase auth...');

        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('Error getting session:', error);
          if (!cancelled) setGuestUser();
          return;
        }

        if (session?.user) {
          console.log('Active session found, resolving user session...');
          await applyResolvedUser(session.user);
        } else if (!cancelled) {
          console.log('No active session, setting guest user');
          setGuestUser();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        if (!cancelled) setGuestUser();
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event);

      void (async () => {
        if (cancelled) return;

        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') && session?.user) {
          await applyResolvedUser(session.user);
        } else if (event === 'SIGNED_OUT' && !cancelled) {
          setGuestUser();
        }
      })();
    });

    return () => {
      cancelled = true;
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
        onOpenAuth={() => openAuthModal('signin')}
        onOpenProfile={() => setProfileModalOpen(true)}
        onOpenAdmin={() => setAdminDashboardOpen(true)}
        user={user}
      />
      <Hero onOpenAuth={() => openAuthModal('signin')} />
      <StatsBar />
      <About />
      <Services />
      <Portfolio onOpenLightbox={handleOpenLightbox} images={portfolioCatalog} />
      <Contact 
        onSuccess={handleBookingSuccess}
        user={user}
        onShowLogin={() => openAuthModal('signin')}
        onShowSignup={() => openAuthModal('signup')}
      />
      <Footer />

      <Lightbox
        active={lightboxActive}
        currentIndex={currentImageIndex}
        onClose={() => setLightboxActive(false)}
        onNavigate={setCurrentImageIndex}
        user={user}
        images={portfolioCatalog}
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
        defaultView={authModalView}
      />

      <UserProfile
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        user={user}
        onLogout={handleLogout}
        onUpdateUser={handleUpdateUser}
        portfolioImagesCatalog={portfolioCatalog}
      />

      <AdminDashboard
        isOpen={adminDashboardOpen}
        onClose={() => setAdminDashboardOpen(false)}
        user={user}
        onPortfolioUpdated={loadPortfolioCatalog}
      />

      <ScrollToTop />
    </div>
  );
}