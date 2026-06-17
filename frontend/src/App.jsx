import { Navigate, Route, Routes } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import Navbar from './components/Navbar/Navbar'
import LoginPage from './pages/Login/LoginPage'
import { fetchCurrentUser, login, logout } from './lib/api'

const BankAccountCreatePage = lazy(() => import('./pages/Banks/BankAccountCreatePage'))
const BankCreatePage = lazy(() => import('./pages/Banks/BankCreatePage'))
const BanksPage = lazy(() => import('./pages/Banks/BanksPage'))
const ClientCreatePage = lazy(() => import('./pages/Clients/ClientCreatePage'))
const ClientsPage = lazy(() => import('./pages/Clients/ClientsPage'))
const CompanyCreatePage = lazy(() => import('./pages/Companies/CompanyCreatePage'))
const CompaniesPage = lazy(() => import('./pages/Companies/CompaniesPage'))
const CounterpartiesPage = lazy(() => import('./pages/Counterparties/CounterpartiesPage'))
const CounterpartyCreatePage = lazy(() => import('./pages/Counterparties/CounterpartyCreatePage'))
const AddPaymentsPage = lazy(() => import('./pages/Payments/AddPaymentsPage'))
const PaymentsPage = lazy(() => import('./pages/Payments/PaymentsPage'))
const AdminPage = lazy(() => import('./pages/Admin/AdminPage'))

function PlaceholderPage({ title }) {
  return (
    <section className="placeholder-page">
      <div className="placeholder-page__card">
        <span className="placeholder-page__eyebrow">Раздел в работе</span>
        <h1>{title}</h1>
        <p>Dashboard будет прям вызовом, но как говорил Бурунов:'Но мы рискнем!'. Сейчас уже собраны разделы платежей, компаний, банков и клиентов.</p>
      </div>
    </section>
  )
}

function NoAccessPage() {
  return (
    <section className="placeholder-page">
      <div className="placeholder-page__card">
        <span className="placeholder-page__eyebrow">Нет доступа</span>
        <h1>Доступ не назначен</h1>
        <p>Администратор может открыть нужные вкладки в разделе Админ.</p>
      </div>
    </section>
  )
}

const tabPaths = {
  dashboard: '/',
  payments: '/payments',
  companies: '/companies',
  banks: '/banks',
  clients: '/clients',
  counterparties: '/counterparties',
  admin: '/admin',
}

function canOpenTab(user, tab) {
  return Boolean(user?.is_superuser || user?.tab_permissions?.includes(tab))
}

function getDefaultPath(user) {
  if (canOpenTab(user, 'dashboard')) {
    return '/'
  }
  const firstTab = user?.tab_permissions?.find((tab) => tabPaths[tab])
  return firstTab ? tabPaths[firstTab] : '/no-access'
}

function App() {
  const [authState, setAuthState] = useState({
    isChecking: true,
    isSubmitting: false,
    user: null,
  })

  useEffect(() => {
    let cancelled = false

    async function checkSession() {
      try {
        const data = await fetchCurrentUser()
        if (!cancelled) {
          setAuthState({ isChecking: false, isSubmitting: false, user: data.user })
        }
      } catch {
        if (!cancelled) {
          setAuthState({ isChecking: false, isSubmitting: false, user: null })
        }
      }
    }

    checkSession()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleLogin(username, password) {
    setAuthState((current) => ({ ...current, isSubmitting: true }))
    try {
      const data = await login(username, password)
      setAuthState({ isChecking: false, isSubmitting: false, user: data.user })
    } catch (error) {
      setAuthState((current) => ({ ...current, isSubmitting: false }))
      throw error
    }
  }

  async function handleLogout() {
    await logout()
    setAuthState({ isChecking: false, isSubmitting: false, user: null })
  }

  if (authState.isChecking) {
    return <div className="auth-loading">Проверяем сессию...</div>
  }

  if (!authState.user) {
    return <LoginPage onLogin={handleLogin} isLoading={authState.isSubmitting} />
  }

  function requireTab(tab, element) {
    return canOpenTab(authState.user, tab) ? element : <Navigate to={getDefaultPath(authState.user)} replace />
  }

  return (
    <div className="app-shell">
      <Navbar user={authState.user} onLogout={handleLogout} />
      <main className="app-main">
        <Suspense fallback={<div className="auth-loading">Загружаем раздел...</div>}>
          <Routes>
            <Route path="/" element={requireTab('dashboard', <PlaceholderPage title="Главная" />)} />
            <Route path="/payments" element={requireTab('payments', <PaymentsPage />)} />
            <Route path="/payments/new" element={requireTab('payments', <AddPaymentsPage />)} />
            <Route path="/payments/:paymentId/edit" element={requireTab('payments', <AddPaymentsPage />)} />
            <Route path="/companies" element={requireTab('companies', <CompaniesPage />)} />
            <Route path="/companies/new" element={requireTab('companies', <CompanyCreatePage />)} />
            <Route path="/companies/:companyId/edit" element={requireTab('companies', <CompanyCreatePage />)} />
            <Route path="/banks" element={requireTab('banks', <BanksPage />)} />
            <Route path="/banks/new-bank" element={requireTab('banks', <BankCreatePage />)} />
            <Route path="/banks/bank/:bankId/edit" element={requireTab('banks', <BankCreatePage />)} />
            <Route path="/banks/new" element={requireTab('banks', <BankAccountCreatePage />)} />
            <Route path="/banks/:bankAccountId/edit" element={requireTab('banks', <BankAccountCreatePage />)} />
            <Route path="/clients" element={requireTab('clients', <ClientsPage />)} />
            <Route path="/clients/new" element={requireTab('clients', <ClientCreatePage />)} />
            <Route path="/clients/:clientId/edit" element={requireTab('clients', <ClientCreatePage />)} />
            <Route path="/counterparties" element={requireTab('counterparties', <CounterpartiesPage />)} />
            <Route path="/counterparties/new" element={requireTab('counterparties', <CounterpartyCreatePage />)} />
            <Route path="/counterparties/:counterpartyId/edit" element={requireTab('counterparties', <CounterpartyCreatePage />)} />
            <Route path="/admin" element={requireTab('admin', <AdminPage currentUser={authState.user} />)} />
            <Route path="/no-access" element={<NoAccessPage />} />
            <Route path="*" element={<Navigate to={getDefaultPath(authState.user)} replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
