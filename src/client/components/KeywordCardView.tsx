import React from 'react';
import type { KeywordCard } from '../../games/so-clover/types';
import clsx from 'clsx';

export interface KeywordCardViewProps {
  card: KeywordCard;
  rotation?: number; // 0, 1, 2, 3
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
}

export const KeywordCardView: React.FC<KeywordCardViewProps> = ({
  card,
  rotation = 0,
  isSelected = false,
  onClick,
  className
}) => {
  const normRotation = ((rotation % 4) + 4) % 4;
  const rotClass = `rot-${normRotation * 90}`;

  return (
    <div
      className={clsx('keyword-card', rotClass, isSelected && 'selected', className)}
      onClick={onClick}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Keyword card: Top "${card.words[0]}", Right "${card.words[1]}", Bottom "${card.words[2]}", Left "${card.words[3]}", rotated ${normRotation * 90} degrees`}
      aria-pressed={isSelected}
    >
      <div className="keyword-card-center-hole" aria-hidden="true" />
      <span className="card-word word-top" aria-hidden="true">{card.words[0]}</span>
      <span className="card-word word-right" aria-hidden="true">{card.words[1]}</span>
      <span className="card-word word-bottom" aria-hidden="true">{card.words[2]}</span>
      <span className="card-word word-left" aria-hidden="true">{card.words[3]}</span>
    </div>
  );
};
