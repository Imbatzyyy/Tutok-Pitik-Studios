import { useState, useEffect, useRef } from 'react';
import { X, User, Mail, Calendar, Camera, LogOut, Edit2, Save, Heart, Trash2, Upload, FileText } from 'lucide-react';
import { portfolioImages } from './Portfolio';
import { supabase, projectId } from '../lib/supabase';

interface UserProfileProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onLogout: () => void;
  onUpdateUser: (updatedUser: any) => void;
}

export default function UserProfile({ isOpen, onClose, user, onLogout, onUpdateUser }: UserProfileProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState<'account' | 'favorites' | 'bookings'>('account');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [profilePicture, setProfilePicture] = useState(user?.profilePicture || '');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || ''
  });

  useEffect(() => {
    if (user) {
      setFormData({
        firstName: user.firstName || user.fullName?.split(' ')[0] || '',
        lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
        email: user.email
      });
      setProfilePicture(user.profilePicture || '');

      // Load favorites from Supabase
      const loadFavorites = async () => {
        if (user.id !== 'guest') {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/favorites`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              
              if (response.ok) {
                const { favorites: loadedFavorites } = await response.json();
                setFavorites(loadedFavorites || []);
              }
            }
          } catch (error) {
            console.error('Error loading favorites:', error);
          }
        }
      };

      // Load bookings for customers from Supabase
      const loadBookings = async () => {
        if (user.role === 'customer' && user.id !== 'guest') {
          try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
              const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings`, {
                headers: {
                  'Authorization': `Bearer ${session.access_token}`
                }
              });
              
              if (response.ok) {
                const { bookings: loadedBookings } = await response.json();
                setBookings(loadedBookings || []);
              }
            }
          } catch (error) {
            console.error('Error loading bookings:', error);
          }
        }
      };

      loadFavorites();
      loadBookings();
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const imageUrl = reader.result as string;
        setProfilePicture(imageUrl);
        
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session) return;

          // Update user profile in Supabase
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users/profile`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ profilePicture: imageUrl })
          });

          if (response.ok) {
            const { user: updatedUserData } = await response.json();
            onUpdateUser({ ...user, profilePicture: imageUrl });
          }
        } catch (error) {
          console.error('Error updating profile picture:', error);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const updatedData = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        fullName: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        profilePicture: profilePicture
      };

      // Update user profile in Supabase
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(updatedData)
      });

      if (response.ok) {
        const { user: updatedUserData } = await response.json();
        onUpdateUser({ ...user, ...updatedData });
        setIsEditing(false);

        // Send profile update email notification
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-profile-update-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({
              email: formData.email,
              fullName: `${formData.firstName} ${formData.lastName}`,
              updatedFields: ['Full Name', 'Email Address']
            })
          });
        } catch (emailError) {
          console.error('Email notification error:', emailError);
        }
      }
    } catch (error) {
      console.error('Error updating profile:', error);
    }
  };

  const handleRemoveFavorite = async (imageId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Optimistically update UI
      const updatedFavorites = favorites.filter(id => id !== imageId);
      setFavorites(updatedFavorites);

      // Remove from Supabase
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/favorites/${imageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        // Revert on error
        setFavorites(favorites);
        console.error('Failed to remove favorite');
      }
    } catch (error) {
      // Revert on error
      setFavorites(favorites);
      console.error('Error removing favorite:', error);
    }
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
    return portfolioImages.filter(img => favorites.includes(img.src));
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
            <button className="profile-avatar-upload" onClick={() => fileInputRef.current?.click()}>
              <Camera size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleProfilePictureUpload}
              style={{ display: 'none' }}
            />
          </div>
          <div className="profile-header-text">
            <h2>{user.role === 'customer' && user.username ? `@${user.username}` : user.fullName}</h2>
            <p>{user.email}</p>
          </div>
        </div>

        {/* Tabs */}
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
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="Enter your email"
                    />
                  </div>

                  <button className="btn-cancel" onClick={() => {
                    setIsEditing(false);
                    setFormData({
                      firstName: user.firstName || user.fullName?.split(' ')[0] || '',
                      lastName: user.lastName || user.fullName?.split(' ').slice(1).join(' ') || '',
                      email: user.email
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
                      <img src={image.src} alt={image.title} />
                      <div className="favorite-overlay">
                        <div className="favorite-info">
                          <h4>{image.title}</h4>
                          <p>{image.category}</p>
                        </div>
                        <button 
                          className="favorite-remove"
                          onClick={() => handleRemoveFavorite(image.src)}
                          title="Remove from favorites"
                        >
                          <Trash2 size={18} />
                        </button>
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
                          <span className="booking-label">Total:</span>
                          <span className="booking-value booking-price">{booking.price}</span>
                        </div>
                        <div className="booking-detail-row">
                          <span className="booking-label">Booked on:</span>
                          <span className="booking-value">{new Date(booking.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="profile-actions">
            <button className="btn-logout" onClick={onLogout}>
              <LogOut size={18} />
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}