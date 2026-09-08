import { useState, useEffect } from 'react';
import { X, Users, Calendar, Image, Plus, Edit2, Trash2, Shield, Check, Clock, XCircle, Eye, BarChart3, Download, TrendingUp, Activity, FileDown, Link as LinkIcon, Save } from 'lucide-react';
import { supabase, projectId } from '../lib/supabase';
import { portfolioImages } from './Portfolio';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface AdminDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
  onPortfolioUpdated?: () => Promise<void> | void;
}

export default function AdminDashboard({ isOpen, onClose, user, onPortfolioUpdated }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState('statistics');
  const [users, setUsers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [portfolioItems, setPortfolioItems] = useState<any[]>([]);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [viewingBooking, setViewingBooking] = useState<any>(null);
  const [showBookingSaveConfirm, setShowBookingSaveConfirm] = useState(false);
  const [showPortfolioUpdateConfirm, setShowPortfolioUpdateConfirm] = useState(false);
  const [receiptPreview, setReceiptPreview] = useState<{ url: string; name: string } | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [sendingUserResetId, setSendingUserResetId] = useState<string | null>(null);

  const BOOKING_META_MARKER = '\n\n---BOOKING_META---\n';

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

  const buildBookingMessage = (plainMessage: string, meta: Record<string, any>) => {
    const sanitizedMessage = (plainMessage || '').trim();
    const hasMeta = Object.values(meta).some((value) => value !== undefined && value !== null && value !== '');

    if (!hasMeta) {
      return sanitizedMessage;
    }

    return `${sanitizedMessage}${BOOKING_META_MARKER}${JSON.stringify(meta)}`;
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

  const normalizeUser = (record: any) => ({
    ...record,
    fullName: record.fullName || record.full_name || [record.firstName, record.lastName].filter(Boolean).join(' ').trim() || 'Unknown User',
    joinDate: record.joinDate || record.created_at || new Date().toISOString(),
    profilePicture: record.profilePicture || record.profile_picture_url || '',
    status: record.status || 'active',
  });

  const buildDefaultPortfolioItems = () => portfolioImages.map((image, index) => ({
    id: `default-${index}`,
    url: image.src,
    title: image.title,
    category: image.category,
    subcategory: image.subCategory,
    createdAt: new Date(2025, 0, index + 1).toISOString(),
    isSeededDefault: true,
  }));

  const normalizePortfolioItem = (item: any) => ({
    ...item,
    imageData: item.imageData || item.image_url || item.url || '',
    url: item.url || item.image_url || item.imageData || '',
    subCategory: item.subCategory || item.subcategory || '',
    subcategory: item.subcategory || item.subCategory || '',
  });

  const normalizeBooking = (record: any) => {
    const fullName = record.fullName || record.full_name || [record.firstName, record.lastName].filter(Boolean).join(' ').trim() || 'N/A';
    const bookingDate = record.booking_date || record.date || 'N/A';
    const { plainMessage, meta } = parseBookingMessage(record.message);
    const start = record.start_time || record.startTime;
    const end = record.end_time || record.endTime;
    const time = record.time || (start && end ? `${formatTimeValue(start)} - ${formatTimeValue(end)}` : 'TBD');
    const numericPrice = typeof record.total_price === 'number'
      ? record.total_price
      : typeof record.totalPrice === 'number'
        ? record.totalPrice
        : typeof record.price === 'number'
          ? record.price
          : parseFloat(String(record.total_price || record.totalPrice || record.price || 0).replace(/[^0-9.-]+/g, '')) || 0;
    const serviceRate = Number(record.price || 0);
    const durationHours = Number(record.duration || 0);
    const transportationFee = Number(record.transportation_fee || record.transportation || 0);
    const baseSubtotal = serviceRate > 0 && durationHours > 0
      ? serviceRate * durationHours
      : Math.max(numericPrice - transportationFee, 0);
    const downpaymentAmount = Number(meta.downpaymentAmount ?? meta.downpayment ?? (baseSubtotal / 2)) || 0;
    const remainingBalance = Number(meta.remainingBalance ?? Math.max(numericPrice - downpaymentAmount, 0)) || 0;

    return {
      ...record,
      fullName,
      date: bookingDate,
      dateDisplay: bookingDate && bookingDate !== 'N/A'
        ? new Date(`${bookingDate}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
        : 'TBD',
      time,
      durationLabel: record.duration ? `${record.duration} ${Number(record.duration) === 1 ? 'hour' : 'hours'}` : 'TBD',
      price: `₱${numericPrice.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      numericPrice,
      serviceRate,
      baseSubtotal,
      transportationFee,
      totalAmount: numericPrice,
      downpaymentAmount,
      remainingBalance,
      shootDayBalance: remainingBalance,
      status: record.status || 'pending',
      message: plainMessage,
      receiptNumber: meta.receiptNumber || getReceiptNumber(record),
      receiptIssuedAt: meta.completedAt || record.updated_at || record.created_at,
      driveLink: meta.driveLink || '',
      photoStatus: meta.photoStatus || (record.status === 'completed' ? 'editing' : ''),
      paymentMethod: meta.paymentMethod || 'GCash',
      paymentReference: meta.paymentReference || '',
      paymentReceiptUrl: meta.paymentReceiptUrl || '',
      paymentReceiptName: meta.paymentReceiptName || '',
      paymentStatus: meta.paymentStatus || 'pending',
      paymentSubmittedAt: meta.paymentSubmittedAt || record.created_at,
    };
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, user?.role]);

  const loadData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('Admin dashboard could not load because no active session was found.');
        return;
      }

      if (['superadmin', 'admin', 'staff'].includes(user?.role)) {
        const { data: loadedUsers, error: usersError } = await supabase
          .from('users')
          .select('*')
          .order('created_at', { ascending: false });

        if (usersError) {
          console.error('Error loading users from Supabase:', usersError);
          setUsers([]);
        } else {
          setUsers((loadedUsers || []).map(normalizeUser));
        }
      }

      if (['superadmin', 'admin', 'staff'].includes(user?.role)) {
        const { data: loadedBookings, error: bookingsError } = await supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false });

        if (bookingsError) {
          console.error('Error loading bookings from Supabase:', bookingsError);
          setBookings([]);
        } else {
          setBookings((loadedBookings || []).map(normalizeBooking));
        }
      }

      const { data: loadedPortfolio, error: portfolioError } = await supabase
        .from('portfolio_images')
        .select('*')
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (portfolioError) {
        console.error('Error loading portfolio items from Supabase:', portfolioError);
        setPortfolioItems(buildDefaultPortfolioItems());
      } else {
        const remoteItems = loadedPortfolio || [];

        if (remoteItems.length === 0 && canManagePortfolio) {
          try {
            const defaultItems = buildDefaultPortfolioItems();
            const rows = defaultItems.map((item, index) => ({
              title: item.title,
              description: item.description || '',
              category: item.category,
              subcategory: item.subcategory,
              image_url: item.url,
              created_by: user?.id && user.id !== 'guest' ? user.id : null,
              display_order: index,
              is_featured: index < 3,
            }));

            const { data: seededItems, error: seedError } = await supabase
              .from('portfolio_images')
              .insert(rows)
              .select('*');

            if (seedError) {
              console.error('Error seeding default portfolio items:', seedError);
              setPortfolioItems(defaultItems.map(normalizePortfolioItem));
            } else {
              setPortfolioItems((seededItems || defaultItems).map(normalizePortfolioItem));
            }
          } catch (seedError) {
            console.error('Error seeding default portfolio items:', seedError);
            setPortfolioItems(buildDefaultPortfolioItems());
          }
        } else {
          setPortfolioItems((remoteItems.length > 0 ? remoteItems : buildDefaultPortfolioItems()).map(normalizePortfolioItem));
        }
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    }
  };

  const exportBookingsToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(230, 57, 70); // #E63946
    doc.text('Tutok Pitik Studios', 14, 22);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Bookings Report', 14, 32);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 40);
    
    doc.setFontSize(12);
    doc.text('Summary:', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total Bookings: ${bookings.length}`, 14, 57);
    doc.text(`Pending: ${bookings.filter(b => b.status === 'pending').length}`, 14, 63);
    doc.text(`Confirmed: ${bookings.filter(b => b.status === 'confirmed').length}`, 14, 69);
    doc.text(`Completed: ${bookings.filter(b => b.status === 'completed').length}`, 14, 75);
    doc.text(`Cancelled: ${bookings.filter(b => b.status === 'cancelled').length}`, 14, 81);
    
    const tableData = bookings.map(booking => [
      booking.service || 'N/A',
      booking.dateDisplay || booking.date || 'N/A',
      booking.time || 'N/A',
      `${booking.firstName || ''} ${booking.lastName || ''}`.trim() || booking.fullName || 'N/A',
      booking.email || 'N/A',
      booking.location || 'N/A',
      `PHP ${Number(booking.totalAmount || booking.numericPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      (booking.status || 'pending').toUpperCase()
    ]);
    
    autoTable(doc, {
      startY: 90,
      head: [['Service', 'Date', 'Time', 'Customer', 'Email', 'Location', 'Amount', 'Status']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [230, 57, 70], // #E63946
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 9
      },
      bodyStyles: {
        fontSize: 8
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 25 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
        5: { cellWidth: 24 },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 16 }
      }
    });
    
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    doc.save(`Tutok-Pitik-Bookings-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  const exportUsersToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.setTextColor(230, 57, 70);
    doc.text('Tutok Pitik Studios', 14, 22);
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text('Users Report', 14, 32);
    
    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, 14, 40);
    
    doc.setFontSize(12);
    doc.text('Summary:', 14, 50);
    doc.setFontSize(10);
    doc.text(`Total Users: ${users.length}`, 14, 57);
    doc.text(`Super Admins: ${users.filter(u => u.role === 'superadmin').length}`, 14, 63);
    doc.text(`Admins: ${users.filter(u => u.role === 'admin').length}`, 14, 69);
    doc.text(`Staff: ${users.filter(u => u.role === 'staff').length}`, 14, 75);
    doc.text(`Customers: ${users.filter(u => u.role === 'customer').length}`, 14, 81);
    
    const tableData = users.map(user => [
      user.full_name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'N/A',
      user.email || 'N/A',
      user.username || 'N/A',
      (user.role || 'customer').toUpperCase(),
      new Date(user.created_at || user.joinDate).toLocaleDateString()
    ]);
    
    autoTable(doc, {
      startY: 90,
      head: [['Full Name', 'Email', 'Username', 'Role', 'Join Date']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [230, 57, 70],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 10
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      }
    });
    
    const pageCount = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128);
      doc.text(
        `Page ${i} of ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
        { align: 'center' }
      );
    }
    
    doc.save(`Tutok-Pitik-Users-${new Date().toISOString().split('T')[0]}.pdf`);
  };

  if (!isOpen) return null;

  const canManageUsers = user?.role === 'superadmin';
  const canManageBookings = ['superadmin', 'admin', 'staff'].includes(user?.role);
  const canManagePortfolio = ['superadmin', 'admin'].includes(user?.role);
  const canViewStatistics = user?.role === 'superadmin';

  const activeUsers = users.filter(u => u.status !== 'inactive').length;
  const inactiveUsers = users.filter(u => u.status === 'inactive').length;
  const totalBookings = bookings.length;
  const pendingBookings = bookings.filter(b => b.status === 'pending').length;
  const confirmedBookings = bookings.filter(b => b.status === 'confirmed').length;
  const completedBookings = bookings.filter(b => b.status === 'completed').length;
  
  const totalSales = bookings
    .filter(b => b.status === 'completed')
    .reduce((sum, booking) => {
      const price = parseFloat(booking.price?.replace(/[^0-9.-]+/g, '') || '0');
      return sum + price;
    }, 0);

  const handleCreateUser = async () => {
    if (!canManageUsers) return;
    if (!formData.fullName || !formData.email || !formData.password) {
      alert('Please provide full name, email, and password.');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(formData),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to create user');
      }

      await loadData();
      setShowForm(false);
      setFormData({});
    } catch (error) {
      console.error('Error creating user:', error);
      alert(error instanceof Error ? error.message : 'Failed to create user');
    }
  };

  const handleUpdateUser = async (userId: string) => {
    if (!canManageUsers) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(formData)
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Failed to update user');
      }

      await loadData();
      setEditingItem(null);
      setFormData({});
    } catch (error) {
      console.error('Error updating user:', error);
      alert(error instanceof Error ? error.message : 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!canManageUsers) return;
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/users/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (response.ok) {
        await loadData();
      }
    } catch (error) {
      console.error('Error deleting user:', error);
    }
  };

  const handleSendUserResetPassword = async (email?: string) => {
    if (!email) {
      alert('This user does not have an email address saved.');
      return;
    }

    try {
      setSendingUserResetId(email);
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

      if (error) {
        throw error;
      }

      alert(`Password reset email sent to ${email}.`);
    } catch (error) {
      console.error('Error sending reset password email:', error);
      alert(error instanceof Error ? error.message : 'Failed to send password reset email.');
    } finally {
      setSendingUserResetId(null);
    }
  };

  const handleUpdateBookingStatus = async (bookingId: string, status: string) => {
    if (!canManageBookings) return;

    const previousBooking = bookings.find((booking) => booking.id === bookingId);
    const previousMessageData = parseBookingMessage(previousBooking?.message);
    const nextMeta = {
      ...previousMessageData.meta,
      receiptNumber: previousMessageData.meta.receiptNumber || (status === 'completed' ? getReceiptNumber(previousBooking || { id: bookingId }) : previousMessageData.meta.receiptNumber),
      completedAt: status === 'completed' ? (previousMessageData.meta.completedAt || new Date().toISOString()) : previousMessageData.meta.completedAt,
      photoStatus: status === 'completed' ? (previousMessageData.meta.photoStatus || 'editing') : previousMessageData.meta.photoStatus,
    };
    const nextMessage = buildBookingMessage(previousMessageData.plainMessage, nextMeta);

    setBookings((currentBookings) => currentBookings.map((booking) => (
      booking.id === bookingId ? normalizeBooking({ ...booking, status, message: nextMessage }) : booking
    )));

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in again.');
      }

      const { data: updatedBooking, error } = await supabase
        .from('bookings')
        .update({
          status,
          message: nextMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', bookingId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      if (status === 'confirmed' && previousBooking?.status !== 'confirmed') {
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-booking-confirmation-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              booking: updatedBooking || { ...previousBooking, status, message: nextMessage },
            }),
          });
        } catch (emailError) {
          console.error('Booking confirmation email error:', emailError);
        }
      }

      await loadData();
    } catch (error) {
      console.error('Error updating booking status:', error);
      setBookings((currentBookings) => currentBookings.map((booking) => (
        booking.id === bookingId && previousBooking ? normalizeBooking(previousBooking) : booking
      )));
    }
  };

  const persistBookingDetails = async () => {
    if (!viewingBooking) return;

    const currentMessageData = parseBookingMessage(viewingBooking.message);
    const serviceRate = Number(viewingBooking.serviceRate || 0);
    const durationHours = Number(String(viewingBooking.duration || 0).replace(/[^0-9.]/g, '')) || 0;
    const transportationFee = Number(viewingBooking.transportationFee || 0);
    const baseSubtotal = serviceRate * durationHours;
    const totalAmount = baseSubtotal + transportationFee;
    const downpaymentAmount = Number(currentMessageData.meta.downpaymentAmount ?? viewingBooking.downpaymentAmount ?? (baseSubtotal / 2)) || 0;
    const remainingBalance = Math.max(totalAmount - downpaymentAmount, 0);
    const paymentStatus = viewingBooking.paymentStatus || currentMessageData.meta.paymentStatus || 'submitted';
    let nextStatus = viewingBooking.status || 'pending';

    if (paymentStatus === 'verified' && nextStatus === 'pending') {
      nextStatus = 'confirmed';
    }

    const nextMeta = {
      ...currentMessageData.meta,
      receiptNumber: currentMessageData.meta.receiptNumber || (nextStatus === 'completed' ? viewingBooking.receiptNumber : currentMessageData.meta.receiptNumber),
      driveLink: viewingBooking.driveLink || '',
      photoStatus: viewingBooking.photoStatus || (nextStatus === 'completed' ? 'editing' : ''),
      completedAt: nextStatus === 'completed' ? (currentMessageData.meta.completedAt || new Date().toISOString()) : currentMessageData.meta.completedAt,
      paymentMethod: viewingBooking.paymentMethod || currentMessageData.meta.paymentMethod || 'GCash',
      paymentReference: viewingBooking.paymentReference || currentMessageData.meta.paymentReference || '',
      paymentReceiptUrl: viewingBooking.paymentReceiptUrl || currentMessageData.meta.paymentReceiptUrl || '',
      paymentReceiptName: viewingBooking.paymentReceiptName || currentMessageData.meta.paymentReceiptName || '',
      paymentStatus,
      paymentSubmittedAt: viewingBooking.paymentSubmittedAt || currentMessageData.meta.paymentSubmittedAt || new Date().toISOString(),
      downpaymentAmount,
      remainingBalance,
      confirmedTotal: totalAmount,
    };

    const nextMessage = buildBookingMessage(currentMessageData.plainMessage, nextMeta);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Please sign in again.');
      }

      const previousStatus = viewingBooking.status;
      const { data: updatedBooking, error } = await supabase
        .from('bookings')
        .update({
          transportation_fee: transportationFee,
          total_price: totalAmount,
          status: nextStatus,
          message: nextMessage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', viewingBooking.id)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      if (nextStatus === 'confirmed' && previousStatus !== 'confirmed') {
        try {
          await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-booking-confirmation-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              booking: updatedBooking || { ...viewingBooking, transportation_fee: transportationFee, total_price: totalAmount, status: nextStatus, message: nextMessage },
            }),
          });
        } catch (emailError) {
          console.error('Booking confirmation email error:', emailError);
        }
      }

      const nextBooking = updatedBooking || { ...viewingBooking, transportation_fee: transportationFee, total_price: totalAmount, status: nextStatus, message: nextMessage };
      setViewingBooking((current: any) => current ? normalizeBooking({ ...current, ...nextBooking }) : current);
      await loadData();
    } catch (error) {
      console.error('Error saving booking delivery details:', error);
    }
  };

  const handleConfirmSaveBookingDetails = async () => {
    setShowBookingSaveConfirm(false);
    await persistBookingDetails();
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
        ['Customer', booking.fullName || 'N/A'],
        ['Email', booking.email || 'N/A'],
        ['Service', booking.service || 'N/A'],
        ['Date', booking.dateDisplay || booking.date || 'N/A'],
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

  const handleDeleteBooking = async (bookingId: string) => {
    if (!canManageBookings) return;
    if (!confirm('Are you sure you want to delete this booking?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings/${bookingId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });

      if (!response.ok) {
        const payload = await response.json();
        throw new Error(payload.error || 'Failed to delete booking');
      }

      await loadData();
    } catch (error) {
      console.error('Error deleting booking:', error);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        setFormData({ ...formData, imageData: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCreatePortfolioItem = async () => {
    if (!canManagePortfolio) return;
    if (!formData.imageData || !formData.title || !formData.category || !formData.subCategory) {
      alert('Please fill all required fields and upload an image');
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const newItem = {
        url: formData.imageData,
        title: formData.title,
        category: formData.category,
        subcategory: formData.subCategory
      };

      const { error } = await supabase
        .from('portfolio_images')
        .insert({
          title: newItem.title,
          description: formData.description || '',
          category: newItem.category,
          subcategory: newItem.subcategory,
          image_url: newItem.url,
          created_by: user?.id && user.id !== 'guest' ? user.id : null,
          display_order: portfolioItems.length,
          is_featured: false,
        });

      if (error) {
        console.error('Error creating portfolio item:', error);
        return;
      }

      await loadData();
      await onPortfolioUpdated?.();
      setShowForm(false);
      setFormData({});
      setImagePreview('');
    } catch (error) {
      console.error('Error creating portfolio item:', error);
    }
  };

  const handleUpdatePortfolioItem = async (itemId: string) => {
    if (!canManagePortfolio) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      let updatedItem: any = null;

      if (String(itemId).startsWith('default-')) {
        const { data: insertedItem, error: insertError } = await supabase
          .from('portfolio_images')
          .insert({
            title: formData.title,
            description: formData.description || '',
            category: formData.category,
            subcategory: formData.subCategory || formData.subcategory,
            image_url: formData.imageData || formData.url || imagePreview,
            created_by: user?.id && user.id !== 'guest' ? user.id : null,
            display_order: portfolioItems.findIndex((item) => item.id === itemId),
            is_featured: false,
          })
          .select('*')
          .single();

        if (insertError) {
          console.error('Portfolio create fallback failed:', insertError);
          return;
        }

        updatedItem = insertedItem;
      } else {
        const { data: savedItem, error: updateError } = await supabase
          .from('portfolio_images')
          .update({
            title: formData.title,
            description: formData.description || '',
            category: formData.category,
            subcategory: formData.subCategory || formData.subcategory,
            image_url: formData.imageData || formData.url || imagePreview,
            updated_at: new Date().toISOString(),
          })
          .eq('id', itemId)
          .select('*')
          .single();

        if (updateError) {
          console.error('Portfolio update failed:', updateError);
          return;
        }

        updatedItem = savedItem;
      }

      const normalizedItem = normalizePortfolioItem(updatedItem || {
        ...editingItem,
        ...formData,
        url: formData.imageData || formData.url || imagePreview,
        imageData: formData.imageData || formData.url || imagePreview,
      });

      setPortfolioItems((current) => {
        const existingIndex = current.findIndex((item) => item.id === itemId);
        if (existingIndex >= 0) {
          const next = [...current];
          next[existingIndex] = normalizedItem;
          return next;
        }
        return [normalizedItem, ...current];
      });
      await loadData();
      await onPortfolioUpdated?.();
      setShowForm(false);
      setEditingItem(null);
      setFormData({});
      setImagePreview('');
    } catch (error) {
      console.error('Error updating portfolio item:', error);
    }
  };

  const handleConfirmPortfolioUpdate = async () => {
    if (!editingItem?.id) return;
    setShowPortfolioUpdateConfirm(false);
    await handleUpdatePortfolioItem(editingItem.id);
  };

  const handleDeletePortfolioItem = async (itemId: string) => {
    if (!canManagePortfolio) return;
    if (!confirm('Are you sure you want to delete this portfolio item?')) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      if (String(itemId).startsWith('default-')) {
        setPortfolioItems(portfolioItems.filter(item => item.id !== itemId));
        return;
      }

      const { error } = await supabase
        .from('portfolio_images')
        .delete()
        .eq('id', itemId);

      if (error) {
        console.error('Error deleting portfolio item:', error);
        return;
      }

      setPortfolioItems(portfolioItems.filter(item => item.id !== itemId));
      await onPortfolioUpdated?.();
    } catch (error) {
      console.error('Error deleting portfolio item:', error);
    }
  };

  const generateReport = () => {
    const reportData = {
      generatedAt: new Date().toLocaleString(),
      generatedBy: user.email,
      statistics: {
        users: {
          total: users.length,
          active: activeUsers,
          inactive: inactiveUsers,
          byRole: {
            superadmin: users.filter(u => u.role === 'superadmin').length,
            admin: users.filter(u => u.role === 'admin').length,
            staff: users.filter(u => u.role === 'staff').length,
            customer: users.filter(u => u.role === 'customer').length,
            guest: users.filter(u => u.role === 'guest').length
          }
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          completed: completedBookings,
          cancelled: bookings.filter(b => b.status === 'cancelled').length
        },
        sales: {
          total: totalSales,
          averagePerBooking: totalBookings > 0 ? (totalSales / completedBookings || 0) : 0,
          currency: 'PHP'
        },
        portfolio: {
          totalItems: portfolioItems.length
        }
      },
      recentBookings: bookings.slice(0, 10),
      recentUsers: users.slice(-10)
    };

    const reportHTML = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tutok Pitik Studios - System Report</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
            padding: 40px 20px;
            color: #333;
        }
        .report-container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .report-header {
            background: linear-gradient(135deg, #E63946 0%, #c62e3a 100%);
            color: white;
            padding: 40px;
            text-align: center;
        }
        .report-header h1 {
            font-size: 32px;
            font-weight: 800;
            margin-bottom: 10px;
            letter-spacing: -0.5px;
        }
        .report-header p {
            font-size: 14px;
            opacity: 0.9;
        }
        .report-meta {
            background: #f8f9fa;
            padding: 20px 40px;
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            border-bottom: 2px solid #e9ecef;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-label {
            font-size: 12px;
            color: #6c757d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
        }
        .meta-value {
            font-size: 16px;
            color: #212529;
            font-weight: 600;
        }
        .report-content {
            padding: 40px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section-title {
            font-size: 24px;
            font-weight: 700;
            color: #212529;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 3px solid #E63946;
            display: inline-block;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 24px;
            border-radius: 12px;
            border-left: 4px solid #E63946;
            transition: transform 0.2s;
        }
        .stat-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 8px 16px rgba(0,0,0,0.1);
        }
        .stat-label {
            font-size: 14px;
            color: #6c757d;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        .stat-value {
            font-size: 36px;
            font-weight: 800;
            color: #E63946;
            line-height: 1;
        }
        .stat-subtext {
            font-size: 12px;
            color: #6c757d;
            margin-top: 8px;
        }
        .table-container {
            overflow-x: auto;
            border-radius: 8px;
            border: 1px solid #dee2e6;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            background: white;
        }
        thead {
            background: #212529;
            color: white;
        }
        th {
            padding: 16px;
            text-align: left;
            font-weight: 600;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        td {
            padding: 14px 16px;
            border-bottom: 1px solid #dee2e6;
            font-size: 14px;
        }
        tbody tr:hover {
            background: #f8f9fa;
        }
        .badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        .badge-success { background: #28a745; color: white; }
        .badge-warning { background: #ffc107; color: #212529; }
        .badge-danger { background: #dc3545; color: white; }
        .badge-info { background: #17a2b8; color: white; }
        .badge-purple { background: #6f42c1; color: white; }
        .badge-red { background: #E63946; color: white; }
        .badge-blue { background: #007bff; color: white; }
        .badge-green { background: #28a745; color: white; }
        .badge-gray { background: #6c757d; color: white; }
        .report-footer {
            background: #212529;
            color: white;
            padding: 30px 40px;
            text-align: center;
        }
        .report-footer p {
            font-size: 14px;
            opacity: 0.8;
        }
        .price {
            color: #E63946;
            font-weight: 700;
        }
        @media print {
            body { padding: 0; background: white; }
            .report-container { box-shadow: none; }
            .stat-card { break-inside: avoid; }
        }
        @media (max-width: 768px) {
            .report-header h1 { font-size: 24px; }
            .stats-grid { grid-template-columns: 1fr; }
            .report-content { padding: 20px; }
            .report-meta { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="report-container">
        <div class="report-header">
            <h1>📸 Tutok Pitik Studios</h1>
            <p>System Statistics & Analytics Report</p>
        </div>
        
        <div class="report-meta">
            <div class="meta-item">
                <div class="meta-label">Generated At</div>
                <div class="meta-value">${reportData.generatedAt}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Generated By</div>
                <div class="meta-value">${reportData.generatedBy}</div>
            </div>
            <div class="meta-item">
                <div class="meta-label">Report Type</div>
                <div class="meta-value">Full System Report</div>
            </div>
        </div>

        <div class="report-content">
            <!-- User Statistics -->
            <div class="section">
                <h2 class="section-title">👥 User Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Users</div>
                        <div class="stat-value">${reportData.statistics.users.total}</div>
                        <div class="stat-subtext">Registered accounts</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Active Users</div>
                        <div class="stat-value">${reportData.statistics.users.active}</div>
                        <div class="stat-subtext">${((reportData.statistics.users.active / reportData.statistics.users.total) * 100 || 0).toFixed(1)}% of total</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Inactive Users</div>
                        <div class="stat-value">${reportData.statistics.users.inactive}</div>
                        <div class="stat-subtext">${((reportData.statistics.users.inactive / reportData.statistics.users.total) * 100 || 0).toFixed(1)}% of total</div>
                    </div>
                </div>

                <h3 style="font-size: 18px; margin: 30px 0 15px; color: #495057;">Users by Role</h3>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Super Admins</div>
                        <div class="stat-value">${reportData.statistics.users.byRole.superadmin}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Admins</div>
                        <div class="stat-value">${reportData.statistics.users.byRole.admin}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Staff</div>
                        <div class="stat-value">${reportData.statistics.users.byRole.staff}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Customers</div>
                        <div class="stat-value">${reportData.statistics.users.byRole.customer}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Guests</div>
                        <div class="stat-value">${reportData.statistics.users.byRole.guest}</div>
                    </div>
                </div>
            </div>

            <!-- Booking Statistics -->
            <div class="section">
                <h2 class="section-title">📅 Booking Statistics</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Bookings</div>
                        <div class="stat-value">${reportData.statistics.bookings.total}</div>
                        <div class="stat-subtext">All time bookings</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Pending</div>
                        <div class="stat-value">${reportData.statistics.bookings.pending}</div>
                        <div class="stat-subtext">Awaiting confirmation</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Confirmed</div>
                        <div class="stat-value">${reportData.statistics.bookings.confirmed}</div>
                        <div class="stat-subtext">Upcoming sessions</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Completed</div>
                        <div class="stat-value">${reportData.statistics.bookings.completed}</div>
                        <div class="stat-subtext">Finished sessions</div>
                    </div>
                </div>
            </div>

            <!-- Sales Statistics -->
            <div class="section">
                <h2 class="section-title">💰 Sales & Revenue</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-label">Total Earnings</div>
                        <div class="stat-value">₱${totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-subtext">From completed bookings</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Average Per Booking</div>
                        <div class="stat-value">₱${(reportData.statistics.sales.averagePerBooking || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                        <div class="stat-subtext">Average transaction value</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-label">Portfolio Items</div>
                        <div class="stat-value">${reportData.statistics.portfolio.totalItems}</div>
                        <div class="stat-subtext">Showcase works</div>
                    </div>
                </div>
            </div>

            <!-- Recent Bookings -->
            ${reportData.recentBookings.length > 0 ? `
            <div class="section">
                <h2 class="section-title">📋 Recent Bookings</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Service</th>
                                <th>Date</th>
                                <th>Customer</th>
                                <th>Status</th>
                                <th>Price</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.recentBookings.map((booking: any) => `
                                <tr>
                                    <td><strong>${booking.service}</strong></td>
                                    <td>${booking.date}</td>
                                    <td>${booking.firstName && booking.lastName ? `${booking.firstName} ${booking.lastName}` : booking.fullName || 'N/A'}<br><small style="color: #6c757d;">${booking.email}</small></td>
                                    <td><span class="badge badge-${
                                      booking.status === 'confirmed' ? 'success' : 
                                      booking.status === 'pending' ? 'warning' : 
                                      booking.status === 'completed' ? 'info' : 'danger'
                                    }">${booking.status || 'pending'}</span></td>
                                    <td class="price">${booking.price}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}

            <!-- Recent Users -->
            ${reportData.recentUsers.length > 0 ? `
            <div class="section">
                <h2 class="section-title">👤 Recent Users</h2>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Join Date</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${reportData.recentUsers.map((user: any) => `
                                <tr>
                                    <td><strong>${user.fullName}</strong></td>
                                    <td>${user.email}</td>
                                    <td><span class="badge badge-${
                                      user.role === 'superadmin' ? 'purple' : 
                                      user.role === 'admin' ? 'red' : 
                                      user.role === 'staff' ? 'blue' : 
                                      user.role === 'customer' ? 'green' : 'gray'
                                    }">${user.role}</span></td>
                                    <td>${new Date(user.joinDate).toLocaleDateString()}</td>
                                    <td><span class="badge badge-${user.status === 'active' ? 'success' : 'gray'}">${user.status || 'active'}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            ` : ''}
        </div>

        <div class="report-footer">
            <p><strong>Tutok Pitik Studios</strong> - Photography Portfolio & Booking System</p>
            <p style="margin-top: 8px; font-size: 12px;">This report is confidential and intended for authorized personnel only.</p>
        </div>
    </div>
</body>
</html>`;

    const blob = new Blob([reportHTML], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `TutokPitik_Report_${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'superadmin': return 'bg-purple-500';
      case 'admin': return 'bg-red-500';
      case 'staff': return 'bg-blue-500';
      case 'customer': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'confirmed': return 'bg-green-500';
      case 'pending': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      case 'cancelled': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const categories = [
    {
      name: 'Portrait',
      value: 'portrait',
      subCategories: [
        { name: 'Street', value: 'street' },
        { name: 'Outdoor', value: 'outdoor' },
        { name: 'Casual', value: 'casual' },
        { name: 'Graduation', value: 'graduation' },
        { name: 'Couple', value: 'couple' }
      ]
    },
    {
      name: 'Events',
      value: 'events',
      subCategories: [
        { name: 'Birthday', value: 'birthday' },
        { name: 'Concert', value: 'concert' },
        { name: 'School', value: 'school' },
        { name: 'Corporate', value: 'corporate' },
        { name: 'Festival', value: 'festival' }
      ]
    },
    {
      name: 'Creative',
      value: 'creative',
      subCategories: [
        { name: 'Architecture', value: 'architecture' },
        { name: 'Abstract', value: 'abstract' },
        { name: 'Fine Art', value: 'fineart' },
        { name: 'Conceptual', value: 'conceptual' },
        { name: 'Editorial', value: 'editorial' }
      ]
    },
    {
      name: 'Commercial',
      value: 'commercial',
      subCategories: [
        { name: 'Product', value: 'product' },
        { name: 'Fashion', value: 'fashion' },
        { name: 'Food', value: 'food' },
        { name: 'Lifestyle', value: 'lifestyle' },
        { name: 'Brand', value: 'brand' }
      ]
    },
    {
      name: 'Documentary',
      value: 'documentary',
      subCategories: [
        { name: 'Wedding', value: 'wedding' },
        { name: 'Travel', value: 'travel' },
        { name: 'Reportage', value: 'reportage' },
        { name: 'Candid', value: 'candid' },
        { name: 'Photojournalism', value: 'photojournalism' }
      ]
    }
  ];

  return (
    <div className="auth-overlay" onClick={onClose}>
      <div className="admin-dashboard" onClick={(e) => e.stopPropagation()}>
        <button className="auth-close" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="admin-header">
          <Shield size={32} className="text-[#E63946]" />
          <h2>Admin Dashboard</h2>
          <p className="admin-role-display">
            <span className="role-label">Role:</span>
            <span className="role-value">{user?.role}</span>
          </p>
        </div>

        
        <div className="admin-tabs">
          {canViewStatistics && (
            <button
              className={activeTab === 'statistics' ? 'active' : ''}
              onClick={() => setActiveTab('statistics')}
            >
              <BarChart3 size={18} />
              Statistics
            </button>
          )}
          {canManageUsers && (
            <button
              className={activeTab === 'users' ? 'active' : ''}
              onClick={() => setActiveTab('users')}
            >
              <Users size={18} />
              Users
            </button>
          )}
          {canManageBookings && (
            <button
              className={activeTab === 'bookings' ? 'active' : ''}
              onClick={() => setActiveTab('bookings')}
            >
              <Calendar size={18} />
              Bookings
            </button>
          )}
          {canManagePortfolio && (
            <button
              className={activeTab === 'portfolio' ? 'active' : ''}
              onClick={() => setActiveTab('portfolio')}
            >
              <Image size={18} />
              Portfolio
            </button>
          )}
        </div>

        
        <div className="admin-content">
          
          {activeTab === 'statistics' && canViewStatistics && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h3>System Statistics</h3>
                <button className="admin-btn-primary" onClick={generateReport}>
                  <Download size={18} />
                  Generate Report
                </button>
              </div>

              
              <div className="quick-overview-grid">
                <div className="quick-overview-card overview-primary">
                  <div className="quick-overview-icon">
                    <TrendingUp size={28} />
                  </div>
                  <div className="quick-overview-info">
                    <div className="quick-overview-label">Total Revenue</div>
                    <div className="quick-overview-value quick-overview-value-money">₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                </div>
                <div className="quick-overview-card overview-users">
                  <div className="quick-overview-icon">
                    <Users size={28} />
                  </div>
                  <div className="quick-overview-info">
                    <div className="quick-overview-label">Total Users</div>
                    <div className="quick-overview-value">{users.length}</div>
                  </div>
                </div>
                <div className="quick-overview-card overview-bookings">
                  <div className="quick-overview-icon">
                    <Calendar size={28} />
                  </div>
                  <div className="quick-overview-info">
                    <div className="quick-overview-label">Total Bookings</div>
                    <div className="quick-overview-value">{totalBookings}</div>
                  </div>
                </div>
                <div className="quick-overview-card overview-portfolio">
                  <div className="quick-overview-icon">
                    <Image size={28} />
                  </div>
                  <div className="quick-overview-info">
                    <div className="quick-overview-label">Portfolio Items</div>
                    <div className="quick-overview-value">{portfolioItems.length}</div>
                  </div>
                </div>
              </div>

              
              <div className="admin-section-header" style={{ marginTop: '24px' }}>
                <h3>User Statistics</h3>
              </div>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Count</th>
                      <th>Percentage</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Total Users</strong></td>
                      <td>{users.length}</td>
                      <td>100%</td>
                      <td><span className="badge bg-purple-500">All</span></td>
                    </tr>
                    <tr>
                      <td><strong>Active Users</strong></td>
                      <td>{activeUsers}</td>
                      <td>{users.length > 0 ? ((activeUsers / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-green-500">Active</span></td>
                    </tr>
                    <tr>
                      <td><strong>Inactive Users</strong></td>
                      <td>{inactiveUsers}</td>
                      <td>{users.length > 0 ? ((inactiveUsers / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-gray-500">Inactive</span></td>
                    </tr>
                    <tr>
                      <td><strong>Super Admins</strong></td>
                      <td>{users.filter(u => u.role === 'superadmin').length}</td>
                      <td>{users.length > 0 ? ((users.filter(u => u.role === 'superadmin').length / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-red-500">Super Admin</span></td>
                    </tr>
                    <tr>
                      <td><strong>Admins</strong></td>
                      <td>{users.filter(u => u.role === 'admin').length}</td>
                      <td>{users.length > 0 ? ((users.filter(u => u.role === 'admin').length / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-orange-500">Admin</span></td>
                    </tr>
                    <tr>
                      <td><strong>Staff</strong></td>
                      <td>{users.filter(u => u.role === 'staff').length}</td>
                      <td>{users.length > 0 ? ((users.filter(u => u.role === 'staff').length / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-blue-500">Staff</span></td>
                    </tr>
                    <tr>
                      <td><strong>Customers</strong></td>
                      <td>{users.filter(u => u.role === 'customer').length}</td>
                      <td>{users.length > 0 ? ((users.filter(u => u.role === 'customer').length / users.length) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-teal-500">Customer</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              
              <div className="admin-section-header" style={{ marginTop: '32px' }}>
                <h3>Booking Statistics</h3>
              </div>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th>Count</th>
                      <th>Percentage</th>
                      <th>Badge</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Total Bookings</strong></td>
                      <td>{totalBookings}</td>
                      <td>100%</td>
                      <td><span className="badge bg-[#E63946]">All</span></td>
                    </tr>
                    <tr>
                      <td><strong>Pending</strong></td>
                      <td>{pendingBookings}</td>
                      <td>{totalBookings > 0 ? ((pendingBookings / totalBookings) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-yellow-500">Pending</span></td>
                    </tr>
                    <tr>
                      <td><strong>Confirmed</strong></td>
                      <td>{confirmedBookings}</td>
                      <td>{totalBookings > 0 ? ((confirmedBookings / totalBookings) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-green-500">Confirmed</span></td>
                    </tr>
                    <tr>
                      <td><strong>Completed</strong></td>
                      <td>{completedBookings}</td>
                      <td>{totalBookings > 0 ? ((completedBookings / totalBookings) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-blue-500">Completed</span></td>
                    </tr>
                    <tr>
                      <td><strong>Cancelled</strong></td>
                      <td>{bookings.filter(b => b.status === 'cancelled').length}</td>
                      <td>{totalBookings > 0 ? ((bookings.filter(b => b.status === 'cancelled').length / totalBookings) * 100).toFixed(1) : 0}%</td>
                      <td><span className="badge bg-red-500">Cancelled</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              
              <div className="admin-section-header" style={{ marginTop: '32px' }}>
                <h3>Revenue & Financial Overview</h3>
              </div>
              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Metric</th>
                      <th>Value</th>
                      <th>Details</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td><strong>Total Revenue</strong></td>
                      <td>₱{totalSales.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>From {completedBookings} completed bookings</td>
                      <td><span className="badge bg-green-500">Earned</span></td>
                    </tr>
                    <tr>
                      <td><strong>Average Booking Value</strong></td>
                      <td>₱{completedBookings > 0 ? (totalSales / completedBookings).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00'}</td>
                      <td>Per completed booking</td>
                      <td><span className="badge bg-blue-500">Average</span></td>
                    </tr>
                    <tr>
                      <td><strong>Potential Revenue</strong></td>
                      <td>₱{bookings.filter(b => b.status === 'confirmed').reduce((sum, b) => sum + parseFloat(b.price?.replace(/[^0-9.-]+/g, '') || '0'), 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td>From {confirmedBookings} confirmed bookings</td>
                      <td><span className="badge bg-yellow-500">Pending</span></td>
                    </tr>
                    <tr>
                      <td><strong>Portfolio Items</strong></td>
                      <td>{portfolioItems.length}</td>
                      <td>Total images showcased</td>
                      <td><span className="badge bg-purple-500">Active</span></td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          
          {activeTab === 'users' && canManageUsers && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h3>User Management</h3>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn-export-pdf"
                    onClick={exportUsersToPDF}
                    title="Export to PDF"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                  <button 
                    className="admin-btn-primary"
                    onClick={() => {
                      setShowForm(true);
                      setEditingItem(null);
                      setFormData({ role: 'customer', status: 'active' });
                    }}
                  >
                    <Plus size={18} />
                    Create User
                  </button>
                </div>
              </div>

              {showForm && (
                <div className="admin-form">
                  <h4>{editingItem ? 'Edit User' : 'Create New User'}</h4>
                  <input
                    type="text"
                    placeholder="Full Name"
                    value={formData.fullName || ''}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={formData.email || ''}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={formData.password || ''}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  />
                  <select
                    value={formData.role || 'customer'}
                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                  >
                    <option value="customer">Customer</option>
                    <option value="staff">Staff</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Super Admin</option>
                  </select>
                  <select
                    value={formData.status || 'active'}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                  <div className="admin-form-actions">
                    <button onClick={() => { setShowForm(false); setFormData({}); }}>
                      Cancel
                    </button>
                    <button onClick={handleCreateUser}>
                      Create User
                    </button>
                  </div>
                </div>
              )}

              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Status</th>
                      <th>Join Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id}>
                        <td>{u.fullName}</td>
                        <td>{u.email}</td>
                        <td>
                          <span className={`badge ${getRoleBadgeColor(u.role)}`}>
                            {u.role}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.status === 'active' ? 'bg-green-500' : 'bg-gray-500'}`}>
                            {u.status || 'active'}
                          </span>
                        </td>
                        <td>{new Date(u.joinDate).toLocaleDateString()}</td>
                        <td>
                          <div className="admin-actions">
                            <button
                              onClick={() => {
                                setEditingItem(u);
                                setFormData(u);
                              }}
                              title="Edit"
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteUser(u.id)}
                              title="Delete"
                              className="delete-btn"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {users.length === 0 && (
                  <p className="admin-empty">No users found</p>
                )}
              </div>

              {editingItem && (
                <div className="admin-edit-modal">
                  <div className="admin-form">
                    <h4>Edit User</h4>
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={formData.fullName || ''}
                      onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    />
                    <input
                      type="email"
                      placeholder="Email"
                      value={formData.email || ''}
                      readOnly
                      disabled
                    />
                    <p className="admin-form-note">Email is locked for account identity and password recovery.</p>
                    <select
                      value={formData.role || 'customer'}
                      onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                    >
                      <option value="customer">Customer</option>
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                      <option value="superadmin">Super Admin</option>
                    </select>
                    <select
                      value={formData.status || 'active'}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                    <div className="admin-form-actions">
                      <button
                        type="button"
                        onClick={() => handleSendUserResetPassword(formData.email)}
                        disabled={sendingUserResetId === formData.email}
                      >
                        {sendingUserResetId === formData.email ? 'Sending...' : 'Send Password Reset'}
                      </button>
                    </div>
                    <div className="admin-form-actions">
                      <button onClick={() => { setEditingItem(null); setFormData({}); }}>
                        Cancel
                      </button>
                      <button onClick={() => handleUpdateUser(editingItem.id)}>
                        Save Changes
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          
          {activeTab === 'bookings' && canManageBookings && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h3>Booking Management</h3>
                <div className="booking-stats">
                  <span>Total: {bookings.length}</span>
                  <span className="text-yellow-500">Pending: {bookings.filter(b => b.status === 'pending').length}</span>
                  <span className="text-green-500">Confirmed: {bookings.filter(b => b.status === 'confirmed').length}</span>
                  <button
                    className="btn-export-pdf"
                    onClick={exportBookingsToPDF}
                    title="Export to PDF"
                  >
                    <FileDown size={18} />
                    Export PDF
                  </button>
                </div>
              </div>

              <div className="admin-table">
                <table>
                  <thead>
                    <tr>
                      <th>Service</th>
                      <th>Date</th>
                      <th>Time</th>
                      <th>Customer</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.service}</td>
                        <td>{booking.date}</td>
                        <td>{booking.time}</td>
                        <td>
                          <div>
                            <div>{booking.firstName && booking.lastName ? `${booking.firstName} ${booking.lastName}` : booking.fullName || 'N/A'}</div>
                            <div className="text-xs text-gray-500">{booking.email}</div>
                            <div className="text-xs text-gray-500">{booking.phone || 'No mobile number added'}</div>
                          </div>
                        </td>
                        <td>
                          <select
                            value={booking.status || 'pending'}
                            onChange={(e) => handleUpdateBookingStatus(booking.id, e.target.value)}
                            className={`status-select ${getStatusBadgeColor(booking.status || 'pending')}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="completed">Completed</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td>
                          <div className="admin-actions">
                            <button
                              onClick={() => setViewingBooking(booking)}
                              title="View Details"
                            >
                              <Eye size={16} />
                            </button>
                            <button
                              onClick={() => handleDeleteBooking(booking.id)}
                              title="Delete"
                              className="delete-btn"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {bookings.length === 0 && (
                  <p className="admin-empty">No bookings found</p>
                )}
              </div>
            </div>
          )}

          
          {activeTab === 'portfolio' && canManagePortfolio && (
            <div className="admin-section">
              <div className="admin-section-header">
                <h3>Portfolio Management</h3>
                <button 
                  className="admin-btn-primary"
                  onClick={() => {
                    setShowForm(true);
                    setEditingItem(null);
                    setFormData({});
                    setImagePreview('');
                  }}
                >
                  <Plus size={18} />
                  Add Portfolio Item
                </button>
              </div>

              {showForm && (
                <div className="admin-form portfolio-editor-form">
                  <h4>{editingItem ? 'Edit Portfolio Item' : 'Add New Portfolio Item'}</h4>
                  
                  <div className="image-upload-container">
                    <label htmlFor="portfolio-image" className={`image-upload-label portfolio-image-upload-label ${imagePreview ? 'has-preview' : ''}`}>
                      {imagePreview ? (
                        <img src={imagePreview} alt="Preview" className="portfolio-form-preview-image" />
                      ) : (
                        <div className="portfolio-form-empty-state">
                          <Image size={48} style={{ color: 'var(--color-gray-500)' }} />
                          <span style={{ color: 'var(--color-gray-400)' }}>Click to upload image</span>
                        </div>
                      )}
                    </label>
                    <input
                      id="portfolio-image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      style={{ display: 'none' }}
                    />
                  </div>

                  <input
                    type="text"
                    placeholder="Title"
                    value={formData.title || ''}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  />

                  <select
                    value={formData.category || ''}
                    onChange={(e) => {
                      setFormData({ ...formData, category: e.target.value, subCategory: '' });
                    }}
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.name}</option>
                    ))}
                  </select>

                  {formData.category && (
                    <select
                      value={formData.subCategory || ''}
                      onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    >
                      <option value="">Select Sub-Category</option>
                      {categories.find(cat => cat.value === formData.category)?.subCategories.map(subCat => (
                        <option key={subCat.value} value={subCat.value}>{subCat.name}</option>
                      ))}
                    </select>
                  )}

                  <textarea
                    placeholder="Description (optional)"
                    value={formData.description || ''}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                  />

                  <div className="admin-form-actions">
                    <button onClick={() => { 
                      setShowForm(false); 
                      setFormData({}); 
                      setImagePreview('');
                    }}>
                      Cancel
                    </button>
                    <button onClick={editingItem ? () => setShowPortfolioUpdateConfirm(true) : handleCreatePortfolioItem}>
                      {editingItem ? 'Update' : 'Add'} Portfolio Item
                    </button>
                  </div>
                </div>
              )}

              <div className="portfolio-admin-grid">
                {portfolioItems.map((item) => (
                  <div key={item.id} className="portfolio-admin-item">
                    <img src={item.imageData || item.url} alt={item.title} />
                    <div className="portfolio-admin-overlay">
                      <div className="portfolio-admin-title">{item.title}</div>
                      <div className="portfolio-admin-category">
                        {item.category} • {item.subCategory || item.subcategory}
                      </div>
                      <div className="portfolio-admin-actions">
                        <button
                          onClick={() => {
                            setEditingItem(item);
                            setFormData(normalizePortfolioItem(item));
                            setImagePreview(item.imageData || item.url);
                            setShowForm(true);
                          }}
                          title="Edit"
                        >
                          <Edit2 size={16} />
                        </button>
                        <button
                          onClick={() => handleDeletePortfolioItem(item.id)}
                          title="Delete"
                          className="delete-btn"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {portfolioItems.length === 0 && !showForm && (
                <p className="admin-empty">No portfolio items added yet. Click "Add Portfolio Item" to get started.</p>
              )}
            </div>
          )}
        </div>

        
        {!canManageUsers && activeTab === 'users' && (
          <div className="admin-access-denied">
            <XCircle size={48} />
            <h3>Access Denied</h3>
            <p>You don't have permission to manage users.</p>
          </div>
        )}
      </div>

      
      {viewingBooking && (
        <div className="modal-overlay active" onClick={() => setViewingBooking(null)}>
          <div className="booking-detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="auth-close" onClick={() => setViewingBooking(null)}>
              <X size={24} />
            </button>
            <h3>Booking Details</h3>
            <div className="booking-detail-content">
              <div className="booking-detail-row">
                <strong>Service:</strong>
                <span>{viewingBooking.service}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Date:</strong>
                <span>{viewingBooking.dateDisplay || viewingBooking.date}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Time:</strong>
                <span>{viewingBooking.time}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Duration:</strong>
                <span>{viewingBooking.durationLabel || viewingBooking.duration}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Customer Name:</strong>
                <span>{viewingBooking.fullName || `${viewingBooking.firstName || ''} ${viewingBooking.lastName || ''}`.trim()}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Email:</strong>
                <span>{viewingBooking.email}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Mobile Number:</strong>
                <span>{viewingBooking.phone || 'No mobile number added'}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Payment Method:</strong>
                <span>{viewingBooking.paymentMethod || 'GCash'}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Reference Number:</strong>
                <span>{viewingBooking.paymentReference || 'Not submitted yet'}</span>
              </div>
              <div className="booking-detail-row booking-detail-column">
                <strong>Payment Review:</strong>
                <select
                  value={viewingBooking.paymentStatus || 'submitted'}
                  onChange={(e) => setViewingBooking({ ...viewingBooking, paymentStatus: e.target.value })}
                  className="status-select"
                >
                  <option value="submitted">Submitted</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              {viewingBooking.paymentReceiptUrl && (
                <div className="booking-detail-row booking-detail-column">
                  <strong>Uploaded Payment Receipt:</strong>
                  <div className="payment-receipt-preview-card">
                    <img src={viewingBooking.paymentReceiptUrl} alt={viewingBooking.paymentReceiptName || 'Payment receipt'} className="payment-receipt-preview-image" />
                    <div className="payment-receipt-meta">
                      <span>{viewingBooking.paymentReceiptName || 'Receipt uploaded'}</span>
                      <button
                        type="button"
                        className="booking-drive-link booking-drive-link-button"
                        onClick={() => setReceiptPreview({
                          url: viewingBooking.paymentReceiptUrl,
                          name: viewingBooking.paymentReceiptName || 'Uploaded payment receipt',
                        })}
                      >
                        <LinkIcon size={16} />
                        View Uploaded Receipt
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <div className="booking-detail-row">
                <strong>Service Subtotal:</strong>
                <span className="font-semibold">PHP {Number(viewingBooking.baseSubtotal || (Number(viewingBooking.serviceRate || 0) * (Number(String(viewingBooking.duration || 0).replace(/[^0-9.]/g, '')) || 0))).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="booking-detail-row booking-detail-column">
                <strong>Transportation Adjustment:</strong>
                <input
                  type="text"
                  inputMode="decimal"
                  value={String(viewingBooking.transportationFee ?? '')}
                  onChange={(e) => {
                    const cleanedValue = e.target.value.replace(/[^0-9.]/g, '');
                    const transportationFee = cleanedValue === '' ? '' : Number(cleanedValue);
                    const serviceRate = Number(viewingBooking.serviceRate || 0);
                    const durationHours = Number(String(viewingBooking.duration || 0).replace(/[^0-9.]/g, '')) || 0;
                    const baseSubtotal = serviceRate * durationHours;
                    const totalAmount = baseSubtotal + Number(transportationFee || 0);
                    const downpaymentAmount = Number(viewingBooking.downpaymentAmount || (baseSubtotal / 2)) || 0;
                    const remainingBalance = Math.max(totalAmount - downpaymentAmount, 0);
                    setViewingBooking({
                      ...viewingBooking,
                      transportationFee,
                      baseSubtotal,
                      downpaymentAmount,
                      remainingBalance,
                      shootDayBalance: remainingBalance,
                      totalAmount,
                      total_price: totalAmount,
                      numericPrice: totalAmount,
                      price: `₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                    });
                  }}
                  placeholder="Enter custom amount"
                  className="booking-detail-input"
                />
              </div>
              <div className="booking-detail-row">
                <strong>Downpayment Received:</strong>
                <span className="font-semibold">PHP {Number(viewingBooking.downpaymentAmount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Balance Due on Shoot Day:</strong>
                <span className="font-semibold">PHP {Number(viewingBooking.remainingBalance || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div className="booking-detail-row">
                <strong>Confirmed Total:</strong>
                <span className="text-[#E63946] font-semibold">PHP {Number(viewingBooking.totalAmount || viewingBooking.numericPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              {viewingBooking.status !== 'cancelled' && (
                <div className="booking-detail-actions booking-detail-actions-centered">
                  {viewingBooking.status === 'completed' && (
                    <button className="btn-export-pdf" onClick={() => downloadBookingReceipt(viewingBooking)}>
                      <Download size={16} />
                      Download Receipt
                    </button>
                  )}
                  <button className="admin-btn-primary" onClick={() => setShowBookingSaveConfirm(true)}>
                    <Save size={16} />
                    Save Booking Details
                  </button>
                </div>
              )}
              <div className="booking-detail-row">
                <strong>Status:</strong>
                <span className={`badge ${getStatusBadgeColor(viewingBooking.status || 'pending')}`}>
                  {viewingBooking.status || 'pending'}
                </span>
              </div>
              <div className="booking-detail-row">
                <strong>Booking ID:</strong>
                <span className="text-xs text-gray-500">{viewingBooking.id}</span>
              </div>

              {viewingBooking.status === 'completed' && (
                <>
                  <div className="booking-detail-row">
                    <strong>Receipt:</strong>
                    <span>{viewingBooking.receiptNumber}</span>
                  </div>
                  <div className="booking-detail-row booking-detail-column">
                    <strong>Photo Status:</strong>
                    <select
                      value={viewingBooking.photoStatus || 'editing'}
                      onChange={(e) => setViewingBooking({ ...viewingBooking, photoStatus: e.target.value })}
                      className="status-select"
                    >
                      <option value="editing">Editing</option>
                      <option value="ready">Ready for delivery</option>
                      <option value="delivered">Delivered</option>
                    </select>
                  </div>
                  <div className="booking-detail-row booking-detail-column">
                    <strong>Google Drive Link:</strong>
                    <input
                      type="url"
                      value={viewingBooking.driveLink || ''}
                      onChange={(e) => setViewingBooking({ ...viewingBooking, driveLink: e.target.value })}
                      placeholder="https://drive.google.com/..."
                      className="booking-detail-input"
                    />
                  </div>
                  {viewingBooking.driveLink && (
                    <a href={viewingBooking.driveLink} target="_blank" rel="noreferrer" className="booking-drive-link">
                      <LinkIcon size={16} />
                      Open Google Drive Link
                    </a>
                  )}
                </>
              )}
            </div>
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

      {showPortfolioUpdateConfirm && editingItem && (
        <div className="modal-overlay active" onClick={() => setShowPortfolioUpdateConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <Save size={48} />
            </div>
            <h3>Update Portfolio Item</h3>
            <p>Please confirm that you want to save these portfolio changes.</p>
            <div className="confirm-details">
              <p><strong>Title:</strong> {formData.title || editingItem.title}</p>
              <p><strong>Category:</strong> {formData.category || editingItem.category}</p>
              <p><strong>Sub-Category:</strong> {formData.subCategory || formData.subcategory || editingItem.subCategory || editingItem.subcategory}</p>
            </div>
            <div className="confirm-actions booking-detail-actions-centered">
              <button className="confirm-btn-cancel" type="button" onClick={() => setShowPortfolioUpdateConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-btn-proceed" type="button" onClick={handleConfirmPortfolioUpdate}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {showBookingSaveConfirm && viewingBooking && (
        <div className="modal-overlay active" onClick={() => setShowBookingSaveConfirm(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <Save size={48} />
            </div>
            <h3>Save Booking Details</h3>
            <p>Please confirm that you want to save this booking update.</p>
            <div className="confirm-details">
              <p><strong>Customer:</strong> {viewingBooking.fullName || viewingBooking.email}</p>
              <p><strong>Status:</strong> {(viewingBooking.status || 'pending').toUpperCase()}</p>
              <p><strong>Confirmed Total:</strong> PHP {Number(viewingBooking.totalAmount || viewingBooking.numericPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
            <div className="confirm-actions booking-detail-actions-centered">
              <button className="confirm-btn-cancel" type="button" onClick={() => setShowBookingSaveConfirm(false)}>
                Cancel
              </button>
              <button className="confirm-btn-proceed" type="button" onClick={handleConfirmSaveBookingDetails}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
