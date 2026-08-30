import React, { useState } from 'react';
import { authStore, type UserSession } from '../auth/authStore';
import { User, Mail, Sparkles, LogOut, CheckCircle2, AlertCircle, X, ArrowRight, RefreshCw } from 'lucide-react';

export interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserSession;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, currentUser }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'magic-link' | 'verify'>('magic-link');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState(currentUser.username || '');
  const [guestName, setGuestName] = useState(currentUser.username || '');
  const [tokenInput, setTokenInput] = useState('');
  const [magicTokenData, setMagicTokenData] = useState<{ token?: string; simulatedUrl?: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdateGuestName = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) return;
    authStore.setGuestNickname(guestName.trim());
    setSuccessMessage('Nickname updated!');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 800);
  };

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!email || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authStore.requestMagicLink(email, username);
      setMagicTokenData(data);
      setSuccessMessage('Magic link generated! Check your email or use the 1-click login below.');
      setActiveTab('verify');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to generate magic link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyToken = async (tokenToUse?: string) => {
    const finalToken = tokenToUse || tokenInput.trim();
    if (!finalToken) {
      setErrorMessage('Please enter a token.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    try {
      await authStore.verifyMagicLink(finalToken);
      setSuccessMessage('Logged in successfully!');
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 700);
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid or expired token.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    authStore.logout();
    setSuccessMessage('Logged out to guest account.');
    setTimeout(() => {
      setSuccessMessage(null);
      onClose();
    }, 600);
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div className="modal-card">
        <div className="modal-header">
          <div className="modal-title-group">
            <h2 id="auth-modal-title" className="modal-title">
              {currentUser.isGuest ? 'Account & Profile' : 'User Account'}
            </h2>
            <span className="modal-subtitle">
              {currentUser.isGuest ? 'Playing as Guest' : `Signed in as ${currentUser.username}`}
            </span>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {errorMessage && (
          <div className="banner-error" role="alert">
            <AlertCircle size={16} />
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="banner-success" role="status">
            <CheckCircle2 size={16} />
            <span>{successMessage}</span>
          </div>
        )}

        {!currentUser.isGuest ? (
          /* Authenticated User View */
          <div className="auth-content-section">
            <div className="profile-info-card">
              <div className="profile-avatar">
                {currentUser.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="profile-details">
                <h3 className="profile-name">{currentUser.username}</h3>
                <span className="profile-email">{currentUser.email}</span>
                <span className="badge badge-green">Authenticated Member</span>
              </div>
            </div>

            <div className="auth-actions-group">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleLogout}
              >
                <LogOut size={16} /> Sign Out (Switch to Guest)
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Guest / Sign-in Tabs */
          <div className="auth-content-section">
            <div className="auth-nav-tabs">
              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'profile' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('profile');
                  setErrorMessage(null);
                }}
              >
                <User size={14} /> Guest Nickname
              </button>
              <button
                type="button"
                className={`auth-tab-btn ${activeTab === 'magic-link' || activeTab === 'verify' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('magic-link');
                  setErrorMessage(null);
                }}
              >
                <Sparkles size={14} /> Magic Link Sign-In
              </button>
            </div>

            {activeTab === 'profile' && (
              <form onSubmit={handleUpdateGuestName} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="guest-nickname-input">
                    Display Nickname
                  </label>
                  <input
                    id="guest-nickname-input"
                    type="text"
                    className="form-input"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Enter your guest nickname"
                    maxLength={30}
                    required
                  />
                  <span className="form-hint">
                    This name will appear on game boards and room lobbies.
                  </span>
                </div>

                <div className="auth-form-actions">
                  <button type="submit" className="btn-primary">
                    Save Nickname
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'magic-link' && (
              <form onSubmit={handleRequestMagicLink} className="auth-form">
                <div className="form-group">
                  <label className="form-label" htmlFor="magic-email-input">
                    Email Address
                  </label>
                  <input
                    id="magic-email-input"
                    type="email"
                    className="form-input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="magic-username-input">
                    Preferred Username (Optional)
                  </label>
                  <input
                    id="magic-username-input"
                    type="text"
                    className="form-input"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. TabletopMaster"
                    maxLength={30}
                  />
                  <span className="form-hint">
                    Passwordless authentication. We will issue a secure magic login token.
                  </span>
                </div>

                <div className="auth-form-actions">
                  <button type="submit" className="btn-primary" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw size={16} className="spin-animation" /> Sending Link...
                      </>
                    ) : (
                      <>
                        <Mail size={16} /> Send Magic Link
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {activeTab === 'verify' && (
              <div className="auth-form">
                <div className="verify-panel">
                  <p className="verify-intro">
                    Magic link token generated for <strong>{email}</strong>.
                  </p>

                  {magicTokenData?.token && (
                    <div className="simulated-login-box">
                      <span className="simulated-label">Development / Fast Login:</span>
                      <button
                        type="button"
                        className="btn-accent simulated-btn"
                        onClick={() => handleVerifyToken(magicTokenData.token)}
                        disabled={isLoading}
                      >
                        <Sparkles size={16} /> 1-Click Instant Sign-In
                      </button>
                    </div>
                  )}

                  <div className="form-group">
                    <label className="form-label" htmlFor="verify-token-input">
                      Or paste verification token manually:
                    </label>
                    <div className="input-with-button">
                      <input
                        id="verify-token-input"
                        type="text"
                        className="form-input"
                        value={tokenInput}
                        onChange={(e) => setTokenInput(e.target.value)}
                        placeholder="Paste token here"
                      />
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => handleVerifyToken()}
                        disabled={isLoading}
                      >
                        Verify <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setActiveTab('magic-link')}
                  >
                    Back to Email Input
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
