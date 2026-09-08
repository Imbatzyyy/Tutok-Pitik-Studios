import { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Calendar, Camera, LogOut, Edit2, Save, Heart, Trash2, FileText, AlertCircle, Download, Link as LinkIcon, Maximize2 } from 'lucide-react';
import { portfolioImages } from './Portfolio';
import { supabase, projectId } from '../lib/supabase';
import { getStoredFavorites, mergeFavorites, saveStoredFavorites } from '../lib/favorites';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
  onUpdateUser: (updatedUser: any) => void;
  portfolioImagesCatalog?: any[];
}

export default function UserProfile({ isOpen, onClose, user, onLogout, onUpdateUser, portfolioImagesCatalog = portfolioImages }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'favorites' | 'bookings'>('account');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const [pendingProfilePicture, setPendingProfilePicture] = useState<string>('');
  const [pendingProfilePictureName, setPendingProfilePictureName] = useState('');
  const [profilePictureError, setProfilePictureError] = useState('');
  const [showProfilePictureConfirm, setShowProfilePictureConfirm] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; name: string } | null>(null);
  const [favoritePreview, setFavoritePreview] = useState<{ url: string; name: string } | null>(null);
  const [isSavingProfilePicture, setIsSavingProfilePicture] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [cropZoom, setCropZoom] = useState(1);
  const [cropImageSize, setCropImageSize] = useState({ width: 320, height: 320 });
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [isDraggingCrop, setIsDraggingCrop] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cropDragRef = useRef({ startX: 0, startY: 0, originX: 0, originY: 0 });
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || ''
  });

  const BOOKING_META_MARKER = '\n\n---BOOKING_META---\n';

  const availablePortfolioImages = portfolioImagesCatalog.length > 0 ? portfolioImagesCatalog : portfolioImages;


  const parseBookingMessage = (message?: string | null) => {
    if (!message || !message.includes(BOOKING_META_MARKER)) {
      return { plainMessage: message || '', meta: {} as Record<string, any> };
    }

    const [plainMessage, rawMeta] = message.split(BOOKING_META_MARKER);
    try {
      return { plainMessage: plainMessage || '', meta: rawMeta ? JSON.parse(rawMeta) : {} };
    } catch {
      return { plainMessage: message || '', meta: {} as Record<string, any> };
    }
  };

  const formatTimeValue = (timeValue?: string | null) => {
    if (!timeValue) return 'TBD';
    const [rawHours = '0', rawMinutes = '00'] = timeValue.split(':');
    const hours = Number(rawHours);
    const minutes = rawMinutes.slice(0, 2);
    const suffix = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes} ${suffix}`;
  };

  const getReceiptNumber = (booking: any) => {
    const createdAt = booking.created_at || booking.createdAt || new Date().toISOString();
    const date = new Date(createdAt);
    const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    return `TPS-${stamp}-${String(booking.id || '').slice(0, 6).toUpperCase()}`;
  };


  const mapProfileToUserSession = (profileRecord: any) => ({
    ...user,
    id: profileRecord.id || user?.id,
    firstName: profileRecord.full_name?.split(' ')[0] || user?.firstName || '',
    lastName: profileRecord.full_name?.split(' ').slice(1).join(' ') || user?.lastName || '',
    username: profileRecord.username || user?.username || '',
    fullName: profileRecord.full_name || user?.fullName || '',
    email: profileRecord.email || user?.email || '',
    phone: profileRecord.phone || user?.phone || '',
    role: profileRecord.role || user?.role,
    profilePicture: profileRecord.profile_picture_url || profileRecord.profilePicture || user?.profilePicture || '',
    joinDate: profileRecord.created_at || user?.joinDate
  });

  const normalizeBooking = (booking: any) => {
    const bookingDate = booking.booking_date || booking.date;
    const start = booking.start_time || booking.startTime;
    const end = booking.end_time || booking.endTime;
    const { plainMessage, meta } = parseBookingMessage(booking.message);
    const total = typeof booking.total_price === 'number'
      ? booking.total_price
      : typeof booking.totalPrice === 'number'
        ? booking.totalPrice
        : parseFloat(String(booking.total_price || booking.totalPrice || booking.price || 0).replace(/[^0-9.-]+/g, '')) || 0;
    const serviceRate = Number(booking.price || 0);
    const durationHours = Number(booking.duration || 0);
    const transportationFee = Number(booking.transportation_fee || booking.transportation || 0);
    const baseSubtotal = serviceRate > 0 && durationHours > 0
      ? serviceRate * durationHours
      : Math.max(total - transportationFee, 0);
    const downpaymentAmount = Number(meta.downpaymentAmount ?? meta.downpayment ?? (baseSubtotal / 2)) || 0;
    const remainingBalance = Number(meta.remainingBalance ?? Math.max(total - downpaymentAmount, 0)) || 0;

    const formattedDate = bookingDate
      ? new Date(`${bookingDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
      : booking.dateDisplay || 'TBD';

    return {
      ...booking,
      message: plainMessage,
      dateDisplay: formattedDate,
      time: booking.time || (start && end ? `${formatTimeValue(start)} - ${formatTimeValue(end)}` : 'TBD'),
      duration: booking.duration ? `${booking.duration} ${Number(booking.duration) === 1 ? 'hour' : 'hours'}` : 'TBD',
      price: `₱${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      numericPrice: total,
      serviceRate,
      baseSubtotal,
      transportationFee,
      downpaymentAmount,
      remainingBalance,
      shootDayBalance: remainingBalance,
      createdAt: booking.createdAt || booking.created_at || new Date().toISOString(),
      status: booking.status || 'pending',
      receiptNumber: getReceiptNumber(booking),
      receiptIssuedAt: meta.completedAt || booking.updated_at || booking.created_at,
      driveLink: meta.driveLink || '',
      photoStatus: meta.photoStatus || (booking.status === 'completed' ? 'editing' : ''),
      paymentMethod: meta.paymentMethod || 'GCash',
      paymentReference: meta.paymentReference || '',
      paymentReceiptUrl: meta.paymentReceiptUrl || '',
      paymentReceiptName: meta.paymentReceiptName || '',
      paymentStatus: meta.paymentStatus || 'submitted',
      paymentSubmittedAt: meta.paymentSubmittedAt || booking.created_at,
    };
  };

  useEffect(() => {
    if (user && isOpen) {
      setFormData({
        firstName: user.firstName || user.fullName?.split(' ')[0] || '',
        lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
        email: user.email,
        phone: user.phone || ''
      });
      setProfilePicture(user.profilePicture || '');

      const loadFavorites = async () => {
        if (user.id === 'guest') {
          setFavorites([]);
          return;
        }

        const localFavorites = getStoredFavorites(user.id);
        setFavorites(localFavorites);

        try {
          const { data: loadedFavorites, error } = await supabase
            .from('favorites')
            .select('image_id')
            .eq('user_id', user.id);

          if (!error) {
            const favoriteIds = (loadedFavorites || []).map((item: any) => item.image_id).filter(Boolean);
            const mergedFavorites = mergeFavorites(localFavorites, favoriteIds);
            setFavorites(mergedFavorites);
            saveStoredFavorites(user.id, mergedFavorites);
          }
        } catch (error) {
          console.error('Error loading favorites:', error);
        }
      };

      const loadBookings = async () => {
        if (user.role === 'customer' && user.id !== 'guest') {
          try {
            const { data: loadedBookings, error } = await supabase
              .from('bookings')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });

            if (error) {
              console.error('Error loading bookings from Supabase:', error);
              setBookings([]);
            } else {
              setBookings((loadedBookings || []).map(normalizeBooking));
            }
          } catch (error) {
            console.error('Error loading bookings:', error);
          }
        }
      };

      loadFavorites();
      loadBookings();
    }
  }, [user, isOpen, activeTab]);

  if (!isOpen || !user) return null;

  const CROP_PREVIEW_SIZE = 320;
  const CROP_OUTPUT_SIZE = 500;

  const clampCropPosition = (nextX: number, nextY: number, nextZoom = cropZoom) => {
    const renderedWidth = cropImageSize.width * nextZoom;
    const renderedHeight = cropImageSize.height * nextZoom;

    const minX = Math.min(0, CROP_PREVIEW_SIZE - renderedWidth);
    const minY = Math.min(0, CROP_PREVIEW_SIZE - renderedHeight);
    const maxX = Math.max(0, CROP_PREVIEW_SIZE - renderedWidth);
    const maxY = Math.max(0, CROP_PREVIEW_SIZE - renderedHeight);

    return {
      x: Math.min(maxX, Math.max(minX, nextX)),
      y: Math.min(maxY, Math.max(minY, nextY)),
    };
  };

  const resetPendingProfilePicture = () => {
    setPendingProfilePicture('');
    setPendingProfilePictureName('');
    setProfilePictureError('');
    setShowProfilePictureConfirm(false);
    setIsSavingProfilePicture(false);
    setCropZoom(1);
    setCropImageSize({ width: CROP_PREVIEW_SIZE, height: CROP_PREVIEW_SIZE });
    setCropPosition({ x: 0, y: 0 });
    setIsDraggingCrop(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const prepareCropImage = async (imageSrc: string) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });

    const baseScale = Math.max(CROP_PREVIEW_SIZE / image.width, CROP_PREVIEW_SIZE / image.height);
    const width = image.width * baseScale;
    const height = image.height * baseScale;

    setCropImageSize({ width, height });
    setCropZoom(1);
    setCropPosition({
      x: (CROP_PREVIEW_SIZE - width) / 2,
      y: (CROP_PREVIEW_SIZE - height) / 2,
    });
  };

  const createCroppedProfilePicture = async (imageSrc: string) => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc;
    });

    const canvas = document.createElement('canvas');
    canvas.width = CROP_OUTPUT_SIZE;
    canvas.height = CROP_OUTPUT_SIZE;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to prepare image cropper');
    }

    const scaleRatio = CROP_OUTPUT_SIZE / CROP_PREVIEW_SIZE;
    const drawWidth = cropImageSize.width * cropZoom * scaleRatio;
    const drawHeight = cropImageSize.height * cropZoom * scaleRatio;
    const drawX = cropPosition.x * scaleRatio;
    const drawY = cropPosition.y * scaleRatio;

    context.clearRect(0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
    context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

    return canvas.toDataURL('image/png');
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setProfilePictureError('Profile picture must be 5 MB or smaller.');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setProfilePictureError('');
    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      setPendingProfilePicture(imageUrl);
      setPendingProfilePictureName(file.name);
      prepareCropImage(imageUrl).catch((error) => {
        console.error('Error preparing crop image:', error);
      });
      setShowProfilePictureConfirm(true);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirmProfilePictureUpload = async () => {
    if (!pendingProfilePicture || user.id === 'guest') return;

    try {
      setIsSavingProfilePicture(true);
      setProfilePictureError('');
      const croppedProfilePicture = await createCroppedProfilePicture(pendingProfilePicture);
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('Please sign in again before uploading your profile picture.');
      }

      let updatedUserData: any = null;

      try {
        const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users/profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            profilePicture: croppedProfilePicture,
            profile_picture_url: croppedProfilePicture,
          })
        });

        if (response.ok) {
          const payload = await response.json();
          updatedUserData = payload.user || null;
        }
      } catch (routeError) {
        console.error('Profile picture route update failed, trying direct table update:', routeError);
      }

      if (!updatedUserData) {
        const { data, error } = await supabase
          .from('users')
          .update({
            profile_picture_url: croppedProfilePicture,
            updated_at: new Date().toISOString(),
          })
          .eq('id', user.id)
          .select('*')
          .single();

        if (error) {
          throw error;
        }

        updatedUserData = data;
      }

      const nextPicture = updatedUserData?.profile_picture_url || croppedProfilePicture;
      setProfilePicture(nextPicture);
      onUpdateUser(mapProfileToUserSession(updatedUserData || { ...user, profile_picture_url: nextPicture }));
      resetPendingProfilePicture();
    } catch (error) {
      console.error('Error updating profile picture:', error);
      setProfilePictureError(error instanceof Error ? error.message : 'Unable to upload your profile picture right now.');
      setIsSavingProfilePicture(false);
    }
  };

  const handleCropPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pendingProfilePicture) return;
    setIsDraggingCrop(true);
    cropDragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: cropPosition.x,
      originY: cropPosition.y,
    };
  };

  const handleCropPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingCrop) return;

    const deltaX = event.clientX - cropDragRef.current.startX;
    const deltaY = event.clientY - cropDragRef.current.startY;
    const next = clampCropPosition(cropDragRef.current.originX + deltaX, cropDragRef.current.originY + deltaY);
    setCropPosition(next);
  };

  const handleCropPointerUp = () => {
    setIsDraggingCrop(false);
  };

  const handleCropZoomChange = (nextZoom: number) => {
    setCropZoom(nextZoom);
    setCropPosition((current) => clampCropPosition(current.x, current.y, nextZoom));
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const updatedData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`.trim(),
        phone: formData.phone,
        profilePicture: profilePicture
      };

      const { data: updatedUserData, error } = await supabase
        .from('users')
        .update({
          full_name: updatedData.fullName,
          phone: updatedData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      try {
        await supabase.auth.updateUser({
          data: {
            full_name: updatedData.fullName,
            phone: updatedData.phone,
            username: user.username || '',
            profile_picture_url: user.profilePicture || '',
            role: user.role,
          },
        });
      } catch (authUpdateError) {
        console.error('Auth metadata update error:', authUpdateError);
      }

      onUpdateUser({
        ...mapProfileToUserSession(updatedUserData || updatedData),
      });
      setIsEditing(false);

      try {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-profile-update-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            fullName: updatedData.fullName,
            updatedFields: ['Full Name', 'Mobile Number']
          })
        });
      } catch (emailError) {
        console.error('Email notification error:', emailError);
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert(error instanceof Error ? error.message : 'Failed to save account information.');
    }
  };

  const handleRemoveFavorite = async (imageId: string) => {
    try {
      const updatedFavorites = favorites.filter(id => id !== imageId);
      setFavorites(updatedFavorites);
      saveStoredFavorites(user.id, updatedFavorites);

      if (typeof imageId === 'string' && !String(imageId).startsWith('default-')) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('image_id', imageId);

        if (error) {
          console.error('Failed to remove favorite in Supabase, but local state was updated.', error);
        }
      }
    } catch (error) {
      console.error('Error removing favorite in backend:', error);
    }
  };

  const downloadBookingReceipt = (booking: any) => {
    const doc = new jsPDF();
    const durationHours = Number(String(booking.duration || 0).replace(/[^0-9.]/g, '')) || 0;
    const transportationFee = Number(booking.transportationFee || booking.transportation_fee || 0);
    const total = Number(booking.totalAmount || booking.numericPrice || booking.total_price || booking.totalPrice || 0);
    const storedServiceRate = Number(booking.serviceRate || booking.price || 0);
    const derivedSubtotal = Math.max(total - transportationFee, 0);
    const subtotal = storedServiceRate > 0 && durationHours > 0
      ? storedServiceRate * durationHours
      : derivedSubtotal;
    const serviceRate = durationHours > 0 ? subtotal / durationHours : subtotal;
    const downpaymentAmount = Number(booking.downpaymentAmount || 0);
    const balanceOnShoot = Number(booking.remainingBalance || Math.max(total - downpaymentAmount, 0));

    doc.setFontSize(20);
    doc.setTextColor(230, 57, 70);
    doc.text('Tutok Pitik Studios', 14, 22);
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Official Booking Receipt', 14, 32);
    doc.setFontSize(10);
    doc.text(`Receipt No: ${booking.receiptNumber}`, 14, 40);
    doc.text(`Issued: ${new Date(booking.receiptIssuedAt || new Date().toISOString()).toLocaleString()}`, 14, 46);

    autoTable(doc, {
      startY: 56,
      head: [['Field', 'Details']],
      body: [
        ['Customer', user.fullName || 'N/A'],
        ['Email', user.email || 'N/A'],
        ['Service', booking.service || 'N/A'],
        ['Date', booking.dateDisplay || 'N/A'],
        ['Time', booking.time || 'N/A'],
        ['Status', String(booking.status || 'completed').toUpperCase()],
        ['Photo Delivery', booking.photoStatus ? String(booking.photoStatus).toUpperCase() : 'N/A'],
        ['Google Drive', booking.driveLink || 'Not provided yet'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [230, 57, 70], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10 },
    });

    autoTable(doc, {
      startY: (doc as any).lastAutoTable.finalY + 10,
      head: [['Computation', 'Amount']],
      body: [
        [`Service Rate (${durationHours || 0} hr${durationHours === 1 ? '' : 's'})`, `PHP ${serviceRate.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Session Subtotal', `PHP ${subtotal.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Transportation', `PHP ${transportationFee.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Confirmed Total', `PHP ${total.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Downpayment Received', `PHP ${downpaymentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
        ['Balance Due on Shoot Day', `PHP ${balanceOnShoot.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`],
      ],
      theme: 'grid',
      headStyles: { fillColor: [30, 30, 30], textColor: 255, fontStyle: 'bold' },
      bodyStyles: { fontSize: 10 },
      styles: { halign: 'left' },
      columnStyles: { 1: { halign: 'right' } },
    });

    doc.save(`${booking.receiptNumber}.pdf`);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getFavoriteImages = () => {
    return favorites
      .map((favoriteId) => {
        const directMatch = availablePortfolioImages.find((img) =>
          [img.id, img.src, img.url, img.imageData].filter(Boolean).includes(favoriteId)
        );

        if (directMatch) {
          return { ...directMatch, favoriteToken: favoriteId };
        }

        const legacyMatch = portfolioImages.find((img) =>
          [img.id, img.src].filter(Boolean).includes(favoriteId)
        );

        if (!legacyMatch) {
          return null;
        }

        const resolvedLiveMatch = availablePortfolioImages.find((img) =>
          img.title === legacyMatch.title ||
          [img.src, img.url, img.imageData].filter(Boolean).includes(legacyMatch.src)
        );

        if (resolvedLiveMatch) {
          return { ...resolvedLiveMatch, favoriteToken: favoriteId };
        }

        return {
          ...legacyMatch,
          url: legacyMatch.src,
          imageData: legacyMatch.src,
          favoriteToken: favoriteId,
        };
      })
      .filter(Boolean);
  };

  const favoriteImages = getFavoriteImages();

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-modal" onClick={(e) => e.stopPropagation()}>
        <button className="profile-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="profile-header">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar">
              {profilePicture ? (
                <img src={profilePicture} alt="Profile" />
              ) : (
                <span>{getInitials(user.fullName)}</span>
              )}
            </div>
            <button className="profile-avatar-upload" type="button" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              style={{ display: 'none' }}
            />
            {profilePictureError && <p className="profile-upload-error">{profilePictureError}</p>}
          </div>
          <div className="profile-header-text">
            <h2>{user.role === 'customer' && user.username ? `@${user.username}` : user.fullName}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        
        <div className="profile-tabs">
          <button 
            className={`profile-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            <User size={18} />
            Account
          </button>
          {user.role === 'customer' && (
            <button 
              className={`profile-tab ${activeTab === 'favorites' ? 'active' : ''}`}
              onClick={() => setActiveTab('favorites')}
            >
              <Heart size={18} />
              Favorites
              {favorites.length > 0 && <span className="tab-badge">{favorites.length}</span>}
            </button>
          )}
          {user.role === 'customer' && (
            <button 
              className={`profile-tab ${activeTab === 'bookings' ? 'active' : ''}`}
              onClick={() => setActiveTab('bookings')}
            >
              <FileText size={18} />
              Bookings
              {bookings.length > 0 && <span className="tab-badge">{bookings.length}</span>}
            </button>
          )}
        </div>

        <div className="profile-content">
          {activeTab === 'account' && (
            <div className="profile-section">
              <div className="profile-section-header">
                <h3>Account Information</h3>
                {!isEditing ? (
                  <button className="btn-edit" onClick={() => setIsEditing(true)}>
                    <Edit2 size={18} />
                    Edit
                  </button>
                ) : (
                  <button className="btn-save" onClick={handleSave}>
                    <Save size={18} />
                    Save
                  </button>
                )}
              </div>
              
              {!isEditing ? (
                <div className="profile-info">
                  <div className="profile-info-item">
                    <div className="profile-info-icon">
                      <User size={20} />
                    </div>
                    <div>
                      <label>Full Name</label>
                      <p>{user.fullName}</p>
                    </div>
                  </div>

                  <div className="profile-info-item">
                    <div className="profile-info-icon">
                      <Mail size={20} />
                    </div>
                    <div>
                      <label>Email Address</label>
                      <p>{user.email}</p>
                    </div>
                  </div>

                  {user.role === 'customer' && user.username && (
                    <div className="profile-info-item">
                      <div className="profile-info-icon">
                        <User size={20} />
                      </div>
                      <div>
                        <label>Username</label>
                        <p>@{user.username}</p>
                      </div>
                    </div>
                  )}

                  {user.role === 'customer' && (
                    <div className="profile-info-item">
                      <div className="profile-info-icon">
                        <Mail size={20} />
                      </div>
                      <div>
                        <label>Mobile Number</label>
                        <p>
                          {user.phone || 'Add your mobile number before booking.'}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="profile-info-item">
                    <div className="profile-info-icon">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <label>Member Since</label>
                      <p>{formatDate(user.joinDate)}</p>
                    </div>
                  </div>

                  {['superadmin', 'admin', 'staff'].includes(user.role) && (
                    <div className="profile-info-item">
                      <div className="profile-info-icon">
                        <Camera size={20} />
                      </div>
                      <div>
                        <label>Account Type</label>
                        <p className="role-badge-inline">{user.role}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="profile-edit-form">
                  <div className="form-group">
                    <label htmlFor="editFirstName">
                      <User size={18} />
                      First Name
                    </label>
                    <input
                      type="text"
                      id="editFirstName"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      placeholder="Enter your first name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="editLastName">
                      <User size={18} />
                      Last Name
                    </label>
                    <input
                      type="text"
                      id="editLastName"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      placeholder="Enter your last name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="editEmail">
                      <Mail size={18} />
                      Email Address
                    </label>
                    <input
                      type="email"
                      id="editEmail"
                      value={formData.email}
                      readOnly
                      disabled
                      placeholder="Enter your email"
                    />
                  </div>

                  {user.role === 'customer' && (
                    <div className="form-group">
                      <label htmlFor="editPhone">
                        <Mail size={18} />
                        Mobile Number
                      </label>
                      <input
                        type="tel"
                        id="editPhone"
                        value={formData.phone}
                        onChange={(e) => {
                          setFormData({ ...formData, phone: e.target.value });
                        }}
                        placeholder="Enter your mobile number"
                      />
                    </div>
                  )}

                  <button className="btn-cancel" onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      firstName: user.firstName || user.fullName?.split(' ')[0] || '',
                      lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
                      email: user.email,
                      phone: user.phone || ''
                    });
                  }}>
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'favorites' && (
            <div className="profile-section">
              <h3>Your Favorite Images</h3>
              
              {favoriteImages.length === 0 ? (
                <div className="empty-favorites">
                  <Heart size={48} />
                  <h4>No favorites yet</h4>
                  <p>Browse our portfolio and click the heart icon to save your favorite images here.</p>
                </div>
              ) : (
                <div className="favorites-grid">
                  {favoriteImages.map((image, index) => (
                    <div key={index} className="favorite-item">
                      <img src={image.src || image.url || image.imageData} alt={image.title} />
                      <div className="favorite-overlay">
                        <div className="favorite-info">
                          <h4>{image.title}</h4>
                          <p>{image.category}</p>
                        </div>
                        <div className="favorite-actions">
                          <button
                            type="button"
                            className="favorite-expand"
                            onClick={() => setFavoritePreview({
                              url: image.src || image.url || image.imageData,
                              name: image.title,
                            })}
                            title="View full image"
                          >
                            <Maximize2 size={18} />
                          </button>
                          <button 
                            className="favorite-remove"
                            onClick={() => handleRemoveFavorite((image as any).favoriteToken || image.id)}
                            title="Remove from favorites"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'bookings' && user.role === 'customer' && (
            <div className="profile-section">
              <h3>Your Bookings</h3>
              
              {bookings.length === 0 ? (
                <div className="empty-favorites">
                  <FileText size={48} />
                  <h4>No bookings yet</h4>
                  <p>Book a photography session to see your bookings here.</p>
                </div>
              ) : (
                <div className="bookings-list">
                  {bookings.map((booking, index) => (
                    <div key={index} className="booking-card">
                      <div className="booking-header">
                        <h4>{booking.service}</h4>
                        <span className={`booking-status ${booking.status}`}>
                          {booking.status === 'pending' && 'Pending'}
                          {booking.status === 'confirmed' && 'Confirmed'}
                          {booking.status === 'completed' && 'Completed'}
                          {booking.status === 'cancelled' && 'Cancelled'}
                        </span>
                      </div>
                      <div className="booking-details">
                        <div className="booking-detail-row">
                          <span className="booking-label">Date:</span>
                          <span className="booking-value">{booking.dateDisplay}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Time:</span>
                          <span className="booking-value">{booking.time}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Duration:</span>
                          <span className="booking-value">{booking.duration}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Confirmed Total:</span>
                          <span className="booking-value booking-price">{booking.price}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Transportation:</span>
                          <span className="booking-value">{booking.transportationFee > 0 ? `PHP ${Number(booking.transportationFee || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Pending admin review'}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Downpayment Paid:</span>
                          <span className="booking-value">PHP {Number(booking.downpaymentAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Balance on Shoot Day:</span>
                          <span className="booking-value booking-price">PHP {Number(booking.remainingBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Booked on:</span>
                          <span className="booking-value">{new Date(booking.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Payment:</span>
                          <span className="booking-value">{booking.paymentStatus ? booking.paymentStatus.replace(/(^|\s)\S/g, (value: string) => value.toUpperCase()) : 'Submitted'}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Reference:</span>
                          <span className="booking-value">{booking.paymentReference || 'Waiting for customer upload'}</span>
                        </div>
                        {booking.paymentReceiptUrl && (
                          <div className="booking-detail-row booking-detail-column-card">
                            <span className="booking-label">Uploaded Receipt:</span>
                            <div className="payment-receipt-preview-card payment-receipt-preview-card-profile">
                              <img src={booking.paymentReceiptUrl} alt={booking.paymentReceiptName || 'Uploaded payment receipt'} className="payment-receipt-preview-image" />
                              <button
                                type="button"
                                className="booking-drive-link booking-drive-link-button"
                                onClick={() => setReceiptPreview({
                                  url: booking.paymentReceiptUrl,
                                  name: booking.paymentReceiptName || 'Uploaded payment receipt',
                                })}
                              >
                                <LinkIcon size={16} />
                                View Uploaded Receipt
                              </button>
                            </div>
                          </div>
                        )}
                        {(booking.status === 'cancelled' || booking.paymentStatus === 'rejected') && (
                          <div className="booking-rejection-note">
                            <strong>Booking Update:</strong> This booking was not approved. Please submit a new booking request once your payment details are corrected.
                          </div>
                        )}
                        {booking.status === 'completed' && (
                          <>
                            <div className="booking-detail-row">
                              <span className="booking-label">Receipt:</span>
                              <span className="booking-value">{booking.receiptNumber}</span>
                            </div>
                            <div className="booking-detail-row">
                              <span className="booking-label">Photo Status:</span>
                              <span className="booking-value">{booking.photoStatus ? booking.photoStatus.replace(/(^|\s)\S/g, (value: string) => value.toUpperCase()) : 'Editing'}</span>
                            </div>
                            <div className="booking-detail-row booking-detail-column-card">
                              <span className="booking-label">Google Drive:</span>
                              {booking.driveLink ? (
                                <a href={booking.driveLink} target="_blank" rel="noreferrer" className="booking-drive-link">
                                  <LinkIcon size={16} />
                                  Open Photo Folder
                                </a>
                              ) : (
                                <span className="booking-value">Will appear here once your photos are ready.</span>
                              )}
                            </div>
                            <button className="btn-export-pdf booking-receipt-btn" onClick={() => downloadBookingReceipt(booking)}>
                              <Download size={16} />
                              Download Receipt
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="profile-actions">
            <button className="btn-logout" onClick={() => setShowLogoutConfirm(true)}>
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {showLogoutConfirm && (
        <div className="modal-overlay active" onClick={() => setShowLogoutConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <AlertCircle size={48} />
            </div>
            <h3>Confirm Logout</h3>
            <p>Are you sure you want to sign out of your Tutok Pitik Studios account?</p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setShowLogoutConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn-confirm"
                onClick={() => {
                  setShowLogoutConfirm(false);
                  onLogout();
                }}
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {favoritePreview && (
        <div className="modal-overlay active" onClick={() => setFavoritePreview(null)}>
          <div className="receipt-preview-modal favorite-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setFavoritePreview(null)}>
              <X size={24} />
            </button>
            <h3>Favorite Image</h3>
            <div className="receipt-preview-frame favorite-preview-frame">
              <img src={favoritePreview.url} alt={favoritePreview.name} className="receipt-preview-modal-image favorite-preview-image" />
            </div>
            <p className="receipt-preview-caption">{favoritePreview.name}</p>
          </div>
        </div>
      )}

      {receiptPreview && (
        <div className="modal-overlay active" onClick={() => setReceiptPreview(null)}>
          <div className="receipt-preview-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setReceiptPreview(null)}>
              <X size={24} />
            </button>
            <h3>Uploaded Receipt</h3>
            <div className="receipt-preview-frame">
              <img src={receiptPreview.url} alt={receiptPreview.name} className="receipt-preview-modal-image" />
            </div>
            <p className="receipt-preview-caption">{receiptPreview.name}</p>
          </div>
        </div>
      )}

      {showProfilePictureConfirm && (
        <div className="modal-overlay active" onClick={resetPendingProfilePicture}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <AlertCircle size={48} />
            </div>
            <h3>Confirm Profile Picture</h3>
            <p>Please confirm that you want to upload this profile picture to your account.</p>
            <div className="confirm-details">
              <div className="confirm-profile-preview">
                <div
                  className={`confirm-profile-crop-frame ${isDraggingCrop ? 'dragging' : ''}`}
                  onPointerDown={handleCropPointerDown}
                  onPointerMove={handleCropPointerMove}
                  onPointerUp={handleCropPointerUp}
                  onPointerLeave={handleCropPointerUp}
                >
                  <img
                    src={pendingProfilePicture}
                    alt={pendingProfilePictureName || 'Profile preview'}
                    className="confirm-profile-preview-img"
                    draggable={false}
                    style={{
                      width: `${cropImageSize.width * cropZoom}px`,
                      height: `${cropImageSize.height * cropZoom}px`,
                      transform: `translate(${cropPosition.x}px, ${cropPosition.y}px)`,
                    }}
                  />
                </div>
              </div>
              <p className="confirm-profile-crop-hint">Drag the image to frame it inside the 500 x 500 crop.</p>
              <div className="confirm-profile-crop-controls">
                <label>Zoom
                  <input type="range" min="1" max="2.5" step="0.05" value={cropZoom} onChange={(e) => handleCropZoomChange(Number(e.target.value))} />
                </label>
              </div>
              <p><strong>File:</strong> {pendingProfilePictureName || 'Selected image'}</p>
              <p><strong>Account:</strong> {user.email}</p>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" type="button" onClick={resetPendingProfilePicture}>
                Cancel
              </button>
              <button className="confirm-btn-proceed" type="button" onClick={handleConfirmProfilePictureUpload} disabled={isSavingProfilePicture}>
                {isSavingProfilePicture ? 'Saving...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}