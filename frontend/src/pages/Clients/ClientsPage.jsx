import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Filter,
  Plus,
  RefreshCw,
  Save,
  Search,
  SlidersHorizontal,
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
  StatusBar,
  TableEmpty,
  TableWrap,
  Toolbar,
} from '../../components/ui'
import { deleteClient, fetchClientsOverview, updateClientInterestRate } from '../../lib/api'
import './ClientsPage.css'

function EmptyState({ search }) {
  return (
    <TableEmpty>
      {search ? 'По текущему поиску клиенты не найдены.' : 'Клиенты пока не добавлены.'}
    </TableEmpty>
  )
}

function formatClientBalanceItem(item) {
  const amount = Number(item?.balance || 0)
  const currencyCode = item?.currency_code || 'EUR'

  try {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0)
  } catch {
    return `${new Intl.NumberFormat('ru-RU', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(amount) ? amount : 0)} ${currencyCode}`
  }
}

function formatPercentValue(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? String(numericValue) : ''
}

function getSavedInterestValue(client) {
  return formatPercentValue(client.interest_rate_percent)
}

function normalizeInterestValue(value) {
  const rawValue = String(value ?? '').trim()
  return rawValue ? Number(rawValue.replace(',', '.')) : null
}

function formatClientBalances(accountBalances) {
  const balances = (accountBalances || []).filter((item) => Number(item.balance || 0) !== 0)
  const visibleBalances = balances.length > 0 ? balances : accountBalances || []

  if (visibleBalances.length === 0) {
    return formatClientBalanceItem({ balance: 0, currency_code: 'EUR' })
  }

  return visibleBalances.map(formatClientBalanceItem).join(' / ')
}

