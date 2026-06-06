import { hasTransferCounterpart } from './paymentTransferUtils'
import './DeletePaymentDialog.css'

export default function DeletePaymentDialog({ payment, isDeleting, onDeleteOne, onDeleteBoth, onCancel }) {
  if (!payment) {
    return null
  }

  const hasCounterpart = hasTransferCounterpart(payment)

  return (
    <div className="delete-payment-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-payment-dialog-title">
      <button type="button" className="delete-payment-dialog__backdrop" onClick={onCancel} aria-label="Отмена" />
      <div className="delete-payment-dialog__panel">
        <h2 id="delete-payment-dialog-title">Удаление платежа</h2>
        <p>
          {hasCounterpart
            ? 'У этого платежа есть парная запись перекидки. Выберите, что удалить.'
            : 'Удалить этот платёж? Действие нельзя отменить.'}
        </p>
        <div className="delete-payment-dialog__actions">
          <button type="button" className="delete-payment-dialog__button" onClick={onCancel} disabled={isDeleting}>
            Отмена
          </button>
          <button type="button" className="delete-payment-dialog__button is-danger" onClick={onDeleteOne} disabled={isDeleting}>
            Удалить только эту запись
          </button>
          {hasCounterpart ? (
            <button type="button" className="delete-payment-dialog__button is-primary-danger" onClick={onDeleteBoth} disabled={isDeleting}>
              Удалить обе записи
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
