import React from 'react';
import { Dices, Home, Play, Shield, User, Sparkles } from 'lucide-react';
import type { UserSession } from '../auth/authStore';

export interface NavbarProps {
  currentPage: 'home' | 'play' | 'admin';
  onNavigate: (page: 'home' | 'play' | 'admin') => void;
  currentUser: UserSession;
  onOpenAuthModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentPage,
  onNavigate,
  currentUser,
  onOpenAuthModal
}) => {
  return (
    <header className="app-header">
      {/* Brand Identity (Top-Left Anchor) */}
      <div className="header-brand-group">
        <button
          type="button"
          className="header-brand-link"
          onClick={() => onNavigate('home')}
          title="HobbyBoard Home"
        >
          <div className="header-brand-logo" aria-hidden="true">
            <Dices size={20} />
          </div>
          <div className="header-brand-text">
            <span className="header-brand-title">HobbyBoard</span>
            <span className="header-brand-tagline">Online Tabletop Platform</span>
          </div>
        </button>
      </div>

      {/* Main Navigation Links */}
      <nav className="header-nav" aria-label="Primary Navigation">
        <button
          type="button"
          className={`nav-link ${currentPage === 'home' ? 'active' : ''}`}
          onClick={() => onNavigate('home')}
          aria-current={currentPage === 'home' ? 'page' : undefined}
        >
          <Home size={16} />
          <span>Home</span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentPage === 'play' ? 'active' : ''}`}
          onClick={() => onNavigate('play')}
          aria-current={currentPage === 'play' ? 'page' : undefined}
        >
          <Play size={16} />
          <span>Play & Browse</span>
        </button>

        <button
          type="button"
          className={`nav-link ${currentPage === 'admin' ? 'active' : ''}`}
          onClick={() => onNavigate('admin')}
          aria-current={currentPage === 'admin' ? 'page' : undefined}
        >
          <Shield size={16} />
          <span>Admin</span>
        </button>
      </nav>

      {/* User Account / Profile Area */}
      <div className="header-account-area">
        <button
          type="button"
          className={`account-trigger-btn ${currentUser.isGuest ? 'guest-mode' : 'member-mode'}`}
          onClick={onOpenAuthModal}
          title={currentUser.isGuest ? 'Guest Profile (Click to sign in)' : `Member: ${currentUser.username}`}
        >
          <div className="account-avatar-chip">
            {currentUser.isGuest ? (
              <User size={14} />
            ) : (
              <Sparkles size={14} className="member-sparkle" />
            )}
          </div>
          <div className="account-details-inline">
            <span className="account-username">{currentUser.username}</span>
            <span className="account-role-tag">
              {currentUser.isGuest ? 'Guest' : 'Member'}
            </span>
          </div>
        </button>
      </div>
    </header>
  );
};
