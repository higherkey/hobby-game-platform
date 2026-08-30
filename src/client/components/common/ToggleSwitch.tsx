import React from 'react';
import clsx from 'clsx';

export interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  ariaLabel?: string;
  className?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({
  id,
  checked,
  onChange,
  disabled = false,
  label,
  ariaLabel,
  className
}) => {
  return (
    <div className={clsx('toggle-switch-wrapper', className)}>
      <label className="toggle-switch" htmlFor={id}>
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          aria-label={ariaLabel || label}
        />
        <span className="toggle-slider" />
      </label>
      {label && (
        <label htmlFor={id} className="toggle-switch-label">
          {label}
        </label>
      )}
    </div>
  );
};
