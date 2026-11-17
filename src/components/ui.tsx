import { Search, ChevronLeft, AlertTriangle, Info, RotateCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

// ─── Field ────────────────────────────────────────────────────────────────────
export function Field({
  label,
  placeholder,
  icon,
  suffix,
  type = 'text',
  textarea = false,
  value,
  onChange,
  required = false,
  inputRef,
}: {
  label: string;
  placeholder: string;
  icon?: ReactNode;
  suffix?: ReactNode;
  type?: string;
  textarea?: boolean;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  required?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field-input">
        {icon ? <span className="field-icon">{icon}</span> : null}
        {textarea
          ? <textarea placeholder={placeholder} rows={5} value={value} onChange={onChange} required={required} />
          : <input ref={inputRef} type={type} placeholder={placeholder} value={value} onChange={onChange} required={required} />}
        {suffix ? <span className="field-suffix">{suffix}</span> : null}
      </div>
    </label>
  );
}

// ─── SearchPanel ──────────────────────────────────────────────────────────────
export function SearchPanel({
  title,
  placeholder,
  compact = false,
  value,
  onChange,
}: {
  title: string;
  placeholder: string;
  compact?: boolean;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [localValue, setLocalValue] = useState('');
  const currentValue = value !== undefined ? value : localValue;

  return (
    <div className={`search-panel ${compact ? 'compact' : ''}`}>
      {title ? <h3>{title}</h3> : null}
      <div className="search-field">
        <Search size={16} />
        <input
          type="text"
          placeholder={placeholder}
          value={currentValue}
          onChange={(e) => {
            if (value === undefined) setLocalValue(e.target.value);
            if (onChange) onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

// ─── FilterGroup ──────────────────────────────────────────────────────────────
export function FilterGroup({
  title,
  options,
  selected,
  onChange,
}: {
  title: string;
  options: string[];
  selected?: string;
  onChange?: (opt: string) => void;
}) {
  const [localSelected, setLocalSelected] = useState<string | null>(selected ?? null);

  useEffect(() => {
    if (selected !== undefined) setLocalSelected(selected);
  }, [selected]);

  function handleSelect(opt: string) {
    if (onChange) onChange(opt);
    else setLocalSelected(opt);
  }

  const current = selected !== undefined ? selected : localSelected;

  return (
    <div className="filter-group">
      <h3>{title}</h3>
      <div className="filter-options">
        {options.map((option) => (
          <button
            key={option}
            className={`filter-option ${current === option ? 'active' : ''}`}
            type="button"
            onClick={() => handleSelect(option)}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PageHero ─────────────────────────────────────────────────────────────────
export function PageHero({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-hero">
      {eyebrow ? <span className="eyebrow-tag">{eyebrow}</span> : null}
      <div className="hero-copy-row">
        <div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {action ? <div className="hero-action">{action}</div> : null}
      </div>
    </section>
  );
}

// ─── AvatarGroup ──────────────────────────────────────────────────────────────
export function AvatarGroup({ count }: { count: number }) {
  const labels = ['AA', 'CM', 'SR'];
  return (
    <div className="avatars">
      {labels.slice(0, Math.min(count, 3)).map((label, index) => (
        <span key={label} className="avatar-stack" style={{ transform: `translateX(${index * -8}px)` }}>
          {label}
        </span>
      ))}
      <span className="avatar-count" style={{ transform: `translateX(${Math.min(count, 3) * -8}px)` }}>
        +{count > 3 ? count - 3 : count}
      </span>
    </div>
  );
}

// ─── InfoRow ──────────────────────────────────────────────────────────────────
export function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

// ─── BackLink ─────────────────────────────────────────────────────────────────
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link className="back-link" to={to}>
      <ChevronLeft size={16} />
      <span>{label}</span>
    </Link>
  );
}

// ─── Notice ───────────────────────────────────────────────────────────────────
/**
 * Aviso visible en la página.
 *  - variant "error": la API no respondió o respondió con error. Se usa en lugar
 *    de mostrar datos de ejemplo: la pantalla nunca oculta un fallo de conexión.
 *  - variant "info": aclaración sobre los datos reales (p. ej. datos incompletos).
 */
export function Notice({
  variant = 'error',
  title,
  children,
  onRetry,
}: {
  variant?: 'error' | 'info';
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  const Icon = variant === 'error' ? AlertTriangle : Info;
  return (
    <div className={`notice notice-${variant}`} role={variant === 'error' ? 'alert' : 'status'}>
      <Icon size={18} className="notice-icon" aria-hidden="true" />
      <div className="notice-body">
        <strong className="notice-title">{title}</strong>
        {children ? <div className="notice-text">{children}</div> : null}
      </div>
      {onRetry ? (
        <button type="button" className="notice-retry" onClick={onRetry}>
          <RotateCw size={14} aria-hidden="true" />
          <span>Reintentar</span>
        </button>
      ) : null}
    </div>
  );
}
