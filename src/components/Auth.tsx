import React, { useState } from 'react';
import { X, Eye, EyeOff, User, Mail, Lock, Camera, AlertCircle, KeyRound, Check } from 'lucide-react';
import { supabase, projectId, publicAnonKey } from '../lib/supabase';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  defaultView?: 'signin' | 'signup' | 'reset';
}

export default function Auth({ isOpen, onClose, onSuccess, defaultView }: AuthProps) {
  const [isLogin, setIsLogin] = useState(defaultView === 'signin' || defaultView === 'reset' ? true : false);
  const [isForgotPassword, setIsForgotPassword] = useState(defaultView === 'reset' ? true : false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'verify' | 'reset' | 'success'>('email');
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [resetFormData, setResetFormData] = useState({
    newPassword: '',
    confirmNewPassword: ''
  });
  const [errors, setErrors] = useState<any>({});

  const validateForm = () => {
    const newErrors: any = {};

    if (!isLogin && !formData.firstName.trim()) {
      newErrors.firstName = 'First name is required';
    }

    if (!isLogin && !formData.lastName.trim()) {
      newErrors.lastName = 'Last name is required';
    }

    if (!isLogin && !formData.username.trim()) {
      newErrors.username = 'Username is required';
    } else if (!isLogin && formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Email is invalid';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }

    if (!isLogin && formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleConfirmCreate = () => {
    setShowConfirmDialog(false);
    proceedWithSignup();
  };

  const proceedWithSignup = async () => {
    setLoading(true);
    setErrors({});

    try {
      console.log('Attempting signup with Supabase...');
      
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: `${formData.firstName} ${formData.lastName}`,
            username: formData.username,
            role: 'customer'
          }
        }
      });

      if (error) {
        console.error('Signup error:', error);
        setErrors({ general: error.message });
        setLoading(false);
        return;
      }

      console.log('Signup successful:', data);

      // Wait for database trigger to create profile
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Send welcome email
      const fullName = `${formData.firstName} ${formData.lastName}`;
      try {
        await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-welcome-email`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${publicAnonKey}`,
            },
            body: JSON.stringify({ email: formData.email, fullName }),
          }
        );
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
      }

      const userSession = {
        id: data.user?.id,
        firstName: formData.firstName,
        lastName: formData.lastName,
        username: formData.username,
        fullName: fullName,
        email: formData.email,
        role: 'customer',
        profilePicture: '',
        joinDate: new Date().toISOString()
      };

      onSuccess(userSession);
      onClose();
      alert('Account created successfully! A welcome email has been sent to your inbox.');
    } catch (error: any) {
      console.error('Signup process error:', error);
      setErrors({ general: error.message || 'An error occurred during signup' });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    if (isLogin) {
      // LOGIN with Supabase
      setLoading(true);
      setErrors({});

      try {
        console.log('Attempting login with Supabase...');
        
        const { data, error } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (error) {
          console.error('Login error:', error);
          setErrors({ general: error.message });
          setLoading(false);
          return;
        }

        console.log('Login successful, fetching profile...');

        // Get user profile from database
        const { data: userProfile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Profile fetch error:', profileError);
          setErrors({ general: 'Failed to load user profile' });
          setLoading(false);
          return;
        }

        const userSession = {
          id: userProfile.id,
          firstName: userProfile.full_name?.split(' ')[0] || '',
          lastName: userProfile.full_name?.split(' ').slice(1).join(' ') || '',
          username: userProfile.username || '',
          fullName: userProfile.full_name,
          email: userProfile.email,
          role: userProfile.role,
          profilePicture: userProfile.profile_picture_url || '',
          joinDate: userProfile.created_at
        };

        onSuccess(userSession);
        onClose();
      } catch (error: any) {
        console.error('Login process error:', error);
        setErrors({ general: error.message || 'An error occurred during login' });
      } finally {
        setLoading(false);
      }
    } else {
      // Show confirmation dialog before creating account
      setShowConfirmDialog(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors((prev: any) => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors((prev: any) => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleForgotPasswordClick = () => {
    setIsForgotPassword(true);
    setForgotPasswordStep('email');
    setResetEmail('');
    setResetCode('');
    setGeneratedCode('');
    setResetFormData({ newPassword: '', confirmNewPassword: '' });
    setErrors({});
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrors({});

    if (!resetEmail.trim()) {
      setErrors({ general: 'Email is required' });
      setLoading(false);
      return;
    }

    if (!/\S+@\S+\.\S+/.test(resetEmail)) {
      setErrors({ general: 'Email is invalid' });
      setLoading(false);
      return;
    }

    try {
      // Send password reset email via server
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-032fda65/send-password-reset-email`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ email: resetEmail }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setForgotPasswordStep('success');
        setErrors({ success: 'Password reset instructions have been sent to your email!' });
      } else {
        setErrors({ general: data.error || 'Failed to send reset email' });
      }
    } catch (error: any) {
      console.error('Password reset error:', error);
      setErrors({ general: 'An error occurred. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    if (!resetCode.trim()) {
      setErrors({ general: 'Verification code is required' });
      return;
    }

    if (resetCode === generatedCode) {
      setForgotPasswordStep('reset');
      setErrors({});
    } else {
      setErrors({ general: 'Invalid verification code. Please try again.' });
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: any = {};

    if (!resetFormData.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (resetFormData.newPassword.length < 6) {
      newErrors.newPassword = 'Password must be at least 6 characters';
    }

    if (resetFormData.newPassword !== resetFormData.confirmNewPassword) {
      newErrors.confirmNewPassword = 'Passwords do not match';
    }

    setErrors(newErrors);

    if (Object.keys(newErrors).length === 0) {
      const { data, error } = supabase.auth.updateUser({
        password: resetFormData.newPassword
      });

      if (error) {
        setErrors({ general: error.message });
      } else {
        setForgotPasswordStep('success');
      }
    }
  };

  const handleBackToLogin = () => {
    setIsForgotPassword(false);
    setForgotPasswordStep('email');
    setResetEmail('');
    setResetCode('');
    setGeneratedCode('');
    setResetFormData({ newPassword: '', confirmNewPassword: '' });
    setErrors({});
  };

  // Don't render if not open
  if (!isOpen) return null;

  // Render Forgot Password Flow
  if (isForgotPassword) {
    return (
      <div className="auth-overlay" onClick={() => {
        setIsForgotPassword(false);
        setForgotPasswordStep('email');
      }}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={() => {
            setIsForgotPassword(false);
            setForgotPasswordStep('email');
          }}>
            <X size={24} />
          </button>

          <div className="auth-header">
            <div className="auth-icon">
              {forgotPasswordStep === 'success' ? <Check size={32} /> : <KeyRound size={32} />}
            </div>
            <h2>
              {forgotPasswordStep === 'email' && 'Forgot Password'}
              {forgotPasswordStep === 'verify' && 'Verify Code'}
              {forgotPasswordStep === 'reset' && 'Reset Password'}
              {forgotPasswordStep === 'success' && 'Password Reset Successful'}
            </h2>
            <p>
              {forgotPasswordStep === 'email' && 'Enter your email to receive a verification code'}
              {forgotPasswordStep === 'verify' && 'Enter the 6-digit code sent to your email'}
              {forgotPasswordStep === 'reset' && 'Create a new password for your account'}
              {forgotPasswordStep === 'success' && 'You can now sign in with your new password'}
            </p>
          </div>

          {/* Step 1: Enter Email */}
          {forgotPasswordStep === 'email' && (
            <>
              <form onSubmit={handleSendCode} className="auth-form">
                {errors.general && (
                  <div className="auth-error-banner">
                    {errors.general}
                  </div>
                )}
                {errors.success && (
                  <div className="auth-success-banner">
                    {errors.success}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="resetEmail">
                    <Mail size={18} />
                    Email Address
                  </label>
                  <input
                    type="email"
                    id="resetEmail"
                    name="resetEmail"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    placeholder="Enter your email"
                    autoFocus
                  />
                </div>

                <button type="submit" className="auth-submit-btn">
                  Send Verification Code
                </button>
              </form>

              <div className="auth-switch">
                <p>
                  Remember your password?{' '}
                  <button onClick={handleBackToLogin}>
                    Sign In
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Step 2: Verify Code */}
          {forgotPasswordStep === 'verify' && (
            <>
              <form onSubmit={handleVerifyCode} className="auth-form">
                {errors.general && (
                  <div className="auth-error-banner">
                    {errors.general}
                  </div>
                )}
                {errors.success && (
                  <div className="auth-success-banner">
                    {errors.success}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="resetCode">
                    <KeyRound size={18} />
                    Verification Code
                  </label>
                  <input
                    type="text"
                    id="resetCode"
                    name="resetCode"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    autoFocus
                  />
                  <span className="form-hint">Check your email for the verification code</span>
                </div>

                <button type="submit" className="auth-submit-btn">
                  Verify Code
                </button>
              </form>

              <div className="auth-switch">
                <p>
                  Didn't receive code?{' '}
                  <button onClick={() => {
                    setForgotPasswordStep('email');
                    setResetCode('');
                    setGeneratedCode('');
                  }}>
                    Resend
                  </button>
                </p>
              </div>
            </>
          )}

          {/* Step 3: Reset Password */}
          {forgotPasswordStep === 'reset' && (
            <>
              <form onSubmit={handleResetPassword} className="auth-form">
                {errors.general && (
                  <div className="auth-error-banner">
                    {errors.general}
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="newPassword">
                    <Lock size={18} />
                    New Password
                  </label>
                  <div className="password-input">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      id="newPassword"
                      name="newPassword"
                      value={resetFormData.newPassword}
                      onChange={handleResetChange}
                      placeholder="Enter new password"
                      className={errors.newPassword ? 'error' : ''}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.newPassword && <span className="error-text">{errors.newPassword}</span>}
                </div>

                <div className="form-group">
                  <label htmlFor="confirmNewPassword">
                    <Lock size={18} />
                    Confirm New Password
                  </label>
                  <div className="password-input">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      id="confirmNewPassword"
                      name="confirmNewPassword"
                      value={resetFormData.confirmNewPassword}
                      onChange={handleResetChange}
                      placeholder="Confirm new password"
                      className={errors.confirmNewPassword ? 'error' : ''}
                    />
                    <button
                      type="button"
                      className="password-toggle"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  {errors.confirmNewPassword && <span className="error-text">{errors.confirmNewPassword}</span>}
                </div>

                <button type="submit" className="auth-submit-btn">
                  Reset Password
                </button>
              </form>
            </>
          )}

          {/* Step 4: Success */}
          {forgotPasswordStep === 'success' && (
            <>
              <div className="success-message">
                <div className="success-icon">
                  <Check size={48} />
                </div>
                <p>Your password has been successfully reset. You can now sign in with your new password.</p>
              </div>

              <button 
                className="auth-submit-btn"
                onClick={handleBackToLogin}
              >
                Go to Sign In
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // Main Auth Modal (Login/Signup)
  return (
    <>
      <div className="auth-overlay" onClick={onClose}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={onClose}>
            <X size={24} />
          </button>

          <div className="auth-header">
            <div className="auth-icon">
              <Camera size={32} />
            </div>
            <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
            <p>{isLogin ? 'Sign in to access your bookings and profile' : 'Join Tutok Pitik Studios today'}</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            {errors.general && (
              <div className="auth-error-banner">
                {errors.general}
              </div>
            )}

            {!isLogin && (
              <div className="form-grid-two">
                <div className="form-group">
                  <label htmlFor="firstName">
                    <User size={18} />
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    placeholder="Enter first name"
                    className={errors.firstName ? 'error' : ''}
                  />
                  {errors.firstName && <span className="error-text">{errors.firstName}</span>}
                </div>
                <div className="form-group">
                  <label htmlFor="lastName">
                    <User size={18} />
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    placeholder="Enter last name"
                    className={errors.lastName ? 'error' : ''}
                  />
                  {errors.lastName && <span className="error-text">{errors.lastName}</span>}
                </div>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="username">
                  <User size={18} />
                  Username
                </label>
                <input
                  type="text"
                  id="username"
                  name="username"
                  value={formData.username}
                  onChange={handleChange}
                  placeholder="Choose a username"
                  className={errors.username ? 'error' : ''}
                />
                {errors.username && <span className="error-text">{errors.username}</span>}
              </div>
            )}

            <div className="form-group">
              <label htmlFor="email">
                <Mail size={18} />
                Email Address
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className={errors.email ? 'error' : ''}
              />
              {errors.email && <span className="error-text">{errors.email}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="password">
                <Lock size={18} />
                Password
              </label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  className={errors.password ? 'error' : ''}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <span className="error-text">{errors.password}</span>}
            </div>

            {/* Forgot Password Link (Only on Login) */}
            {isLogin && (
              <div className="forgot-password-link">
                <button 
                  type="button" 
                  onClick={handleForgotPasswordClick}
                  className="text-link"
                >
                  Forgot Password?
                </button>
              </div>
            )}

            {!isLogin && (
              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <Lock size={18} />
                  Confirm Password
                </label>
                <div className="password-input">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="Confirm your password"
                    className={errors.confirmPassword ? 'error' : ''}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.confirmPassword && <span className="error-text">{errors.confirmPassword}</span>}
              </div>
            )}

            <button type="submit" className="auth-submit-btn">
              {isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="auth-switch">
            <p>
              {isLogin ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => {
                setIsLogin(!isLogin);
                setFormData({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });
                setErrors({});
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="modal-overlay active" onClick={() => setShowConfirmDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <AlertCircle size={48} />
            </div>
            <h3>Confirm Account Creation</h3>
            <p>Are you sure you want to create an account with this information?</p>
            <div className="confirm-details">
              <p><strong>Name:</strong> {formData.firstName} {formData.lastName}</p>
              <p><strong>Username:</strong> {formData.username}</p>
              <p><strong>Email:</strong> {formData.email}</p>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-cancel" onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
              <button className="confirm-btn-proceed" onClick={handleConfirmCreate}>
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}