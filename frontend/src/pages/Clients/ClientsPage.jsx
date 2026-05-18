import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import {
  Filter,
  Plus,
  RefreshCw,
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
import { deleteClient, fetchClientsOverview } from '../../lib/api'
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

  async function handleCopyClient(client) {
    const text = [
      `ФИО: ${client.full_name}`,
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
                    <th>Баланс</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((client) => (
                    <tr key={client.id}>
                      <td className="clients-table__checkbox">
                        <input type="checkbox" />
                      </td>
                      <td className="clients-table__name">{client.full_name}</td>
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
                  ))}
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
