/**
 * ConfirmDialog - Modal de confirmación personalizado
 */
import React from 'react'
import ReactDOM from 'react-dom'

const ConfirmDialog = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = '¿Estás seguro?',
  message,
  confirmText = 'Eliminar',
  cancelText = 'Cancelar',
  type = 'danger' // 'danger' | 'warning' | 'info'
}) => {
  if (!isOpen) return null

  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const handleCancel = () => {
    onClose()
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return ReactDOM.createPortal(
    <div className="confirm-dialog-overlay" onClick={handleBackdropClick}>
      <div className="confirm-dialog" role="dialog" aria-labelledby="confirm-dialog-title">
        <div className="confirm-dialog__header">
          <div className={`confirm-dialog__icon confirm-dialog__icon--${type}`}>
            {type === 'danger' && '⚠️'}
            {type === 'warning' && '❗'}
            {type === 'info' && 'ℹ️'}
          </div>
          <h3 id="confirm-dialog-title" className="confirm-dialog__title">
            {title}
          </h3>
        </div>
        
        <div className="confirm-dialog__body">
          <p className="confirm-dialog__message">{message}</p>
        </div>
        
        <div className="confirm-dialog__footer">
          <button
            type="button"
            className="confirm-dialog__button confirm-dialog__button--cancel"
            onClick={handleCancel}
          >
            {cancelText}
          </button>
          <button
            type="button"
            className={`confirm-dialog__button confirm-dialog__button--confirm confirm-dialog__button--${type}`}
            onClick={handleConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  , document.body)
}

export default ConfirmDialog
