import React, { useEffect, useState } from 'react';
import { X, Eye, EyeOff, User, Mail, Lock, Camera, AlertCircle, KeyRound, Check } from 'lucide-react';
import { getRememberMePreference, setRememberMePreference, supabase, projectId } from '../lib/supabase';

interface AuthProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any) => void;
  defaultView?: 'signin' | 'signup' | 'reset';
}

export default function Auth({ isOpen, onClose, onSuccess, defaultView }: AuthProps) {
  const [isLogin, setIsLogin] = useState(defaultView !== 'signup');
  const [isForgotPassword, setIsForgotPassword] = useState(defaultView === 'reset');
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'email' | 'verify' | 'reset' | 'success'>('email');
  const [resetCode, setResetCode] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSignupSuccessDialog, setShowSignupSuccessDialog] = useState(false);
  const [signupSuccessEmail, setSignupSuccessEmail] = useState('');
  const [rememberMe, setRememberMe] = useState(getRememberMePreference());
  const [privacyConsent, setPrivacyConsent] = useState(false);
  const [termsConsent, setTermsConsent] = useState(false);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(false);
  const [showTermsNotice, setShowTermsNotice] = useState(false);
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

  const buildUserSession = (userProfile: any) => ({
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
  });

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

  useEffect(() => {
    if (!isOpen) return;

    const openReset = defaultView === 'reset';
    setIsLogin(defaultView !== 'signup');
    setIsForgotPassword(openReset);
    setForgotPasswordStep('email');
    setErrors({});
    setLoading(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setShowConfirmDialog(false);
    setShowSignupSuccessDialog(false);
    setShowPrivacyNotice(false);
    setShowTermsNotice(false);
    setSignupSuccessEmail('');
    setPrivacyConsent(false);
    setTermsConsent(false);
    setFormData({
      firstName: '',
      lastName: '',
      username: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    setResetEmail('');
    setResetCode('');
    setGeneratedCode('');
    setResetFormData({ newPassword: '', confirmNewPassword: '' });

    if (openReset) {
      setResetEmail('');
      setResetCode('');
      setGeneratedCode('');
      setResetFormData({ newPassword: '', confirmNewPassword: '' });
    }
  }, [defaultView, isOpen]);

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

    if (!isLogin && !privacyConsent) {
      newErrors.privacyConsent = 'You must agree to the Data Privacy Notice before creating an account';
    }

    if (!isLogin && !termsConsent) {
      newErrors.termsConsent = 'You must agree to the Terms and Conditions before creating an account';
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
      setRememberMePreference(true);
      console.log('Attempting signup with Supabase confirmation flow...');

      const { error } = await supabase.auth.signUp({
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
        setErrors({ general: error.message || 'Unable to create account right now.' });
        setLoading(false);
        return;
      }

      setSignupSuccessEmail(formData.email);
      setShowSignupSuccessDialog(true);
      setShowConfirmDialog(false);
      setPrivacyConsent(false);
      setTermsConsent(false);
      setFormData({ firstName: '', lastName: '', username: '', email: '', password: '', confirmPassword: '' });
      setIsLogin(true);
      setShowPassword(false);
      setShowConfirmPassword(false);
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
      setLoading(true);
      setErrors({});

      try {
        console.log('Attempting login with Supabase...');
        
        setRememberMePreference(rememberMe);

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

        const activeSession = data.session
          ? (await supabase.auth.setSession({
              access_token: data.session.access_token,
              refresh_token: data.session.refresh_token,
            })).data.session ?? data.session
          : (await supabase.auth.getSession()).data.session;

        const authUser = activeSession?.user ?? data.user ?? (await supabase.auth.getUser()).data.user;

        if (!authUser) {
          setErrors({ general: 'Login succeeded but the active session could not be restored. Please try again.' });
          setLoading(false);
          return;
        }

        console.log('Login successful, fetching profile...');

        const userProfile = await fetchUserProfileWithRetry(authUser.id);

        if (!userProfile) {
          console.error('Profile fetch error: no profile found after retry. Deferring to app auth listener.');
          onClose();
          return;
        }

        onSuccess(buildUserSession(userProfile));
        onClose();
      } catch (error: any) {
        console.error('Login process error:', error);
        setErrors({ general: error.message || 'An error occurred during login' });
      } finally {
        setLoading(false);
      }
    } else {
      setShowConfirmDialog(true);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    if (errors[e.target.name]) {
      setErrors((prev: any) => ({ ...prev, [e.target.name]: '' }));
    }
  };

  const handleResetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setResetFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
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
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        setErrors({ general: error.message || 'Failed to send reset email' });
      } else {
        setForgotPasswordStep('success');
        setErrors({ success: 'Password reset instructions have been sent to your email!' });
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
    setIsLogin(true);
    setForgotPasswordStep('email');
    setResetEmail('');
    setResetCode('');
    setGeneratedCode('');
    setResetFormData({ newPassword: '', confirmNewPassword: '' });
    setErrors({});
  };

  if (!isOpen) return null;

  if (isForgotPassword) {
    return (
      <div className="auth-overlay" onClick={() => {
        setIsForgotPassword(false);
    setIsLogin(true);
        setForgotPasswordStep('email');
      }}>
        <div className="auth-modal" onClick={(e) => e.stopPropagation()}>
          <button className="auth-close" onClick={() => {
            setIsForgotPassword(false);
    setIsLogin(true);
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
              {forgotPasswordStep === 'success' && 'Check Your Email'}
            </h2>
            <p>
              {forgotPasswordStep === 'email' && 'Enter your email to receive a verification code'}
              {forgotPasswordStep === 'verify' && 'Enter the 6-digit code sent to your email'}
              {forgotPasswordStep === 'reset' && 'Create a new password for your account'}
              {forgotPasswordStep === 'success' && 'Use the link in your email to open the secure password reset page'}
            </p>
          </div>

          
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

            
            {isLogin && (
              <label className="remember-me">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <span>Remember me</span>
              </label>
            )}

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

            {!isLogin && (
              <>
                <div className="privacy-consent-block">
                  <label className="privacy-consent-check">
                    <input
                      type="checkbox"
                      checked={termsConsent}
                      onChange={(e) => {
                        setTermsConsent(e.target.checked);
                        if (errors.termsConsent) {
                          setErrors((prev: any) => ({ ...prev, termsConsent: '' }));
                        }
                      }}
                    />
                    <span>
                      I agree to the <button type="button" className="inline-consent-link" onClick={() => setShowTermsNotice(true)}>Terms and Conditions</button> of Tutok Pitik Studios before creating my account.
                    </span>
                  </label>
                  <p className="privacy-consent-note">
                    Please read the terms carefully before proceeding with account registration.
                  </p>
                  {errors.termsConsent && <span className="error-text">{errors.termsConsent}</span>}
                </div>

                <div className="privacy-consent-block">
                  <label className="privacy-consent-check">
                    <input
                      type="checkbox"
                      checked={privacyConsent}
                      onChange={(e) => {
                        setPrivacyConsent(e.target.checked);
                        if (errors.privacyConsent) {
                          setErrors((prev: any) => ({ ...prev, privacyConsent: '' }));
                        }
                      }}
                    />
                    <span>
                      I agree to the <button type="button" className="inline-consent-link" onClick={() => setShowPrivacyNotice(true)}>Data Privacy Notice</button> and allow Tutok Pitik Studios to collect, store, and use my personal information only for account creation, booking management, customer support, and photography service updates.
                    </span>
                  </label>
                  <p className="privacy-consent-note">
                    Your personal information will be handled confidentially and used only for legitimate service-related purposes.
                  </p>
                  {errors.privacyConsent && <span className="error-text">{errors.privacyConsent}</span>}
                </div>
              </>
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
                setPrivacyConsent(false);
                setTermsConsent(false);
                setShowPassword(false);
                setShowConfirmPassword(false);
              }}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </button>
            </p>
          </div>
        </div>
      </div>

      
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
              <p><strong>Terms and Conditions:</strong> Confirmed</p>
              <p><strong>Privacy Consent:</strong> Confirmed</p>
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

      {showTermsNotice && (
        <div className="modal-overlay active" onClick={() => setShowTermsNotice(false)}>
          <div className="confirm-dialog consent-read-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <Check size={48} />
            </div>
            <h3>Terms and Conditions</h3>
            <div className="confirm-details consent-read-content">
              <p><strong>Account Use:</strong> Your account must be used only for legitimate Tutok Pitik Studios services such as bookings, inquiries, and profile management.</p>
              <p><strong>Accurate Information:</strong> You agree to provide true, complete, and updated personal information during registration and booking.</p>
              <p><strong>Booking Compliance:</strong> All bookings are subject to studio review, schedule availability, payment verification, and service policies.</p>
              <p><strong>User Responsibility:</strong> You are responsible for keeping your account credentials secure and for activities made under your account.</p>
              <p><strong>Service Changes:</strong> Tutok Pitik Studios may update pricing, transportation adjustments, and service requirements when necessary.</p>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-proceed" onClick={() => setShowTermsNotice(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showPrivacyNotice && (
        <div className="modal-overlay active" onClick={() => setShowPrivacyNotice(false)}>
          <div className="confirm-dialog consent-read-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <Check size={48} />
            </div>
            <h3>Data Privacy Notice</h3>
            <div className="confirm-details consent-read-content">
              <p><strong>Collection:</strong> Tutok Pitik Studios collects your name, email, account details, booking information, and uploaded files only as needed to deliver studio services.</p>
              <p><strong>Use:</strong> Your information is used for account creation, booking management, customer communication, payment review, and service updates.</p>
              <p><strong>Protection:</strong> Reasonable steps are taken to keep your personal data secure and accessible only for legitimate system and business purposes.</p>
              <p><strong>Limited Sharing:</strong> Your information will not be shared unnecessarily and will only be used in connection with the service features you requested.</p>
              <p><strong>Your Consent:</strong> By creating an account, you acknowledge and agree to the processing of your information for these stated purposes.</p>
            </div>
            <div className="confirm-actions">
              <button className="confirm-btn-proceed" onClick={() => setShowPrivacyNotice(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {showSignupSuccessDialog && (
        <div className="modal-overlay active" onClick={() => setShowSignupSuccessDialog(false)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">
              <Check size={48} />
            </div>
            <h3>Account Created</h3>
            <p>Your account was created successfully. Please click the confirmation email we sent before signing in.</p>
            <div className="confirm-details">
              <p><strong>Email:</strong> {signupSuccessEmail}</p>
              <p><strong>Next Step:</strong> Open your inbox and click the confirmation link to activate your account.</p>
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-btn-proceed"
                onClick={() => {
                  setShowSignupSuccessDialog(false);
                  setIsLogin(true);
                }}
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}