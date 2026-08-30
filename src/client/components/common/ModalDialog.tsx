import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import clsx from 'clsx';

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  titleId?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  maxWidth?: string;
}

export const ModalDialog: React.FC<ModalDialogProps> = ({
  isOpen,
  onClose,
  title,
  titleId,
  subtitle,
  icon,
  children,
  actions,
  className,
  maxWidth
}) => {
  // Handle ESC key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const activeTitleId = titleId || `modal-title-${title.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={activeTitleId}
      onClick={handleBackdropClick}
    >
      <div
        className={clsx('modal-card', className)}
        style={maxWidth ? { maxWidth } : undefined}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div className="settings-modal-title-group">
            {icon && <div className="settings-icon-chip" aria-hidden="true">{icon}</div>}
            <div>
              <h2 id={activeTitleId} className="modal-title">
                {title}
              </h2>
              {subtitle && <span className="modal-subtitle">{subtitle}</span>}
            </div>
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

        {/* Modal Body */}
        <div className="modal-body-content">
          {children}
        </div>

        {/* Modal Actions Footer */}
        {actions && (
          <div className="modal-actions-row">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};
