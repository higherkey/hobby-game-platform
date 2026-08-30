import React from 'react';
import { Users } from 'lucide-react';
import clsx from 'clsx';

export interface PlayerSeatOption {
  id: string;
  name: string;
}

export interface HotseatSelectorProps {
  playerOrder: string[];
  players: Record<string, { playerName?: string }>;
  activePlayerId: string;
  onSelectPlayer: (playerId: string) => void;
  className?: string;
}

export const HotseatSelector: React.FC<HotseatSelectorProps> = ({
  playerOrder,
  players,
  activePlayerId,
  onSelectPlayer,
  className
}) => {
  if (!playerOrder || playerOrder.length <= 1) return null;

  return (
    <div className={clsx('hotseat-selector-box', className)}>
      <Users size={14} className="text-muted" aria-hidden="true" />
      <select
        value={activePlayerId}
        onChange={(e) => onSelectPlayer(e.target.value)}
        className="form-input hotseat-select"
        aria-label="Change active local seat"
      >
        {playerOrder.map((pid) => (
          <option key={pid} value={pid}>
            Seat: {players[pid]?.playerName || `Player ${pid}`}
          </option>
        ))}
      </select>
    </div>
  );
};
