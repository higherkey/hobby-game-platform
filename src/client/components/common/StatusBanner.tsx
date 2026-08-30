import React from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import clsx from 'clsx';

export type StatusBannerVariant = 'success' | 'warning' | 'error' | 'info';

export interface StatusBannerProps {
  variant?: StatusBannerVariant;
  title?: string;
  message?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

const defaultIcons: Record<StatusBannerVariant, React.ReactNode> = {
  success: <CheckCircle2 size={16} />,
  warning: <AlertTriangle size={16} />,
  error: <AlertCircle size={16} />,
  info: <Info size={16} />
};

export const StatusBanner: React.FC<StatusBannerProps> = ({
  variant = 'info',
  title,
  message,
  icon,
  className,
  children
}) => {
  const activeIcon = icon !== undefined ? icon : defaultIcons[variant];

  return (
    <div
      className={clsx(
        'status-banner',
        `status-banner-${variant}`,
        `banner-${variant}`,
        className
      )}
      role={variant === 'error' || variant === 'warning' ? 'alert' : 'status'}
      aria-live="polite"
    >
      {activeIcon && (
        <div className="status-banner-icon" aria-hidden="true">
          {activeIcon}
        </div>
      )}
      <div className="status-banner-text">
        {title && <strong className="status-banner-title">{title}</strong>}
        {message && <div className="status-banner-message">{message}</div>}
        {children}
      </div>
    </div>
  );
};
