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
import { deleteCounterparty, fetchCounterpartiesOverview } from '../../lib/api'
import './CounterpartiesPage.css'

function EmptyState({ search }) {
  return (
    <TableEmpty>
      {search ? 'По текущему поиску контрагенты не найдены.' : 'Контрагенты пока не добавлены.'}
    </TableEmpty>
  )
}

function buildContactLabel(item) {
  const parts = [item.email, item.phone].filter(Boolean)
  return parts.length > 0 ? parts.join(' / ') : '-'
}

export default function CounterpartiesPage() {
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

    async function loadCounterparties() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))

      try {
        const items = await fetchCounterpartiesOverview({
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
            error: error.response?.data?.detail || 'Не удалось загрузить контрагентов',
            items: [],
          })
        }
      }
    }

    loadCounterparties()

    return () => {
      cancelled = true
    }
  }, [deferredSearch, refreshKey])

  const activeCounterpartiesCount = useMemo(
    () => state.items.filter((item) => (item.status || '').toLowerCase() === 'active').length,
    [state.items],
  )

  async function handleCopyCounterparty(item) {
    const text = [
      `Наименование: ${item.legal_name}`,
      `Короткое наименование: ${item.short_name || '-'}`,
      `Клиент: ${item.client_name || '-'}`,
      `Регистрационный номер: ${item.registration_number || '-'}`,
      `Страна: ${item.country_code || '-'}`,
      `Контакты: ${buildContactLabel(item)}`,
      `Город: ${item.city || '-'}`,
      `Сайт: ${item.website || '-'}`,
      `Статус: ${item.status || '-'}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setActionState({
        success: 'Данные контрагента скопированы',
        error: '',
      })
    } catch {
      setActionState({
        success: '',
        error: 'Не удалось скопировать данные контрагента',
      })
    }
  }

  async function handleDeleteCounterparty(item) {
    const isConfirmed = window.confirm(`Удалить контрагента "${item.legal_name}"?`)
    if (!isConfirmed) {
      return
    }

    try {
      await deleteCounterparty(item.id)
      setActionState({
        success: 'Контрагент удалён',
        error: '',
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setActionState({
        success: '',
        error: error.response?.data?.detail || 'Не удалось удалить контрагента',
      })
    }
  }

  return (
    <PageShell>
      <PageHeader title="Контрагенты" onBack={() => navigate(-1)} />

      <DataCard>
          <Toolbar>
            <Button variant="primary" onClick={() => navigate('/counterparties/new')}>
              <Plus size={16} />
              Добавить контрагента
            </Button>

            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Поиск по названию, клиенту, email, номеру..."
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
              { label: 'Найдено', value: `${state.items.length} контрагентов` },
              { label: 'Активных:', value: activeCounterpartiesCount },
            ]}
            success={actionState.success}
            error={actionState.error || state.error}
          />

          <TableWrap>
            {state.isLoading ? (
              <TableEmpty>Загружаю контрагентов...</TableEmpty>
            ) : state.items.length === 0 ? (
              <EmptyState search={Boolean(search)} />
            ) : (
              <table className="counterparties-table">
                <thead>
                  <tr>
                    <th />
                    <th>Наименование</th>
                    <th>Клиент</th>
                    <th>Рег. номер</th>
                    <th>Страна</th>
                    <th>Контакты</th>
                    <th>Город</th>
                    <th>Сайт</th>
                    <th>Статус</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((item) => (
                    <tr key={item.id}>
                      <td className="counterparties-table__checkbox">
                        <input type="checkbox" />
                      </td>
                      <td className="counterparties-table__name">
                        {item.legal_name}
                        {item.short_name ? <div className="counterparties-table__subname">{item.short_name}</div> : null}
                      </td>
                      <td>{item.client_name || '-'}</td>
                      <td>{item.registration_number || '-'}</td>
                      <td>{item.country_code || '-'}</td>
                      <td>{buildContactLabel(item)}</td>
                      <td>{item.city || '-'}</td>
                      <td>{item.website || '-'}</td>
                      <td>
                        <span className={`counterparties-status-chip ${item.status ? 'is-filled' : ''}`}>
                          {item.status || '-'}
                        </span>
                      </td>
                      <td>
                        <RowActions
                          actions={[
                            { kind: 'copy', label: 'Копировать', onClick: () => handleCopyCounterparty(item) },
                            { kind: 'edit', label: 'Редактировать', onClick: () => navigate(`/counterparties/${item.id}/edit`) },
                            { kind: 'delete', label: 'Удалить', onClick: () => handleDeleteCounterparty(item) },
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
