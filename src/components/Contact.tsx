import React, { useState, useRef } from 'react';
import { Calendar, Clock, MapPin, DollarSign, Send, X } from 'lucide-react';
import BookingCalendar from './BookingCalendar';
import Notification from './Notification';
import { supabase, projectId } from '../lib/supabase';

interface ContactProps {
  onClose: () => void;
  user: any;
}

export default function Contact({ onClose, user }: ContactProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [formDataToSubmit, setFormDataToSubmit] = useState<any>(null);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'info' | 'warning' | 'login';
    title: string;
    message: string;
    showButton?: boolean;
    buttonText?: string;
    onButtonClick?: () => void;
  }>({
    show: false,
    type: 'info',
    title: '',
    message: ''
  });
  const formRef = useRef<HTMLFormElement>(null);

  const services = [
    { value: 'portrait', label: 'Portrait Photography - ₱2,500/hour', rate: 2500 },
    { value: 'Birthday', label: 'Birthday Photography - ₱1,000/hour', rate: 1000 },
    { value: 'commercial', label: 'Commercial Photography - ₱4,000/hour', rate: 4000 },
    { value: 'event', label: 'Event Coverage - ₱1,500/hour', rate: 1500 },
    { value: 'landscape', label: 'Landscape & Architecture - ₱3,000/hour', rate: 3000 }
  ];

  const availableTimeSlots = [
    '08:00', '09:00', '10:00', '11:00', '12:00',
    '13:00', '14:00', '15:00', '16:00', '17:00',
    '18:00', '19:00', '20:00'
  ];

  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  const calculateDuration = (start: string, end: string) => {
    const [startHour, startMin] = start.split(':').map(Number);
    const [endHour, endMin] = end.split(':').map(Number);
    const startMinutes = startHour * 60 + startMin;
    const endMinutes = endHour * 60 + endMin;
    return (endMinutes - startMinutes) / 60;
  };

  const formatDateDisplay = (dateString: string) => {
    const [year, month, day] = dateString.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    const options: Intl.DateTimeFormatOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const getCurrentService = () => services.find(s => s.value === selectedService);
  const duration = startTime && endTime ? calculateDuration(startTime, endTime) : 0;
  const hourlyRate = getCurrentService()?.rate || 0;
  const totalPrice = hourlyRate * duration;

  const showPricing = selectedService && selectedDate && startTime && endTime;

  const validateEmail = (email: string) => {
    // Validate proper email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formRef.current) return;

    // Check booking limit (3 bookings per user) using Supabase
    if (user && user.id !== 'guest') {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings`, {
            headers: {
              'Authorization': `Bearer ${session.access_token}`
            }
          });
          
          if (response.ok) {
            const { bookings } = await response.json();
            if (bookings && bookings.length >= 3) {
              showNotification(
                'warning',
                'Booking Limit Reached',
                'You have reached the maximum limit of 3 bookings. Please contact us for additional bookings.'
              );
              return;
            }
          }
        }
      } catch (error) {
        console.error('Error checking booking limit:', error);
      }
    }
    
    const formData = new FormData(formRef.current);
    const email = formData.get('email') as string;
    const firstName = formData.get('firstName') as string;
    const lastName = formData.get('lastName') as string;

    // Validate email
    if (!validateEmail(email)) {
      showNotification(
        'error',
        'Invalid Email',
        'Please enter a valid email address (e.g., name@gmail.com).'
      );
      return;
    }
    
    // Set hidden field values
    formData.set('duration', `${duration} ${duration === 1 ? 'hour' : 'hours'}`);
    formData.set('totalPrice', `₱${totalPrice.toLocaleString()}`);
    formData.set('hourlyRate', `₱${hourlyRate.toLocaleString()}`);
    formData.set('date', formatDateDisplay(selectedDate!));
    formData.set('startTime', formatTime(startTime));
    formData.set('endTime', formatTime(endTime));
    formData.set('name', `${firstName} ${lastName}`);

    // Show confirmation dialog
    setFormDataToSubmit({
      formData,
      firstName,
      lastName,
      email,
      phone: formData.get('phone') as string,
      location: formData.get('location') as string,
      message: formData.get('message') as string,
      service: getCurrentService()?.label.split(' - ')[0],
      date: formatDateDisplay(selectedDate!),
      time: `${formatTime(startTime)} - ${formatTime(endTime)}`,
      duration: `${duration} ${duration === 1 ? 'hour' : 'hours'}`,
      price: `₱${totalPrice.toLocaleString()}`
    });
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmDialog(false);

    if (!formDataToSubmit) return;

    try {
      // Get user session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        showNotification('error', 'Authentication Error', 'Please sign in to make a booking.');
        return;
      }

      // Create booking in Supabase
      const bookingPayload = {
        full_name: `${formDataToSubmit.firstName} ${formDataToSubmit.lastName}`,
        email: formDataToSubmit.email,
        phone: formDataToSubmit.phone,
        service: formDataToSubmit.service,
        booking_date: selectedDate,
        start_time: startTime,
        end_time: endTime,
        duration: duration,
        price: hourlyRate,
        transportation: 0, // Will be calculated later
        total_price: totalPrice,
        location: formDataToSubmit.location,
        message: formDataToSubmit.message || ''
      };

      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/bookings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(bookingPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create booking');
      }

      const { booking } = await response.json();
      
      // Send booking confirmation emails
      try {
        await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-booking-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({ booking: bookingPayload })
        });
      } catch (emailError) {
        console.error('Email notification error:', emailError);
        // Don't fail booking if email fails
      }

      // Show success modal
      onClose();
      
      // Reset form
      if (formRef.current) {
        formRef.current.reset();
      }
      setSelectedDate(null);
      setStartTime('');
      setEndTime('');
      setSelectedService('');
      setFormDataToSubmit(null);

    } catch (error) {
      console.error('Booking submission error:', error);
      showNotification(
        'error',
        'Booking Failed',
        error instanceof Error ? error.message : 'Failed to create booking. Please try again.'
      );
    }
  };

  const getEndTimeOptions = () => {
    if (!startTime) return [];
    const startIndex = availableTimeSlots.indexOf(startTime);
    return availableTimeSlots.slice(startIndex + 1, startIndex + 9);
  };

  // Check if user is logged in and is a customer
  const isLoggedIn = !!user;
  const isGuest = !user || user.id === 'guest' || user.role === 'guest';
  const canBook = isLoggedIn && user.role === 'customer';
  const isAdminRole = user && ['superadmin', 'admin', 'staff'].includes(user.role);

  const showNotification = (type: 'success' | 'error' | 'info' | 'warning' | 'login', title: string, message: string, showButton?: boolean, buttonText?: string, onButtonClick?: () => void) => {
    setNotification({
      show: true,
      type,
      title,
      message,
      showButton,
      buttonText,
      onButtonClick
    });
  };

  const handleFormClick = (e: React.MouseEvent) => {
    if (!canBook) {
      e.preventDefault();
      
      if (isAdminRole) {
        showNotification(
          'warning',
          'Booking Not Available',
          'Booking is only available for customer accounts. Admin and staff members cannot make bookings.'
        );
      } else if (isGuest) {
        showNotification(
          'login',
          'Login Required',
          'You must be logged in to reserve a booking. Please create an account or sign in to continue.',
          onShowLogin ? true : false,
          'Login',
          onShowLogin
        );
      }
    }
  };

  return (
    <>
      <section id="contact" className="contact">
        <div className="container">
          <div className="contact-wrapper">
            <div className="contact-info">
              <div className="section-tag">Get In Touch</div>
              <h2 className="section-title">Let's Create Together</h2>
              <p className="contact-lead">
                Ready to bring your vision to life? We'd love to hear about your project and discuss how we can help create something extraordinary.
              </p>

              <div className="contact-details">
                <div className="contact-detail-item">
                  <div className="contact-detail-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M3 8L10.89 13.26C11.2187 13.4793 11.6049 13.5963 12 13.5963C12.3951 13.5963 12.7813 13.4793 13.11 13.26L21 8M5 19H19C19.5304 19 20.0391 18.7893 20.4142 18.4142C20.7893 18.0391 21 17.5304 21 17V7C21 6.46957 20.7893 5.96086 20.4142 5.58579C20.0391 5.21071 19.5304 5 19 5H5C4.46957 5 3.96086 5.21071 3.58579 5.58579C3.21071 5.96086 3 6.46957 3 7V17C3 17.5304 3.21071 18.0391 3.58579 18.4142C3.96086 18.7893 4.46957 19 5 19Z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="contact-detail-content">
                    <div className="contact-detail-label">Email</div>
                    <a href="mailto:tutokpitikstudios@gmail.com">tutokpitikstudios@gmail.com</a>
                  </div>
                </div>

                <div className="contact-detail-item">
                  <div className="contact-detail-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M22 16.92V19.92C22.0011 20.1985 21.9441 20.4742 21.8325 20.7293C21.7209 20.9845 21.5573 21.2136 21.3521 21.4019C21.1468 21.5901 20.9046 21.7335 20.6407 21.8227C20.3769 21.9119 20.0974 21.9451 19.82 21.92C16.7428 21.5856 13.787 20.5341 11.19 18.85C8.77382 17.3147 6.72533 15.2662 5.18999 12.85C3.49997 10.2412 2.44824 7.27099 2.11999 4.18C2.095 3.90347 2.12787 3.62476 2.21649 3.36162C2.30512 3.09849 2.44756 2.85669 2.63476 2.65162C2.82196 2.44655 3.0498 2.28271 3.30379 2.17052C3.55777 2.05833 3.83233 2.00026 4.10999 2H7.10999C7.5953 1.99522 8.06579 2.16708 8.43376 2.48353C8.80173 2.79999 9.04207 3.23945 9.10999 3.72C9.23662 4.68007 9.47144 5.62273 9.80999 6.53C9.94454 6.88792 9.97366 7.27691 9.8939 7.65088C9.81415 8.02485 9.62886 8.36811 9.35999 8.64L8.08999 9.91C9.51355 12.4135 11.5864 14.4864 14.09 15.91L15.36 14.64C15.6319 14.3711 15.9751 14.1858 16.3491 14.1061C16.7231 14.0263 17.1121 14.0555 17.47 14.19C18.3773 14.5286 19.3199 14.7634 20.28 14.89C20.7658 14.9585 21.2094 15.2032 21.5265 15.5775C21.8437 15.9518 22.0122 16.4296 22 16.92Z"
                        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div className="contact-detail-content">
                    <div className="contact-detail-label">Phone</div>
                    <a href="tel:+639624323187">+63 962 4323 187</a>
                  </div>
                </div>

                <div className="contact-detail-item">
                  <div className="contact-detail-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M21 10C21 17 12 23 12 23C12 23 3 17 3 10C3 7.61305 3.94821 5.32387 5.63604 3.63604C7.32387 1.94821 9.61305 1 12 1C14.3869 1 16.6761 1.94821 18.364 3.63604C20.0518 5.32387 21 7.61305 21 10Z"
                        stroke="currentColor" strokeWidth="2" />
                      <circle cx="12" cy="10" r="3" stroke="currentColor" strokeWidth="2" />
                    </svg>
                  </div>
                  <div className="contact-detail-content">
                    <div className="contact-detail-label">Location</div>
                    <span>Quezon City, Philippines</span>
                  </div>
                </div>
              </div>

              <div className="social-links">
                <a href="https://www.instagram.com/tutokpitikstudios_/" className="social-link">Instagram</a>
                <a href="https://www.facebook.com/profile.php?id=61554013355967" className="social-link">Facebook</a>
                <a href="https://www.behance.net/princebalane" className="social-link">Behance</a>
              </div>
            </div>

            <div className="contact-form-card">
              <form className="contact-form" ref={formRef} onSubmit={handleSubmit} name="booking" method="POST" data-netlify="true" netlify-honeypot="bot-field" onClick={handleFormClick}>
                <input type="hidden" name="form-name" value="booking" />
                <input type="hidden" name="bot-field" />
                <input type="hidden" name="duration" id="hiddenDuration" />
                <input type="hidden" name="totalPrice" id="hiddenTotalPrice" />
                <input type="hidden" name="hourlyRate" id="hiddenHourlyRate" />

                <div className="form-grid">
                  <div className="form-field">
                    <label>First Name *</label>
                    <input type="text" name="firstName" required disabled={!canBook} />
                  </div>
                  <div className="form-field">
                    <label>Last Name *</label>
                    <input type="text" name="lastName" required disabled={!canBook} />
                  </div>
                </div>

                <div className="form-field">
                  <label>Email Address *</label>
                  <input type="email" name="email" required disabled={!canBook} />
                  <span className="form-help">Please enter a valid email address (e.g., name@gmail.com)</span>
                </div>

                <div className="form-field">
                  <label>Phone Number *</label>
                  <input type="tel" name="phone" required disabled={!canBook} />
                </div>

                <div className="form-field">
                  <label>Event Location / Full Address *</label>
                  <div className="address-input-wrapper">
                    <input
                      type="text"
                      id="addressInput"
                      name="location"
                      placeholder="Enter complete address (e.g., 123 Main St, Quezon City, Metro Manila)"
                      required
                      disabled={!canBook}
                    />
                    <div className="address-icon">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path d="M10 17.5C10 17.5 16.25 12.5 16.25 7.5C16.25 5.84315 15.5915 4.25425 14.4194 3.08056C13.2473 1.90687 11.6576 1.25 10 1.25C8.34241 1.25 6.75269 1.90687 5.58058 3.08056C4.40848 4.25425 3.75 5.84315 3.75 7.5C3.75 12.5 10 17.5 10 17.5Z" stroke="currentColor" strokeWidth="1.5"/>
                        <circle cx="10" cy="7.5" r="2.5" stroke="currentColor" strokeWidth="1.5"/>
                      </svg>
                    </div>
                  </div>
                  <span className="form-help">Please provide the complete address where the photoshoot will take place</span>
                </div>

                <div className="form-field">
                  <label>Service *</label>
                  <select 
                    name="service" 
                    required 
                    value={selectedService}
                    onChange={(e) => setSelectedService(e.target.value)}
                    disabled={!canBook}
                  >
                    <option value="">Select a service</option>
                    {services.map(service => (
                      <option key={service.value} value={service.value} data-rate={service.rate}>
                        {service.label}
                      </option>
                    ))}
                  </select>
                </div>

                <BookingCalendar
                  selectedDate={selectedDate}
                  onDateSelect={setSelectedDate}
                  showCalendar={showCalendar}
                  onToggleCalendar={setShowCalendar}
                  disabled={!canBook}
                />

                <div className="form-grid">
                  <div className="form-field">
                    <label>Start Time *</label>
                    <div className="time-select-wrapper">
                      <select
                        name="startTime"
                        required
                        disabled={!selectedDate || !canBook}
                        value={startTime}
                        onChange={(e) => {
                          setStartTime(e.target.value);
                          setEndTime('');
                        }}
                      >
                        <option value="">{selectedDate ? 'Select start time' : 'Select date first'}</option>
                        {selectedDate && availableTimeSlots.map(time => (
                          <option key={time} value={time}>{formatTime(time)}</option>
                        ))}
                      </select>
                      <div className="time-icon">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 5V9L11.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>End Time *</label>
                    <div className="time-select-wrapper">
                      <select
                        name="endTime"
                        required
                        disabled={!startTime || !canBook}
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      >
                        <option value="">{startTime ? 'Select end time' : 'Select start time first'}</option>
                        {getEndTimeOptions().map(time => (
                          <option key={time} value={time}>{formatTime(time)}</option>
                        ))}
                      </select>
                      <div className="time-icon">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                          <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M9 5V9L11.5 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>

                {endTime && (
                  <div className="duration-display">
                    <div className="duration-info">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10C2 14.4183 5.58172 18 10 18Z"
                          stroke="currentColor" strokeWidth="2" />
                        <path d="M10 6V10L13 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                      <span>Duration: {duration} {duration === 1 ? 'hour' : 'hours'}</span>
                    </div>
                  </div>
                )}

                {showPricing && (
                  <div className="pricing-display">
                    <div className="pricing-header">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <path
                          d="M10 2V18M10 2C8 2 5 3 5 6C5 9 8 10 10 10M10 2C12 2 15 3 15 6C15 9 12 10 10 10M10 10C8 10 5 11 5 14C5 17 8 18 10 18M10 10C12 10 15 11 15 14C15 17 12 18 10 18"
                          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span>Booking Summary</span>
                    </div>
                    <div className="pricing-details">
                      <div className="pricing-row">
                        <span>Service</span>
                        <span>{getCurrentService()?.label.split(' - ')[0]}</span>
                      </div>
                      <div className="pricing-row">
                        <span>Date & Time</span>
                        <span>{formatDateDisplay(selectedDate!)}</span>
                      </div>
                      <div className="pricing-row">
                        <span>Duration</span>
                        <span>{duration} {duration === 1 ? 'hour' : 'hours'}</span>
                      </div>
                      <div className="pricing-row">
                        <span>Rate per Hour</span>
                        <span>₱{hourlyRate.toLocaleString()}</span>
                      </div>
                      <div className="pricing-divider"></div>
                      <div className="pricing-calculation">
                        <div className="calc-item">
                          <span className="calc-value">₱{hourlyRate.toLocaleString()}</span>
                        </div>
                        <div className="calc-operator">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="calc-item">
                          <span className="calc-value">{duration}</span>
                          <span className="calc-unit">{duration === 1 ? 'hour' : 'hours'}</span>
                        </div>
                        <div className="calc-equals">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M3 6H13M3 10H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div className="calc-result">
                          <span className="calc-value-result">₱{totalPrice.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="pricing-row pricing-total">
                        <span>Total Amount</span>
                        <span>₱{totalPrice.toLocaleString()}</span>
                      </div>
                    </div>
                    <div className="pricing-note">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
                          stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 11V8M8 5H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span>Payment details will be sent to your email after booking confirmation.</span>
                    </div>
                    <div className="pricing-note" style={{ marginTop: '8px' }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M8 14C11.3137 14 14 11.3137 14 8C14 4.68629 11.3137 2 8 2C4.68629 2 2 4.68629 2 8C2 11.3137 4.68629 14 8 14Z"
                          stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 11V8M8 5H8.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span>Note: The price above is for the service only. Transportation fee will be calculated based on your location and will be sent via email.</span>
                    </div>
                  </div>
                )}

                <div className="form-field">
                  <label>Additional Notes</label>
                  <textarea
                    name="message"
                    rows={4}
                    placeholder="Tell us more about your project or any special requirements..."
                    disabled={!canBook}
                  ></textarea>
                </div>

                <button type="submit" className="btn btn-primary btn-full" disabled={!canBook}>
                  <span>Submit Booking Request</span>
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M16.5 1.5L7.5 10.5M16.5 1.5L11.25 16.5L7.5 10.5M16.5 1.5L1.5 6.75L7.5 10.5"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </form>
            </div>
          </div>
        </div>
      </section>

      {/* Confirmation Dialog */}
      {showConfirmDialog && formDataToSubmit && (
        <div className="modal-overlay active" onClick={() => setShowConfirmDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <AlertCircle size={48} />
            </div>
            <h3>Confirm Booking</h3>
            <p>Please review your booking details before submitting.</p>
            <div className="confirm-details">
              <p><strong>Name:</strong> {formDataToSubmit.firstName} {formDataToSubmit.lastName}</p>
              <p><strong>Email:</strong> {formDataToSubmit.email}</p>
              <p><strong>Service:</strong> {formDataToSubmit.service}</p>
              <p><strong>Date:</strong> {formDataToSubmit.date}</p>
              <p><strong>Time:</strong> {formDataToSubmit.time}</p>
              <p><strong>Duration:</strong> {formDataToSubmit.duration}</p>
              <p><strong>Total:</strong> {formDataToSubmit.price}</p>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
              <button className="confirm-btn-proceed" onClick={handleConfirmSubmit}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification */}
      <Notification
        show={notification.show}
        type={notification.type}
        title={notification.title}
        message={notification.message}
        showButton={notification.showButton}
        buttonText={notification.buttonText}
        onButtonClick={notification.onButtonClick}
        onClose={() => setNotification({ show: false, type: 'info', title: '', message: '' })}
      />
    </>
  );
}