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

  return (
    <div className="app-shell">
      <Navbar user={authState.user} onLogout={handleLogout} />
      <main className="app-main">
        <Suspense fallback={<div className="auth-loading">Загружаем раздел...</div>}>
          <Routes>
            <Route path="/" element={<PlaceholderPage title="Главная" />} />
            <Route path="/payments" element={<PaymentsPage />} />
            <Route path="/payments/new" element={<AddPaymentsPage />} />
            <Route path="/payments/:paymentId/edit" element={<AddPaymentsPage />} />
            <Route path="/companies" element={<CompaniesPage />} />
            <Route path="/companies/new" element={<CompanyCreatePage />} />
            <Route path="/companies/:companyId/edit" element={<CompanyCreatePage />} />
            <Route path="/banks" element={<BanksPage />} />
            <Route path="/banks/new-bank" element={<BankCreatePage />} />
            <Route path="/banks/bank/:bankId/edit" element={<BankCreatePage />} />
            <Route path="/banks/new" element={<BankAccountCreatePage />} />
            <Route path="/banks/:bankAccountId/edit" element={<BankAccountCreatePage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/clients/new" element={<ClientCreatePage />} />
            <Route path="/clients/:clientId/edit" element={<ClientCreatePage />} />
            <Route path="/counterparties" element={<CounterpartiesPage />} />
            <Route path="/counterparties/new" element={<CounterpartyCreatePage />} />
            <Route path="/counterparties/:counterpartyId/edit" element={<CounterpartyCreatePage />} />
            <Route path="*" element={<Navigate to="/payments" replace />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
