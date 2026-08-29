import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/** Shared page heading keeps the four primary screens on one visual baseline. */
export function PageHeader({ eyebrow, title, description, actions, className = "" }: PageHeaderProps) {
  return (
    <header className={`page-header${className ? ` ${className}` : ""}`}>
      <span className="eyebrow page-header-eyebrow">{eyebrow}</span>
      <div className="page-header-row">
        <div className="page-header-copy">
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        {actions && <div className="page-header-actions">{actions}</div>}
      </div>
    </header>
  );
}
