import React, { useState } from 'react';
import { Settings, Shield } from 'lucide-react';
import { ModalDialog } from './common/ModalDialog';
import { StatusBanner } from './common/StatusBanner';
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

  const isClueWriting = phase === 'clue_writing';
  const isLocked = !isClueWriting;

  const handleApply = () => {
    onSaveOptions(draftOptions);
    onClose();
  };

  const actionButtons = (
    <>
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
    </>
  );

  return (
    <ModalDialog
      isOpen={isOpen}
      onClose={onClose}
      title="Room Settings"
      titleId="room-settings-title"
      subtitle={`Match ID: ${matchID}`}
      icon={<Settings size={18} />}
      className="room-settings-modal-card"
      actions={actionButtons}
    >
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
        <StatusBanner
          variant="warning"
          message={
            <span>
              Settings are locked during <strong>resolution</strong> to preserve scoring consistency.
            </span>
          }
        />
      )}

      <GameRoomSettings
        gameName={gameName}
        options={draftOptions}
        onOptionsChange={setDraftOptions}
        readOnly={isLocked}
        isHost={isHost}
      />
    </ModalDialog>
  );
};
