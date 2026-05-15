import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Check, ChevronDown, LoaderCircle } from 'lucide-react'
import './LookupField.css'

export default function LookupField({
  label,
  placeholder,
  textValue,
  selectedOption,
  onTextChange,
  onSelect,
  fetchOptions,
  fetchOnOpenQuery,
  disabled = false,
  helperText,
}) {
  const fieldId = useId()
  const rootRef = useRef(null)
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [options, setOptions] = useState([])
  const [queryOverride, setQueryOverride] = useState(null)
  const [panelStyle, setPanelStyle] = useState(null)

  const updatePanelPosition = useCallback(() => {
    const root = rootRef.current
    if (!root) {
      return
    }

    const control = root.querySelector('.lookup-field__control')
    const rect = (control || root).getBoundingClientRect()
    setPanelStyle({
      position: 'fixed',
      inset: 'auto auto auto auto',
      top: `${rect.bottom + 6}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
    })
  }, [])

  useEffect(() => {
    if (!isOpen || disabled) {
      setPanelStyle(null)
      return undefined
    }

    updatePanelPosition()
    window.addEventListener('resize', updatePanelPosition)
    window.addEventListener('scroll', updatePanelPosition, true)

    return () => {
      window.removeEventListener('resize', updatePanelPosition)
      window.removeEventListener('scroll', updatePanelPosition, true)
    }
  }, [disabled, isOpen, updatePanelPosition])

  useEffect(() => {
    if (!isOpen || disabled) {
      return undefined
    }

    let cancelled = false
    const timerId = window.setTimeout(async () => {
      setIsLoading(true)
      setLoadError('')

      try {
        const selectedText = selectedOption?.label || ''
        const shouldUseOpenQuery =
          fetchOnOpenQuery !== undefined && selectedText && textValue.trim() === selectedText
        const query = queryOverride ?? (shouldUseOpenQuery ? fetchOnOpenQuery : textValue.trim())
        const items = await fetchOptions(query)
        if (!cancelled) {
          setOptions(items)
          setQueryOverride(null)
        }
      } catch {
        if (!cancelled) {
          setLoadError('Не удалось загрузить список')
          setOptions([])
          setQueryOverride(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }, 180)

    return () => {
      cancelled = true
      window.clearTimeout(timerId)
    }
  }, [disabled, fetchOnOpenQuery, fetchOptions, isOpen, queryOverride, selectedOption, textValue])

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false)
      }
    }

    window.addEventListener('pointerdown', handlePointerDown)
    return () => window.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  const hasExactMatch = useMemo(() => {
    const normalized = textValue.trim().toLowerCase()
    if (!normalized) {
      return false
    }
    return options.some((option) => option.label.toLowerCase() === normalized)
  }, [options, textValue])

  function handleInputChange(event) {
    const nextValue = event.target.value
    setQueryOverride(null)
    if (selectedOption && nextValue !== selectedOption.label) {
      onSelect(null)
    }
    onTextChange(nextValue)
    updatePanelPosition()
    setIsOpen(true)
  }

  function handleOptionPick(option) {
    onSelect(option)
    onTextChange(option.label)
    setIsOpen(false)
  }

  function openWithDefaultQuery() {
    if (!isOpen && fetchOnOpenQuery !== undefined) {
      setQueryOverride(fetchOnOpenQuery)
    }
    updatePanelPosition()
    setIsOpen(true)
  }

  function handleToggleClick() {
    if (isOpen) {
      setIsOpen(false)
      return
    }

    if (fetchOnOpenQuery !== undefined) {
      setQueryOverride(fetchOnOpenQuery)
    }
    updatePanelPosition()
    setIsOpen(true)
  }

  return (
    <div className={`lookup-field ${disabled ? 'is-disabled' : ''}`} ref={rootRef}>
      {label ? (
        <label className="lookup-field__label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}

      <div className={`lookup-field__control ${isOpen ? 'is-open' : ''}`}>
        <input
          id={fieldId}
          className="lookup-field__input"
          type="text"
          value={textValue}
          onChange={handleInputChange}
          onFocus={openWithDefaultQuery}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
        />
        <button
          type="button"
          className="lookup-field__toggle"
          onClick={handleToggleClick}
          disabled={disabled}
          aria-label={isOpen ? 'Скрыть варианты' : 'Показать варианты'}
        >
          <ChevronDown size={16} />
        </button>
      </div>

      {(helperText || (isOpen && !disabled)) && (
        <div className="lookup-field__meta">
          {helperText ? <span>{helperText}</span> : <span>&nbsp;</span>}
        </div>
      )}

      {isOpen && !disabled ? (
        <div className="lookup-field__panel" style={panelStyle || undefined} role="listbox">
          {isLoading ? (
            <div className="lookup-field__state">
              <LoaderCircle className="lookup-field__spinner" size={16} />
              Загрузка...
            </div>
          ) : null}

          {!isLoading && loadError ? <div className="lookup-field__state">{loadError}</div> : null}

          {!isLoading && !loadError && options.length === 0 ? (
            <div className="lookup-field__state">
              {textValue.trim()
                ? 'Совпадений нет. Можно сохранить это значение как новое.'
                : 'Начните вводить или выберите из списка.'}
            </div>
          ) : null}

          {!isLoading && !loadError && options.length > 0 ? (
            <div className="lookup-field__options">
              {options.map((option, index) => {
                const isSelected = selectedOption?.value === option.value && selectedOption?.label === option.label
                return (
                  <button
                    key={option.key || `${String(option.value)}:${index}`}
                    type="button"
                    className={`lookup-field__option ${isSelected ? 'is-selected' : ''}`}
                    onMouseDown={(event) => {
                      event.preventDefault()
                      handleOptionPick(option)
                    }}
                  >
                    <span>{option.label}</span>
                    {isSelected ? <Check size={14} /> : null}
                  </button>
                )
              })}
            </div>
          ) : null}

          {!isLoading && !loadError && !hasExactMatch && textValue.trim() ? (
            <div className="lookup-field__footer">Нового значения пока нет в справочнике.</div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