export default function ClientsPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [refreshKey, setRefreshKey] = useState(0)
  const [actionState, setActionState] = useState({
    success: '',
    error: '',
  })
  const [interestInputs, setInterestInputs] = useState({})
  const [savingInterestClientId, setSavingInterestClientId] = useState(null)
  const [state, setState] = useState({
    isLoading: true,
    error: '',
    items: [],
  })

  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    let cancelled = false

    async function loadClients() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))

      try {
        const items = await fetchClientsOverview({
          query: deferredSearch || undefined,
          limit: 200,
        })

        if (!cancelled) {
          setState({
            isLoading: false,
            error: '',
            items,
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            isLoading: false,
            error: error.response?.data?.detail || 'Не удалось загрузить клиентов',
            items: [],
          })
        }
      }
    }

    loadClients()

    return () => {
      cancelled = true
    }
  }, [deferredSearch, refreshKey])

  const activeClientsCount = useMemo(
    () => state.items.filter((item) => (item.status || '').toLowerCase() === 'active').length,
    [state.items],
  )

  useEffect(() => {
    setInterestInputs(
      Object.fromEntries(
        state.items.map((client) => [client.id, formatPercentValue(client.interest_rate_percent)]),
      ),
    )
  }, [state.items])

  async function handleCopyClient(client) {
    const text = [
      `ФИО: ${client.full_name}`,
      `Проценты: ${getSavedInterestValue(client) ? `${getSavedInterestValue(client)}%` : '-'}`,
      `Баланс: ${formatClientBalances(client.account_balances)}`,
      `Статус: ${client.status || '-'}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setActionState({
        success: 'Данные клиента скопированы',
        error: '',
      })
    } catch {
      setActionState({
        success: '',
        error: 'Не удалось скопировать данные клиента',
      })
    }
  }

  function handleEditClient(clientId) {
    navigate(`/clients/${clientId}/edit`)
  }

  function updateInterestInput(clientId, value) {
    setInterestInputs((current) => ({
      ...current,
      [clientId]: value,
    }))
  }

  async function saveInterestRate(client) {
    const rawValue = String(interestInputs[client.id] ?? '').trim()
    const nextValue = normalizeInterestValue(rawValue)
    const currentValue = normalizeInterestValue(getSavedInterestValue(client))

    if (nextValue !== null && (!Number.isFinite(nextValue) || nextValue < 0 || nextValue > 100)) {
      setActionState({
        success: '',
        error: 'Проценты должны быть числом от 0 до 100',
      })
      updateInterestInput(client.id, formatPercentValue(client.interest_rate_percent))
      return
    }
    if ((nextValue ?? null) === (Number.isFinite(currentValue) ? currentValue : null)) {
      return
    }

    setSavingInterestClientId(client.id)
    try {
      await updateClientInterestRate(client.id, nextValue)
      setActionState({
        success: 'Проценты сохранены',
        error: '',
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setActionState({
        success: '',
        error: error.response?.data?.detail || 'Не удалось сохранить проценты',
      })
      updateInterestInput(client.id, formatPercentValue(client.interest_rate_percent))
    } finally {
      setSavingInterestClientId(null)
    }
  }

  async function handleDeleteClient(client) {
    const isConfirmed = window.confirm(`Удалить клиента "${client.full_name}"?`)
    if (!isConfirmed) {
      return
    }

    try {
      await deleteClient(client.id)
      setActionState({
        success: 'Клиент удалён',
        error: '',
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setActionState({
        success: '',
        error: error.response?.data?.detail || 'Не удалось удалить клиента',
      })
    }
  }

  return (
    <PageShell>
      <PageHeader title="Клиенты" onBack={() => navigate(-1)} />

      <DataCard>
          <Toolbar>
            <Button variant="primary" onClick={() => navigate('/clients/new')}>
              <Plus size={16} />
              Добавить клиента
            </Button>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по ФИО, email, телефону, ID..."
              icon={<Search size={16} />}
            />

            <IconButton
              onClick={() => setRefreshKey((current) => current + 1)}
              aria-label="Обновить список"
            >
              <RefreshCw size={16} />
            </IconButton>
            <IconButton aria-label="Фильтры">
              <Filter size={16} />
            </IconButton>
            <IconButton aria-label="Параметры таблицы">
              <SlidersHorizontal size={16} />
            </IconButton>
          </Toolbar>

          <StatusBar
            items={[
              { label: 'Найдено', value: `${state.items.length} клиентов` },
              { label: 'Активных:', value: activeClientsCount },
            ]}
            success={actionState.success}
            error={actionState.error || state.error}
          />

          <TableWrap>
            {state.isLoading ? (
              <TableEmpty>Загружаю клиентов...</TableEmpty>
            ) : state.items.length === 0 ? (
              <EmptyState search={Boolean(search)} />
            ) : (
              <table className="clients-table">
                <thead>
                  <tr>
                    <th />
                    <th>ФИО</th>
                    <th>Проценты %</th>
                    <th>Баланс</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((client) => {
                    const currentInput = interestInputs[client.id] ?? ''
                    const savedInput = getSavedInterestValue(client)
                    const isInterestDirty = currentInput !== savedInput
                    const isSavingInterest = savingInterestClientId === client.id

                    return (
                      <tr key={client.id}>
                        <td className="clients-table__checkbox">
                          <input type="checkbox" />
                        </td>
                        <td className="clients-table__name">{client.full_name}</td>
                        <td className="clients-table__interest">
                          <div className="clients-table__interest-control">
                            <div className="clients-table__interest-input-wrap">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={currentInput}
                                disabled={isSavingInterest}
                                onChange={(event) => updateInterestInput(client.id, event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter' && isInterestDirty) {
                                    saveInterestRate(client)
                                  }
                                }}
                                placeholder="-"
                                aria-label={`Проценты для ${client.full_name}`}
                              />
                              {currentInput ? <span>%</span> : null}
                            </div>
                            {isInterestDirty ? (
                              <button
                                type="button"
                                className="clients-table__interest-save"
                                onClick={() => saveInterestRate(client)}
                                disabled={isSavingInterest}
                                aria-label={`Сохранить проценты для ${client.full_name}`}
                                title="Сохранить проценты"
                              >
                                <Save size={14} />
                              </button>
                            ) : null}
                          </div>
                        </td>
                        <td className="clients-table__balance">{formatClientBalances(client.account_balances)}</td>
                        <td>
                          <span className={`clients-status-chip ${client.status ? 'is-filled' : ''}`}>
                            {client.status || '-'}
                          </span>
                        </td>
                        <td>
                          <RowActions
                            actions={[
                              { kind: 'copy', label: 'Копировать', onClick: () => handleCopyClient(client) },
                              { kind: 'edit', label: 'Редактировать', onClick: () => handleEditClient(client.id) },
                              { kind: 'delete', label: 'Удалить', onClick: () => handleDeleteClient(client) },
                            ]}
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </TableWrap>
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
