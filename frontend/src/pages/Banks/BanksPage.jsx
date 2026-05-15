import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Filter,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  DataCard,
  ExportActions,
  IconButton,
  PageHeader,
  PageShell,
  RowActions,
  SearchInput,
  TableEmpty,
  TableWrap,
  Toolbar,
} from '../../components/ui'
import { deleteBank, deleteBankAccount, fetchBankAccountsOverview, fetchBanksOverview } from '../../lib/api'
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
  const [actionState, setActionState] = useState({
    busyKey: '',
    error: '',
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

  function getEditPath(item) {
    return item.row_type === 'bank' ? `/banks/bank/${item.bank_id}/edit` : `/banks/${item.account_id}/edit`
  }

  async function handleDelete(item) {
    const label = item.row_type === 'bank' ? item.bank_label : `${item.bank_label} / ${item.company_legal_name || 'Не привязано'}`
    const confirmed = window.confirm(`Удалить запись "${label}"?`)
    if (!confirmed) {
      return
    }

    setActionState({ busyKey: item.row_key, error: '' })
    try {
      if (item.row_type === 'bank') {
        await deleteBank(item.bank_id)
      } else {
        await deleteBankAccount(item.account_id)
      }
      setActionState({ busyKey: '', error: '' })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setActionState({
        busyKey: '',
        error: error.response?.data?.detail || error.message || 'Не удалось удалить запись',
      })
    }
  }

  return (
    <PageShell>
      <PageHeader title="Банки" onBack={() => navigate(-1)} />

      <DataCard>
          <Toolbar>
            <Button variant="primary" onClick={() => navigate('/banks/new-bank')}>
              <Plus size={16} />
              Добавить банк
            </Button>
            <Button variant="primary" onClick={() => navigate('/banks/new')}>
              <Plus size={16} />
              Добавить счёт
            </Button>

            <SearchInput value={search} onChange={setSearch} placeholder="Поиск..." icon={<Search size={16} />} />

            <IconButton
              onClick={() => setRefreshKey((current) => current + 1)}
              aria-label="Обновить список"
            >
              <RefreshCw size={16} />
            </IconButton>
            <IconButton aria-label="Фильтры">
              <Filter size={16} />
            </IconButton>
          </Toolbar>

          <TableWrap>
            {state.isLoading ? (
              <TableEmpty>Загружаю банковские счета...</TableEmpty>
            ) : rows.length === 0 ? (
              <TableEmpty>
                {search ? 'По текущему поиску банки и счета не найдены.' : 'Банки и банковские счета пока не добавлены.'}
              </TableEmpty>
            ) : (
              <table className="banks-table">
                <thead>
                  <tr>
                    <th>Банк</th>
                    <th>Наименование фирмы</th>
                    <th>Остаток</th>
                    <th className="banks-table__actions-heading">Действия</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((item) => (
                    <tr key={item.row_key}>
                      <td className="banks-table__bank">{item.bank_label}</td>
                      <td className="banks-table__company">{item.company_legal_name || 'Не привязано'}</td>
                      <td>{formatBalanceLabel(item)}</td>
                      <td className="banks-table__actions">
                        <RowActions
                          className="banks-table__actions-inner"
                          actions={[
                            { kind: 'edit', label: 'Редактировать запись', onClick: () => navigate(getEditPath(item)) },
                            {
                              kind: 'delete',
                              label: 'Удалить запись',
                              onClick: () => handleDelete(item),
                              disabled: actionState.busyKey === item.row_key,
                            },
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </TableWrap>
          {state.error ? <div className="banks-status__error">{state.error}</div> : null}
          {actionState.error ? <div className="banks-status__error">{actionState.error}</div> : null}
        </DataCard>

      <ExportActions
        actions={[
          { label: 'Скачать Excel', badge: 'XLS' },
          { label: 'Скачать PDF', badge: 'PDF' },
        ]}
      />
    </PageShell>
  )
}
