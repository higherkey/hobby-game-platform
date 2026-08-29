import React from 'react';
import type { KeywordCard } from '../../games/so-clover/types';
import { KeywordCardView } from './KeywordCardView';
import { RotateCw, CheckCircle2 } from 'lucide-react';

export interface CardTrayProps {
  cardPool: { card: KeywordCard; rotation: number }[];
  selectedCardId: string | null;
  onSelectCard: (cardId: string) => void;
  onRotateCard: (cardId: string) => void;
  disabled?: boolean;
}

export const CardTray: React.FC<CardTrayProps> = ({
  cardPool,
  selectedCardId,
  onSelectCard,
  onRotateCard,
  disabled = false
}) => {
  return (
    <div className="tray-card-container" role="region" aria-label="Available Keyword Cards Tray">
      <div className="tray-title">
        <span>Available Keywords Pool ({cardPool.length})</span>
        <span className="badge badge-green">Tap card to select & rotate</span>
      </div>

      {cardPool.length === 0 ? (
        <div className="empty-rooms-state">
          <CheckCircle2 size={32} aria-hidden="true" />
          <p>All cards placed on the board! Check your pairs and submit your guess.</p>
        </div>
      ) : (
        <div className="pool-cards-grid">
          {cardPool.map(({ card, rotation }) => {
            const isSelected = selectedCardId === card.id;

            return (
              <div key={card.id} className="pool-card-wrapper">
                <div className="pool-card-box">
                  <KeywordCardView
                    card={card}
                    rotation={rotation}
                    isSelected={isSelected}
                    onClick={() => {
                      if (!disabled) onSelectCard(card.id);
                    }}
                  />
                </div>
                <div className="pool-card-actions">
                  <button
                    type="button"
                    className="mini-action-btn"
                    aria-label={`Rotate card ${card.words[0]} 90 degrees`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onRotateCard(card.id);
                    }}
                    disabled={disabled}
                    title="Rotate 90° clockwise"
                  >
                    <RotateCw size={14} aria-hidden="true" /> Rotate
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
