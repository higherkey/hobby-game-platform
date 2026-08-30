import React from 'react';
import { SlidersHorizontal, Sparkles, HelpCircle, Check, Info } from 'lucide-react';

export interface GameRoomSettingsProps {
  gameName: string;
  options: {
    allowSingleCardRotation?: boolean;
    [key: string]: any;
  };
  onOptionsChange?: (updatedOptions: { allowSingleCardRotation?: boolean; [key: string]: any }) => void;
  readOnly?: boolean;
  isHost?: boolean;
}

export const GameRoomSettings: React.FC<GameRoomSettingsProps> = ({
  gameName,
  options,
  onOptionsChange,
  readOnly = false,
  isHost = true
}) => {
  const allowSingleCardRotation = Boolean(options.allowSingleCardRotation);

  const handleToggleSingleCardRotation = (checked: boolean) => {
    if (readOnly || !isHost || !onOptionsChange) return;
    onOptionsChange({
      ...options,
      allowSingleCardRotation: checked
    });
  };

  if (gameName !== 'so-clover') {
    return (
      <div className="settings-panel-empty">
        <SlidersHorizontal size={20} className="text-muted" />
        <p className="text-sm text-muted">No custom house rules available for this game mode.</p>
      </div>
    );
  }

  return (
    <div className="room-settings-container">
      <div className="settings-section-header">
        <div className="settings-header-title">
          <Sparkles size={16} className="text-accent" />
          <span>House Rules & Variants</span>
        </div>
        <span className="badge badge-yellow">Customizable</span>
      </div>

      <div className="settings-options-list">
        {/* House Rule 1: Single Card Rotation */}
        <div className={`setting-card ${allowSingleCardRotation ? 'active' : ''}`}>
          <div className="setting-card-main">
            <div className="setting-info">
              <div className="setting-title-row">
                <label
                  htmlFor="setting-house-rule-rotate"
                  className="setting-title"
                >
                  Flexible Setup: Rotate 1 Card
                </label>
                {allowSingleCardRotation && (
                  <span className="badge badge-green">
                    <Check size={12} /> Active
                  </span>
                )}
              </div>
              <p className="setting-description">
                Allows each player to rotate at most 1 card on their clover board during secret clue writing to customize keyword pairs.
              </p>
            </div>

            <div className="setting-control">
              {readOnly || !isHost ? (
                <span className={`badge ${allowSingleCardRotation ? 'badge-green' : 'badge-gray'}`}>
                  {allowSingleCardRotation ? 'Enabled' : 'Disabled'}
                </span>
              ) : (
                <label className="toggle-switch" htmlFor="setting-house-rule-rotate">
                  <input
                    type="checkbox"
                    id="setting-house-rule-rotate"
                    checked={allowSingleCardRotation}
                    onChange={(e) => handleToggleSingleCardRotation(e.target.checked)}
                    aria-label="Toggle Single Card Rotation House Rule"
                  />
                  <span className="toggle-slider" />
                </label>
              )}
            </div>
          </div>

          <div className="setting-card-footer">
            <Info size={13} className="text-muted" />
            <span>Standard official rules keep cards in their dealt rotation.</span>
          </div>
        </div>
      </div>

      {!isHost && (
        <div className="settings-notice-box">
          <HelpCircle size={14} />
          <span>Only the Room Host can modify match settings.</span>
        </div>
      )}
    </div>
  );
};
