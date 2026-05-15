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
import { deleteCompany, fetchCompaniesOverview } from '../../lib/api'
import './CompaniesPage.css'

function EmptyState({ search }) {
  return (
    <TableEmpty>
      {search ? 'По текущему поиску компании не найдены.' : 'Компании пока не добавлены.'}
    </TableEmpty>
  )
}

export default function CompaniesPage() {
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

    async function loadCompanies() {
      setState((current) => ({ ...current, isLoading: true, error: '' }))

      try {
        const items = await fetchCompaniesOverview({
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
            error: error.response?.data?.detail || 'Не удалось загрузить компании',
            items: [],
          })
        }
      }
    }

    loadCompanies()

    return () => {
      cancelled = true
    }
  }, [deferredSearch, refreshKey])

  const totalBankLinks = useMemo(
    () => state.items.reduce((total, item) => total + item.bank_names.length, 0),
    [state.items],
  )

  async function handleCopyCompany(company) {
    const text = [
      `Наименование: ${company.legal_name}`,
      `Короткое наименование: ${company.short_name || '-'}`,
      `Банковские счета: ${company.bank_names.length > 0 ? company.bank_names.join(', ') : '-'}`,
      `Директор: ${company.director_name || '-'}`,
    ].join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setActionState({
        success: 'Данные строки скопированы',
        error: '',
      })
    } catch {
      setActionState({
        success: '',
        error: 'Не удалось скопировать данные строки',
      })
    }
  }

  function handleEditCompany(companyId) {
    navigate(`/companies/${companyId}/edit`)
  }

  async function handleDeleteCompany(company) {
    const isConfirmed = window.confirm(`Удалить компанию "${company.legal_name}"?`)
    if (!isConfirmed) {
      return
    }

    try {
      await deleteCompany(company.id)
      setActionState({
        success: 'Компания удалена',
        error: '',
      })
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setActionState({
        success: '',
        error: error.response?.data?.detail || 'Не удалось удалить компанию',
      })
    }
  }

  return (
    <PageShell>
      <PageHeader title="Компании" onBack={() => navigate(-1)} />

      <DataCard>
          <Toolbar>
            <Button variant="primary" onClick={() => navigate('/companies/new')}>
              <Plus size={16} />
              Добавить компанию
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
            <IconButton aria-label="Параметры таблицы">
              <SlidersHorizontal size={16} />
            </IconButton>
          </Toolbar>

          <StatusBar
            items={[
              { label: 'Найдено', value: `${state.items.length} компаний` },
              { label: 'Банковских связей:', value: totalBankLinks },
            ]}
            success={actionState.success}
            error={actionState.error || state.error}
          />

          <TableWrap>
            {state.isLoading ? (
              <TableEmpty>Загружаю компании...</TableEmpty>
            ) : state.items.length === 0 ? (
              <EmptyState search={Boolean(search)} />
            ) : (
              <table className="companies-table">
                <thead>
                  <tr>
                    <th />
                    <th>Наименование</th>
                    <th>Короткое наименование</th>
                    <th>Банковские счета</th>
                    <th>Директор</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((company) => (
                    <tr key={company.id}>
                      <td className="companies-table__checkbox">
                        <input type="checkbox" />
                      </td>
                      <td className="companies-table__name">{company.legal_name}</td>
                      <td>{company.short_name || '-'}</td>
                      <td>
                        {company.bank_names.length > 0 ? (
                          <div className="companies-table__banks">
                            {company.bank_names.map((bankName) => (
                              <span key={`${company.id}-${bankName}`} className="companies-table__bank-chip">
                                {bankName}
                              </span>
                            ))}
                          </div>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{company.director_name || '-'}</td>
                      <td>
                        <RowActions
                          actions={[
                            { kind: 'copy', label: 'Копировать', onClick: () => handleCopyCompany(company) },
                            { kind: 'edit', label: 'Редактировать', onClick: () => handleEditCompany(company.id) },
                            { kind: 'delete', label: 'Удалить', onClick: () => handleDeleteCompany(company) },
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
