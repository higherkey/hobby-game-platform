import React, { useState } from 'react';
import { Settings, X, Shield, Lock } from 'lucide-react';
import { GameRoomSettings } from './GameRoomSettings';

export interface RoomSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameName: string;
  matchID: string;
  isHost: boolean;
  phase: string;
  currentOptions: {
    allowSingleCardRotation?: boolean;
    [key: string]: any;
  };
  onSaveOptions: (updatedOptions: { allowSingleCardRotation?: boolean; [key: string]: any }) => void;
}

export const RoomSettingsModal: React.FC<RoomSettingsModalProps> = ({
  isOpen,
  onClose,
  gameName,
  matchID,
  isHost,
  phase,
  currentOptions,
  onSaveOptions
}) => {
  const [draftOptions, setDraftOptions] = useState(currentOptions);

  if (!isOpen) return null;

  const isClueWriting = phase === 'clue_writing';
  const isLocked = !isClueWriting;

  const handleApply = () => {
    onSaveOptions(draftOptions);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="room-settings-title">
      <div className="modal-card room-settings-modal-card">
        <div className="modal-header">
          <div className="settings-modal-title-group">
            <div className="settings-icon-chip">
              <Settings size={18} />
            </div>
            <div>
              <h2 id="room-settings-title" className="modal-title">
                Room Settings
              </h2>
              <span className="modal-subtitle">Match ID: {matchID}</span>
            </div>
          </div>
          <button
            type="button"
            className="modal-close-btn"
            onClick={onClose}
            aria-label="Close settings dialog"
          >
            <X size={18} />
          </button>
        </div>

        <div className="settings-modal-body">
          <div className="room-meta-banner">
            <div className="room-meta-item">
              <span className="room-meta-label">Role</span>
              <span className="room-meta-val">
                <Shield size={14} /> {isHost ? 'Room Host' : 'Player'}
              </span>
            </div>
            <div className="room-meta-item">
              <span className="room-meta-label">Phase</span>
              <span className="room-meta-val text-capitalize">
                {phase.replace('_', ' ')}
              </span>
            </div>
          </div>

          {isLocked && (
            <div className="settings-lock-warning" role="alert">
              <Lock size={15} />
              <span>
                Settings are locked during <strong>resolution</strong> to preserve scoring consistency.
              </span>
            </div>
          )}

          <GameRoomSettings
            gameName={gameName}
            options={draftOptions}
            onOptionsChange={setDraftOptions}
            readOnly={isLocked}
            isHost={isHost}
          />
        </div>

        <div className="modal-actions-row">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
          >
            {isHost && !isLocked ? 'Cancel' : 'Close'}
          </button>

          {isHost && !isLocked && (
            <button
              type="button"
              className="btn-primary"
              onClick={handleApply}
            >
              Apply Settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
