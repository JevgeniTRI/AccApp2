import { LockKeyhole, LogIn } from 'lucide-react'
import { useState } from 'react'
import './LoginPage.css'

export default function LoginPage({ onLogin, isLoading = false }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')

    try {
      await onLogin(username, password)
    } catch (loginError) {
      setError(loginError.response?.data?.detail || 'Не удалось войти')
    }
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__icon">
          <LockKeyhole size={24} />
        </div>
        <h1>Вход</h1>
        <p>Авторизуйтесь, чтобы продолжить работу с Accounting App.</p>

        <label className="login-field">
          <span>Пользователь</span>
          <input
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="off"
            required
          />
        </label>

        <label className="login-field">
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error ? <div className="login-message">{error}</div> : null}

        <button type="submit" className="login-button" disabled={isLoading}>
          <LogIn size={16} />
          {isLoading ? 'Входим...' : 'Войти'}
        </button>
      </form>
    </main>
  )
}
