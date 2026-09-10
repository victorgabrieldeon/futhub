import type { ComponentPropsWithoutRef, ReactNode } from 'react';

type StudioWorkspaceProps = Readonly<{
  children: ReactNode;
  className: string;
  id?: string;
}>;

type StudioSidebarProps = ComponentPropsWithoutRef<'aside'>;
type StudioHeaderProps = ComponentPropsWithoutRef<'header'>;
type StudioCanvasProps = ComponentPropsWithoutRef<'div'>;

function classNames(base: string, className?: string): string {
  return className ? `${base} ${className}` : base;
}

export function StudioWorkspace({ children, className, id }: StudioWorkspaceProps) {
  return (
    <div className={`studio-workspace ${className}`} id={id}>
      {children}
    </div>
  );
}

export function StudioSidebar({ children, className, ...props }: StudioSidebarProps) {
  return (
    <aside {...props} className={classNames('studio-sidebar', className)}>
      {children}
    </aside>
  );
}

export function StudioHeader({ children, className, ...props }: StudioHeaderProps) {
  return (
    <header {...props} className={classNames('studio-header', className)}>
      {children}
    </header>
  );
}

export function StudioCanvas({ children, className, ...props }: StudioCanvasProps) {
  return (
    <div {...props} className={classNames('studio-canvas', className)}>
      {children}
    </div>
  );
}
