import { ArrowLeft, Copy, Pencil, Trash2 } from 'lucide-react'
import './ui.css'

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}

export function PageShell({ children, className = '' }) {
  return <div className={classNames('ui-page', className)}>{children}</div>
}

export function PageHeader({ title, onBack, children }) {
  return (
    <div className="ui-page-header">
      {onBack ? (
        <IconButton aria-label="Назад" onClick={onBack} variant="back">
          <ArrowLeft size={18} />
        </IconButton>
      ) : null}
      <h1>{title}</h1>
      {children}
    </div>
  )
}

export function DataCard({ children, className = '' }) {
  return <section className={classNames('ui-data-card', className)}>{children}</section>
}

export function Toolbar({ children, className = '' }) {
  return <div className={classNames('ui-toolbar', className)}>{children}</div>
}

export function Button({ children, className = '', variant = 'default', ...props }) {
  return (
    <button type="button" className={classNames('ui-button', `ui-button--${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export function IconButton({ children, className = '', variant = 'default', ...props }) {
  return (
    <button type="button" className={classNames('ui-icon-button', `ui-icon-button--${variant}`, className)} {...props}>
      {children}
    </button>
  )
}

export function SearchInput({ value, onChange, placeholder = 'Поиск...', className = '', icon, ...props }) {
  return (
    <label className={classNames('ui-search', className)}>
      {icon}
      <input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        {...props}
      />
    </label>
  )
}

export function StatusBar({ items = [], success, error, className = '' }) {
  return (
    <div className={classNames('ui-status-bar', className)}>
      {items.map((item) => (
        <div key={item.label}>
          {item.label} <strong>{item.value}</strong>
        </div>
      ))}
      {success ? <div className="ui-status-bar__success">{success}</div> : null}
      {error ? <div className="ui-status-bar__error">{error}</div> : null}
    </div>
  )
}

export function TableWrap({ children, className = '' }) {
  return <div className={classNames('ui-table-wrap', className)}>{children}</div>
}

export function TableEmpty({ children, className = '' }) {
  return <div className={classNames('ui-table-empty', className)}>{children}</div>
}

export function RowActions({ actions, className = '' }) {
  const iconMap = {
    copy: Copy,
    edit: Pencil,
    delete: Trash2,
  }

  return (
    <div className={classNames('ui-row-actions', className)}>
      {actions.map((action) => {
        const Icon = action.icon || iconMap[action.kind]
        return (
          <IconButton
            key={action.label}
            aria-label={action.label}
            disabled={action.disabled}
            onClick={action.onClick}
            title={action.title || action.label}
            variant={action.kind === 'delete' ? 'danger' : 'row'}
          >
            {Icon ? <Icon size={14} /> : action.children}
          </IconButton>
        )
      })}
    </div>
  )
}

export function ExportActions({ actions, className = '' }) {
  return (
    <div className={classNames('ui-export-actions', className)}>
      {actions.map((action) => (
        <Button key={action.label} className="ui-export-button" onClick={action.onClick} variant="ghost">
          {action.label}
          {action.badge ? <span className="ui-export-button__badge">{action.badge}</span> : null}
          {action.icon || null}
        </Button>
      ))}
    </div>
  )
}
