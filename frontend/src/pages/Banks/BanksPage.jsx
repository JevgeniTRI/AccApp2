import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Filter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { fetchBankAccountsOverview, fetchBanksOverview } from '../../lib/api'
import './BanksPage.css'

function formatBalanceLabel(item) {
  if (!item.currency_code || item.balance === null || item.balance === undefined) {
    return '—'
  }

  const amount = Number(item.balance)
  const formattedAmount = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0)

  return `${formattedAmount} ${item.currency_code}`
}

function buildRows(accountItems, bankItems) {
  const linkedBankIds = new Set(accountItems.map((item) => item.bank_id))

  const accountRows = accountItems.map((item) => ({
    ...item,
    row_key: `account-${item.id}`,
    account_id: item.id,
    row_type: 'account',
  }))

  const bankOnlyRows = bankItems
    .filter((bank) => !linkedBankIds.has(bank.id))
    .map((bank) => ({
      row_key: `bank-${bank.id}`,
      account_id: null,
      row_type: 'bank',
      id: bank.id,
      company_id: null,
      company_name: null,
      company_legal_name: null,
      bank_id: bank.id,
      bank_label: bank.label,
      bank_full_name: bank.name,
      iban: null,
      account_number: null,
      swift_or_bic: bank.swift_code,
      bank_address: bank.bank_address,
      currency_code: null,
      balance: null,
      is_primary: false,
      is_active: true,
      opened_at: null,
      closed_at: null,
    }))

  return [...accountRows, ...bankOnlyRows]
}

export default function BanksPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [state, setState] = useState({
    isLoading: true,
    error: '',
    accountItems: [],
    bankItems: [],
  })

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let cancelled = false

    async function loadAccounts() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))

      try {
        const [accountItems, bankItems] = await Promise.all([
          fetchBankAccountsOverview({
            query: deferredSearch || undefined,
            limit: 300,
          }),
          fetchBanksOverview({
            query: deferredSearch || undefined,
            limit: 300,
          }),
        ])

        if (!cancelled) {
          setState({
            isLoading: false,
            error: '',
            accountItems,
            bankItems,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: error.response?.data?.detail || 'Не удалось загрузить банковские счета',
            accountItems: [],
            bankItems: [],
          })
        }
      }
    }

    loadAccounts()

    return () => {
      cancelled = true
    }
  }, [deferredSearch, refreshKey])

  const rows = useMemo(
    () => buildRows(state.accountItems, state.bankItems),
    [state.accountItems, state.bankItems],
  )

  return (
    <div className="banks-page">
      <div className="banks-shell">
        <div className="banks-heading">
          <button type="button" className="banks-back" aria-label="Назад">
            <ArrowLeft size={18} />
          </button>
          <h1>Банки</h1>
        </div>

        <section className="banks-card">
          <div className="banks-toolbar">
            <button type="button" className="banks-action" onClick={() => navigate('/banks/new-bank')}>
              <Plus size={16} />
              Добавить банк
            </button>
            <button type="button" className="banks-action" onClick={() => navigate('/banks/new')}>
              <Plus size={16} />
              Добавить счёт
            </button>

            <label className="banks-search">
              <Search size={16} />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Поиск..."
              />
            </label>

            <button
              type="button"
              className="banks-icon-button"
              onClick={() => setRefreshKey((current) => current + 1)}
              aria-label="Обновить список"
            >
              <RefreshCw size={16} />
            </button>
            <button type="button" className="banks-icon-button" aria-label="Фильтры">
              <Filter size={16} />
            </button>
          </div>

          <div className="banks-table-wrap">
            {state.isLoading ? (
              <div className="banks-table__empty">Загружаю банковские счета...</div>
            ) : rows.length === 0 ? (
              <div className="banks-table__empty">
                {search ? 'По текущему поиску банки и счета не найдены.' : 'Банки и банковские счета пока не добавлены.'}
              </div>
            ) : (
              <table className="banks-table">
                <thead>
                  <tr>
                    <th>Банк</th>
                    <th>Наименование фирмы</th>
                    <th>Остаток</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.row_key}>
                      <td className="banks-table__bank">{item.bank_label}</td>
                      <td className="banks-table__company">{item.company_legal_name || 'Не привязано'}</td>
                      <td>{formatBalanceLabel(item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {state.error ? <div className="banks-status__error">{state.error}</div> : null}
        </section>

        <div className="banks-footer">
          <button type="button" className="banks-export">
            Скачать Excel
            <span className="banks-export__badge">XLS</span>
          </button>
          <button type="button" className="banks-export">
            Скачать PDF
            <span className="banks-export__badge">PDF</span>
          </button>
        </div>
      </div>
    </div>
  )
}
