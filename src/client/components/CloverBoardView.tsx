import React from 'react';
import type { PlayerBoard, KeywordCard } from '../../games/so-clover/types';
import { getBoardKeywordPairs } from '../../games/so-clover/game';
import { KeywordCardView } from './KeywordCardView';
import { RotateCw, X, Lock, HelpCircle } from 'lucide-react';
import clsx from 'clsx';

export interface CloverBoardViewProps {
  board: PlayerBoard;
  isClueWritingPhase: boolean;
  selectedCardId: string | null;
  clueDrafts?: { north: string; east: string; south: string; west: string };
  onClueDraftChange?: (direction: 'north' | 'east' | 'south' | 'west', val: string) => void;
  onPlaceSelectedCard: (slotIndex: number) => void;
  onRotateSlot: (slotIndex: number) => void;
  onRemoveFromSlot: (slotIndex: number) => void;
  readOnly?: boolean;
}

export const CloverBoardView: React.FC<CloverBoardViewProps> = ({
  board,
  isClueWritingPhase,
  selectedCardId,
  clueDrafts,
  onClueDraftChange,
  onPlaceSelectedCard,
  onRotateSlot,
  onRemoveFromSlot,
  readOnly = false
}) => {
  const allCards: KeywordCard[] = [...board.secretCards, board.secretDistractor];

  // In clue writing phase, we display the secret cards in their initial secret solution layout
  const activeCards = isClueWritingPhase
    ? board.secretCards
    : board.currentSlots.map((slot) => {
        if (!slot) return null;
        return allCards.find((c) => c.id === slot.cardId) || null;
      });

  const activeRotations = isClueWritingPhase
    ? board.secretSolution.map((s) => s.rotation)
    : board.currentSlots.map((slot) => (slot ? slot.rotation : 0));

  // Keyword pairs for hint in clue writing mode
  const keywordPairs = isClueWritingPhase
    ? getBoardKeywordPairs(board.secretCards, board.secretSolution)
    : null;

  return (
    <div className="clover-board-container" role="region" aria-label="Clover Board">
      {/* 4 Clover leaf shapes */}
      <div className="clover-leaf-shape leaf-tl" aria-hidden="true" />
      <div className="clover-leaf-shape leaf-tr" aria-hidden="true" />
      <div className="clover-leaf-shape leaf-bl" aria-hidden="true" />
      <div className="clover-leaf-shape leaf-br" aria-hidden="true" />

      {/* 4 Clue Banners */}
      {/* NORTH BANNER */}
      <div className="clue-banner clue-banner-north">
        {isClueWritingPhase && !readOnly ? (
          <input
            type="text"
            className="clue-input-field"
            aria-label="North clue input"
            placeholder={
              keywordPairs
                ? `Clue for "${keywordPairs.north[0]}" & "${keywordPairs.north[1]}"`
                : 'North Clue'
            }
            value={clueDrafts?.north || ''}
            onChange={(e) => onClueDraftChange?.('north', e.target.value)}
            maxLength={25}
          />
        ) : (
          <span className="clue-text-display">{board.clues.north || '—'}</span>
        )}
      </div>

      {/* EAST BANNER */}
      <div className="clue-banner clue-banner-east">
        {isClueWritingPhase && !readOnly ? (
          <input
            type="text"
            className="clue-input-field"
            aria-label="East clue input"
            placeholder={
              keywordPairs
                ? `Clue for "${keywordPairs.east[0]}" & "${keywordPairs.east[1]}"`
                : 'East Clue'
            }
            value={clueDrafts?.east || ''}
            onChange={(e) => onClueDraftChange?.('east', e.target.value)}
            maxLength={25}
          />
        ) : (
          <span className="clue-text-display">{board.clues.east || '—'}</span>
        )}
      </div>

      {/* SOUTH BANNER */}
      <div className="clue-banner clue-banner-south">
        {isClueWritingPhase && !readOnly ? (
          <input
            type="text"
            className="clue-input-field"
            aria-label="South clue input"
            placeholder={
              keywordPairs
                ? `Clue for "${keywordPairs.south[0]}" & "${keywordPairs.south[1]}"`
                : 'South Clue'
            }
            value={clueDrafts?.south || ''}
            onChange={(e) => onClueDraftChange?.('south', e.target.value)}
            maxLength={25}
          />
        ) : (
          <span className="clue-text-display">{board.clues.south || '—'}</span>
        )}
      </div>

      {/* WEST BANNER */}
      <div className="clue-banner clue-banner-west">
        {isClueWritingPhase && !readOnly ? (
          <input
            type="text"
            className="clue-input-field"
            aria-label="West clue input"
            placeholder={
              keywordPairs
                ? `Clue for "${keywordPairs.west[0]}" & "${keywordPairs.west[1]}"`
                : 'West Clue'
            }
            value={clueDrafts?.west || ''}
            onChange={(e) => onClueDraftChange?.('west', e.target.value)}
            maxLength={25}
          />
        ) : (
          <span className="clue-text-display">{board.clues.west || '—'}</span>
        )}
      </div>

      {/* 2x2 Slots Grid */}
      <div className="clover-slots-grid">
        {[0, 1, 2, 3].map((slotIdx) => {
          const card = activeCards[slotIdx];
          const rotation = activeRotations[slotIdx];
          const isLocked = !isClueWritingPhase && board.lockedSlots[slotIdx];

          return (
            <div
              key={slotIdx}
              className={clsx(
                'clover-slot',
                !card && 'empty',
                isLocked && 'locked'
              )}
              role={!isClueWritingPhase && !readOnly && !isLocked && selectedCardId ? 'button' : undefined}
              tabIndex={!isClueWritingPhase && !readOnly && !isLocked && selectedCardId ? 0 : undefined}
              aria-label={`Clover slot ${slotIdx + 1}${card ? ' (occupied)' : ' (empty)'}`}
              onClick={() => {
                if (isClueWritingPhase || readOnly || isLocked) return;
                if (selectedCardId) {
                  onPlaceSelectedCard(slotIdx);
                }
              }}
              onKeyDown={(e) => {
                if (isClueWritingPhase || readOnly || isLocked) return;
                if ((e.key === 'Enter' || e.key === ' ') && selectedCardId) {
                  e.preventDefault();
                  onPlaceSelectedCard(slotIdx);
                }
              }}
            >
              {card ? (
                <>
                  <KeywordCardView card={card} rotation={rotation} />
                  {!isClueWritingPhase && !readOnly && !isLocked && (
                    <div className="slot-action-overlay">
                      <button
                        type="button"
                        className="slot-action-btn"
                        aria-label={`Rotate card in slot ${slotIdx + 1}`}
                        title="Rotate 90°"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRotateSlot(slotIdx);
                        }}
                      >
                        <RotateCw size={14} />
                      </button>
                      <button
                        type="button"
                        className="slot-action-btn"
                        aria-label={`Remove card from slot ${slotIdx + 1}`}
                        title="Return to Pool"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFromSlot(slotIdx);
                        }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {isLocked && (
                    <div className="slot-action-overlay">
                      <span className="slot-action-btn" title="Verified Correct" aria-label="Slot verified correct and locked">
                        <Lock size={12} />
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <div className="slot-placeholder" aria-hidden="true">
                  <HelpCircle size={24} />
                  <span>{selectedCardId ? 'Tap to place' : `Slot ${slotIdx + 1}`}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
