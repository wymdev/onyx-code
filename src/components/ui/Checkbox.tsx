import React from 'react';
import { Check } from 'lucide-react';

interface CheckboxProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: React.ReactNode;
  description?: React.ReactNode;
}

export default function Checkbox({
  id,
  checked,
  onChange,
  disabled = false,
  className = '',
  label,
  description,
}: CheckboxProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!disabled) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onChange(!checked);
    }
  };

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={disabled ? -1 : 0}
      role="checkbox"
      aria-checked={checked}
      id={id}
      className={`inline-flex items-start gap-2 cursor-pointer select-none group outline-none focus-visible:ring-1 focus-visible:ring-[#007acc] rounded ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
    >
      <div
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border transition-all duration-150 mt-0.5 ${
          checked
            ? 'bg-[#007acc] border-[#007acc] text-white shadow-sm'
            : 'bg-[#1e1e1e] border-[#3e3e42] text-transparent group-hover:border-[#007acc] group-hover:bg-[#252526]'
        }`}
      >
        <Check
          size={11}
          strokeWidth={3}
          className={`transform transition-transform duration-100 ${
            checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
          }`}
        />
      </div>

      {(label || description) && (
        <div className="flex flex-col text-xs leading-snug">
          {label && <span className="text-[#cccccc] group-hover:text-white font-medium">{label}</span>}
          {description && <span className="text-[#858585] text-[11px] mt-0.5">{description}</span>}
        </div>
      )}
    </div>
  );
}
