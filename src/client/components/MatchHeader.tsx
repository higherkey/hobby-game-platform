import React from 'react';
import { Dices, Monitor, Smartphone, Settings, LogOut } from 'lucide-react';

export interface MatchHeaderProps {
  gameTitle: string;
  gameTagline?: string;
  isDesktopView?: boolean;
  onToggleDesktopView?: () => void;
  showViewToggle?: boolean;
  onOpenSettings?: () => void;
  onLeaveGame: () => void;
}

export const MatchHeader: React.FC<MatchHeaderProps> = ({
  gameTitle,
  gameTagline,
  isDesktopView,
  onToggleDesktopView,
  showViewToggle = true,
  onOpenSettings,
  onLeaveGame
}) => {
  return (
    <header className="app-header">
      {/* Brand Identity & Game Info */}
      <div className="header-brand-group">
        <div className="header-brand-logo" aria-hidden="true">
          <Dices size={20} />
        </div>
        <div className="header-brand-text">
          <span className="header-brand-title">HobbyBoard</span>
          <span className="header-brand-tagline">{gameTagline || gameTitle}</span>
        </div>
      </div>

      {/* Match Actions */}
      <div className="header-actions">
        {/* View Switcher: Desktop Side-by-Side vs Mobile Stacked */}
        {showViewToggle && onToggleDesktopView !== undefined && (
          <button
            type="button"
            className={`view-toggle-btn ${isDesktopView ? 'active' : ''}`}
            onClick={onToggleDesktopView}
            title={isDesktopView ? 'Switch to Stacked View' : 'Switch to Side-by-Side Desktop View'}
            aria-pressed={isDesktopView}
          >
            {isDesktopView ? (
              <>
                <Monitor size={15} /> Side-by-Side
              </>
            ) : (
              <>
                <Smartphone size={15} /> Stacked View
              </>
            )}
          </button>
        )}

        {/* Room Settings Button */}
        {onOpenSettings && (
          <button
            type="button"
            className="btn-secondary room-settings-trigger-btn"
            onClick={onOpenSettings}
            title="Room Settings & House Rules"
          >
            <Settings size={15} /> Settings
          </button>
        )}

        {/* Exit Game Button */}
        <button
          type="button"
          className="btn-secondary"
          onClick={onLeaveGame}
          title="Exit Match"
        >
          <LogOut size={15} /> Exit Match
        </button>
      </div>
    </header>
  );
};
