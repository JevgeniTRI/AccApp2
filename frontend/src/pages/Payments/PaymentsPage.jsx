import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Download, Eye, Filter, Paperclip, Plus, RefreshCw, Search, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import LookupField from '../../components/LookupField/LookupField'
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
} from '../../components/ui'
import { buildPaymentAttachmentUrl, deletePayment, downloadPaymentsExport, fetchPayments, fetchPaymentsMeta } from '../../lib/api'
import {
  formatAmount,
  formatDate,
  loadLookup,
  toDateInputValue,
  toNumber,
} from './paymentUtils'
import './PaymentsPage.css'

function EmptyState({ search }) {
  return (
    <TableEmpty>
      {search ? 'По текущим фильтрам ничего не найдено.' : 'Платежей пока нет. Добавьте первую запись.'}
    </TableEmpty>
  )
}

function PaymentsTable({ rows, onDelete, onEdit }) {
  return (
    <table className="payments-table">
      <thead>
        <tr>
          <th>Дата</th>
          <th>Компания</th>
          <th>Связанная компания</th>
          <th>Банк</th>
          <th>Контрагент</th>
          <th>Сумма</th>
          <th>Свои расходы</th>
          <th>Налог</th>
          <th>Доходы/Расходы</th>
          <th>Клиент</th>
          <th>Комментарий</th>
          <th>Статус</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((payment) => {
          const amountClass = payment.payment_direction === 'incoming' ? 'is-positive' : 'is-negative'

          return (
            <tr key={payment.id}>
              <td className="payments-table__date-cell">
                <span>{formatDate(payment.booking_date)}</span>
                <RowActions
                  className="payments-table__inline-actions"
                  actions={[
                    { kind: 'edit', label: 'Редактировать платёж', onClick: () => onEdit(payment.id) },
                    { kind: 'delete', label: 'Удалить платёж', onClick: () => onDelete(payment.id) },
                  ]}
                />
              </td>
              <td>
                {payment.company?.name || '-'}
              </td>
              <td className="payments-table__party">{payment.related_company?.name || '-'}</td>
              <td className="payments-table__bank">{payment.bank?.name || '-'}</td>
              <td className="payments-table__party">{payment.counterparty?.name || '-'}</td>
              <td className={`payments-table__amount ${amountClass}`}>
                {formatAmount(payment.signed_amount, payment.currency_code)}
              </td>
              <td>
                {payment.own_expense_amount_eur
                  ? formatAmount(payment.own_expense_amount_eur, payment.own_expense_currency_code || 'EUR')
                  : '-'}
              </td>
              <td>{payment.vat_amount_eur ? formatAmount(payment.vat_amount_eur) : '-'}</td>
              <td>
                {payment.income_expense_eur
                  ? formatAmount(payment.income_expense_eur, payment.company_commission_currency_code || 'EUR')
                  : '-'}
              </td>
              <td>{payment.client?.name || '-'}</td>
              <td>
                <div className="payments-table__comment">
                  <span>{payment.notes || payment.payment_purpose || '-'}</span>
                  {payment.attachments?.length ? (
                    <div className="payments-table__attachments">
                      {payment.attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          className="payments-table__attachment"
                          onClick={() => window.open(buildPaymentAttachmentUrl(attachment.id), '_blank', 'noopener,noreferrer')}
                          title={attachment.file_name}
                        >
                          <Paperclip size={14} />
                          <span>{attachment.file_name}</span>
                          <Eye size={14} />
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </td>
              <td>
                <span className="payments-table__pill">{payment.status.replaceAll('_', ' ')}</span>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default function PaymentsPage() {
  const navigate = useNavigate()
  const [refreshKey, setRefreshKey] = useState(0)
  const [paymentsState, setPaymentsState] = useState({
    isLoading: true,
    error: '',
    total: 0,
    items: [],
  })
  const [exportState, setExportState] = useState({ isLoading: false, error: '' })
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: toDateInputValue(new Date()),
    search: '',
    company: null,
    companyText: '',
    bank: null,
    bankText: '',
    currency: null,
    currencyText: '',
    client: null,
    clientText: '',
    includeIncoming: true,
    includeOutgoing: true,
  })

  const deferredSearch = useDeferredValue(filters.search)

  const paymentsQuery = useMemo(() => ({
    date_from: filters.dateFrom || undefined,
    date_to: filters.dateTo || undefined,
    search: deferredSearch || undefined,
    company_id: filters.company?.value,
    bank_id: filters.bank?.value,
    currency_code: filters.currency?.rawLabel || filters.currency?.value,
    client_id: filters.client?.value,
    include_incoming: filters.includeIncoming,
    include_outgoing: filters.includeOutgoing,
  }), [
    deferredSearch,
    filters.bank,
    filters.client,
    filters.company,
    filters.currency,
    filters.dateFrom,
    filters.dateTo,
    filters.includeIncoming,
    filters.includeOutgoing,
  ])

  useEffect(() => {
    let isCancelled = false

    async function loadPaymentsMeta() {
      try {
        const data = await fetchPaymentsMeta()
        if (!isCancelled && data.earliest_booking_date) {
          setFilters((current) => ({
            ...current,
            dateFrom: current.dateFrom || data.earliest_booking_date,
          }))
        }
      } catch {
        // The list itself can still load; leave the date editable if metadata is unavailable.
      }
    }

    loadPaymentsMeta()

    return () => {
      isCancelled = true
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    async function loadPaymentsList() {
      setPaymentsState((current) => ({ ...current, isLoading: true, error: '' }))

      try {
        const data = await fetchPayments({
          ...paymentsQuery,
          limit: 200,
          offset: 0,
        })

        if (!isCancelled) {
          setPaymentsState({
            isLoading: false,
            error: '',
            total: data.total,
            items: data.items,
          })
        }
      } catch (error) {
        if (!isCancelled) {
          setPaymentsState({
            isLoading: false,
            error: error.response?.data?.detail || 'Не удалось загрузить платежи',
            total: 0,
            items: [],
          })
        }
      }
    }

    loadPaymentsList()

    return () => {
      isCancelled = true
    }
  }, [paymentsQuery, refreshKey])

  const summary = useMemo(() => {
    const incomeTotal = paymentsState.items
      .filter((item) => item.payment_direction === 'incoming')
      .reduce((total, item) => total + toNumber(item.signed_amount), 0)
    const outgoingTotal = paymentsState.items
      .filter((item) => item.payment_direction === 'outgoing')
      .reduce((total, item) => total + Math.abs(toNumber(item.signed_amount)), 0)
    const balance = incomeTotal - outgoingTotal
    return { incomeTotal, outgoingTotal, balance }
  }, [paymentsState.items])

  function updateFilter(name, value) {
    setFilters((current) => ({ ...current, [name]: value }))
  }

  function clearLookupSelection(keyPrefix, nextText) {
    setFilters((current) => ({
      ...current,
      [`${keyPrefix}Text`]: nextText,
      [keyPrefix]: current[keyPrefix] && nextText !== current[keyPrefix].label ? null : current[keyPrefix],
    }))
  }

  function getExportFilename(response, fallback) {
    const disposition = response.headers?.['content-disposition'] || ''
    const match = disposition.match(/filename="?([^";]+)"?/i)
    return match?.[1] || fallback
  }

  async function handleExport(format) {
    const extension = format === 'pdf' ? 'pdf' : 'xlsx'
    setExportState({ isLoading: true, error: '' })

    try {
      const response = await downloadPaymentsExport(format, paymentsQuery)
      const url = URL.createObjectURL(response.data)
      const link = document.createElement('a')
      link.href = url
      link.download = getExportFilename(response, `payments.${extension}`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
      setExportState({ isLoading: false, error: '' })
    } catch (error) {
      setExportState({
        isLoading: false,
        error: error.response?.data?.detail || 'Не удалось скачать файл',
      })
    }
  }

  async function handleDelete(paymentId) {
    const isConfirmed = window.confirm('Удалить этот платёж? Действие нельзя отменить.')
    if (!isConfirmed) {
      return
    }

    try {
      await deletePayment(paymentId)
      setRefreshKey((current) => current + 1)
    } catch (error) {
      setPaymentsState((current) => ({
        ...current,
        error: error.response?.data?.detail || 'Не удалось удалить платёж',
      }))
    }
  }

  return (
    <PageShell className="payments-page">
      <PageHeader title="Платежи" onBack={() => navigate(-1)} />

        <DataCard>
          <div className="payments-toolbar">
            <div className="payments-toolbar__row">
              <Button variant="primary" onClick={() => navigate('/payments/new')}>
                <Plus size={16} />
                Добавить платеж
              </Button>

              <div className="payments-date-group">
                <input
                  className="payments-date-input"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(event) => updateFilter('dateFrom', event.target.value)}
                />
                <span>-</span>
                <input
                  className="payments-date-input"
                  type="date"
                  value={filters.dateTo}
                  onChange={(event) => updateFilter('dateTo', event.target.value)}
                />
              </div>

              <SearchInput
                value={filters.search}
                onChange={(value) => updateFilter('search', value)}
                placeholder="Поиск по компании, банку, клиенту, комментарию"
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
            </div>

            <div className="payments-toolbar__row filters">
              <div className="payments-filters-grid">
                <LookupField
                  placeholder="Компания"
                  textValue={filters.companyText}
                  selectedOption={filters.company}
                  onTextChange={(value) => clearLookupSelection('company', value)}
                  onSelect={(option) =>
                    setFilters((current) => ({
                      ...current,
                      company: option,
                      companyText: option?.label ?? current.companyText,
                    }))
                  }
                  fetchOptions={(query) => loadLookup('companies', query)}
                />
                <LookupField
                  placeholder="Банк"
                  textValue={filters.bankText}
                  selectedOption={filters.bank}
                  onTextChange={(value) => clearLookupSelection('bank', value)}
                  onSelect={(option) =>
                    setFilters((current) => ({
                      ...current,
                      bank: option,
                      bankText: option?.label ?? current.bankText,
                    }))
                  }
                  fetchOptions={(query) => loadLookup('banks', query)}
                />
                <LookupField
                  placeholder="Валюта"
                  textValue={filters.currencyText}
                  selectedOption={filters.currency}
                  onTextChange={(value) => clearLookupSelection('currency', value.toUpperCase())}
                  onSelect={(option) =>
                    setFilters((current) => ({
                      ...current,
                      currency: option,
                      currencyText: option?.rawLabel ?? current.currencyText,
                    }))
                  }
                  fetchOptions={(query) => loadLookup('currencies', query)}
                />
                <LookupField
                  placeholder="Клиент"
                  textValue={filters.clientText}
                  selectedOption={filters.client}
                  onTextChange={(value) => clearLookupSelection('client', value)}
                  onSelect={(option) =>
                    setFilters((current) => ({
                      ...current,
                      client: option,
                      clientText: option?.label ?? current.clientText,
                    }))
                  }
                  fetchOptions={(query) => loadLookup('clients', query)}
                />
              </div>

              <div className="payments-checkboxes">
                <label className="payments-checkbox">
                  <span>Списание</span>
                  <input
                    type="checkbox"
                    checked={filters.includeOutgoing}
                    onChange={(event) => updateFilter('includeOutgoing', event.target.checked)}
                  />
                </label>
                <label className="payments-checkbox">
                  <span>Поступление</span>
                  <input
                    type="checkbox"
                    checked={filters.includeIncoming}
                    onChange={(event) => updateFilter('includeIncoming', event.target.checked)}
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="payments-status">
            <div>
              Найдено <strong>{paymentsState.total}</strong> платежей за период{' '}
              <strong>
                {filters.dateFrom || '...'} - {filters.dateTo || '...'}
              </strong>
            </div>
            <div>
              {paymentsState.error ? <span className="payments-status__error">{paymentsState.error}</span> : null}
              {exportState.error ? <span className="payments-status__error">{exportState.error}</span> : null}
            </div>
          </div>

          <TableWrap>
            {paymentsState.isLoading ? (
              <TableEmpty>Загружаю платежи...</TableEmpty>
            ) : paymentsState.items.length === 0 ? (
              <EmptyState search={Boolean(filters.search)} />
            ) : (
              <PaymentsTable
                rows={paymentsState.items}
                onEdit={(paymentId) => navigate(`/payments/${paymentId}/edit`)}
                onDelete={handleDelete}
              />
            )}
          </TableWrap>

          <div className="payments-summary">
            <div className="payments-summary__item">
              <span className="payments-summary__label">Поступления</span>
              <span className="payments-summary__value">{formatAmount(summary.incomeTotal)}</span>
            </div>
            <div className="payments-summary__item">
              <span className="payments-summary__label">Списания</span>
              <span className="payments-summary__value">{formatAmount(summary.outgoingTotal)}</span>
            </div>
            <div className="payments-summary__item">
              <span className="payments-summary__label">Баланс периода</span>
              <span className="payments-summary__value">{formatAmount(summary.balance)}</span>
            </div>
          </div>
        </DataCard>

      <ExportActions
        actions={[
          {
            label: exportState.isLoading ? 'Скачивание...' : 'Скачать Excel',
            badge: 'XLS',
            disabled: exportState.isLoading,
            onClick: () => handleExport('excel'),
          },
          {
            label: exportState.isLoading ? 'Скачивание...' : 'Скачать PDF',
            badge: 'PDF',
            disabled: exportState.isLoading,
            onClick: () => handleExport('pdf'),
          },
          {
            label: 'Экспорт',
            icon: <Download size={14} />,
            disabled: exportState.isLoading,
            onClick: () => handleExport('excel'),
            title: 'Скачать Excel',
          },
        ]}
      />
    </PageShell>
  )
}
