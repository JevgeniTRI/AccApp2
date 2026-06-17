import { NavLink } from 'react-router-dom'
import { LogOut, RefreshCcwDot, UserCircle2 } from 'lucide-react'
import './Navbar.css'

const navItems = [
  { path: '/', label: 'Главная', tab: 'dashboard' },
  { path: '/payments', label: 'Платежи', tab: 'payments' },
  { path: '/companies', label: 'Компании', tab: 'companies' },
  { path: '/banks', label: 'Банки', tab: 'banks' },
  { path: '/clients', label: 'Клиенты', tab: 'clients' },
  { path: '/counterparties', label: 'Контрагенты', tab: 'counterparties' },
  { path: '/admin', label: 'Админ', tab: 'admin' },
]

function canOpenTab(user, tab) {
  return Boolean(user?.is_superuser || user?.tab_permissions?.includes(tab))
}

export default function Navbar({ user, onLogout }) {
  return (
    <header className="navbar">
      <div className="navbar__container">
        <div className="navbar__left">
          <NavLink to="/" className="navbar__logo" aria-label="На главную">
            <RefreshCcwDot size={28} strokeWidth={2.25} />
          </NavLink>

          <nav className="navbar__nav" aria-label="Основная навигация">
            {navItems.filter((item) => canOpenTab(user, item.tab)).map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `navbar__link ${isActive ? 'is-active' : ''}`}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="navbar__account">
          <div className="navbar__user">
            <UserCircle2 size={24} strokeWidth={1.8} />
            <span>{user?.username || 'User'}</span>
          </div>
          <button type="button" className="navbar__profile" onClick={onLogout} aria-label="Выйти">
            <LogOut size={22} strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  )
}
