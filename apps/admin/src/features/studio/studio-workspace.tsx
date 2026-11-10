import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { AdminIcon, type AdminIconName } from '../../components/admin-icon';
import './studio.css';

type StudioShellProps = Readonly<{
  children: ReactNode;
  focus?: boolean;
  kind: 'cards' | 'packs';
  labelledBy: string;
}>;

type StudioTopbarProps = Readonly<{
  actions: ReactNode;
  icon: AdminIconName;
  status: ReactNode;
  title: ReactNode;
  titleId: string;
  tools?: ReactNode;
}>;

type StudioBodyProps = Readonly<{
  children: ReactNode;
  id?: string;
  left: boolean;
  right: boolean;
}>;

type StudioRailProps = ComponentPropsWithoutRef<'aside'> & Readonly<{ side: 'left' | 'right' }>;

type StudioPanelHeaderProps = Readonly<{
  actions?: ReactNode;
  eyebrow?: ReactNode;
  id?: string;
  title: ReactNode;
}>;

type StudioSegmentedProps<Value extends string> = Readonly<{
  label: string;
  onChange: (value: Value) => void;
  options: readonly Readonly<{ id: Value; label: ReactNode }>[];
  value: Value;
}>;

/** Entre tablet e desktop estreito, a biblioteca vira gaveta sobre o palco. */
export function isStudioDrawerViewport(): boolean {
  return window.matchMedia('(min-width: 861px) and (max-width: 1120px)').matches;
}

function classNames(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

export function StudioShell({ children, focus = false, kind, labelledBy }: StudioShellProps) {
  return (
    <section
      aria-labelledby={labelledBy}
      className="studio-shell"
      data-focus={focus}
      data-studio={kind}
    >
      {children}
    </section>
  );
}

export function StudioTopbar({ actions, icon, status, title, titleId, tools }: StudioTopbarProps) {
  return (
    <header className="studio-topbar">
      <div className="studio-topbar__identity">
        <span className="studio-topbar__mark">
          <AdminIcon name={icon} />
        </span>
        <div>
          <h1 id={titleId}>{title}</h1>
          <output className="studio-topbar__status">{status}</output>
        </div>
      </div>
      {tools && <div className="studio-topbar__tools">{tools}</div>}
      <div className="studio-topbar__actions">{actions}</div>
    </header>
  );
}

export function StudioBody({ children, id, left, right }: StudioBodyProps) {
  return (
    <div
      className="studio-body"
      data-left={left ? 'open' : 'closed'}
      data-right={right ? 'open' : 'closed'}
      id={id}
    >
      {children}
    </div>
  );
}

export function StudioRail({ children, className, side, ...props }: StudioRailProps) {
  return (
    <aside {...props} className={classNames(`studio-rail studio-rail--${side}`, className)}>
      {children}
    </aside>
  );
}

export function StudioPanelHeader({ actions, eyebrow, id, title }: StudioPanelHeaderProps) {
  return (
    <div className="studio-panel-header">
      <div>
        {eyebrow && <p className="studio-eyebrow">{eyebrow}</p>}
        <h2 id={id}>{title}</h2>
      </div>
      {actions && <div className="studio-panel-header__actions">{actions}</div>}
    </div>
  );
}

export function StudioSegmented<Value extends string>({
  label,
  onChange,
  options,
  value,
}: StudioSegmentedProps<Value>) {
  return (
    <fieldset className="studio-segmented">
      <legend className="sr-only">{label}</legend>
      {options.map((option) => (
        <button
          aria-pressed={value === option.id}
          key={option.id}
          onClick={() => onChange(option.id)}
          type="button"
        >
          {option.label}
        </button>
      ))}
    </fieldset>
  );
}
