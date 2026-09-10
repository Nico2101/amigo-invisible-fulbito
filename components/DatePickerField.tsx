'use client'

import React, { useRef } from 'react'

interface DatePickerFieldProps {
  label?: string
  value: string
  onChange: (value: string) => void
  helperText?: string
}

/**
 * Retorna la fecha del próximo jueves en formato YYYY-MM-DD
 * @param weeksAhead 0 = este/próximo jueves más cercano, 1 = el siguiente jueves
 */
function getUpcomingThursday(weeksAhead: number = 0): string {
  const d = new Date()
  const currentDay = d.getDay() // 0 = Domingo, 4 = Jueves
  let diff = 4 - currentDay
  if (diff <= 0) diff += 7 // Próximo jueves
  diff += weeksAhead * 7
  d.setDate(d.getDate() + diff)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Retorna el último día del mes en curso en formato YYYY-MM-DD
 */
function getEndOfMonth(): string {
  const d = new Date()
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const y = lastDay.getFullYear()
  const m = String(lastDay.getMonth() + 1).padStart(2, '0')
  const day = String(lastDay.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Formatea una fecha YYYY-MM-DD a un texto legible en español
 */
export function formatFriendlyDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const parts = dateStr.split('-').map(Number)
    if (parts.length < 3 || isNaN(parts[0]) || isNaN(parts[1]) || isNaN(parts[2])) {
      return dateStr
    }
    const d = new Date(parts[0], parts[1] - 1, parts[2])
    const formatted = d.toLocaleDateString('es-AR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return formatted.charAt(0).toUpperCase() + formatted.slice(1)
  } catch {
    return dateStr
  }
}

export function DatePickerField({
  label = 'Fecha de entrega / partido',
  value,
  onChange,
  helperText,
}: DatePickerFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openCalendar = () => {
    try {
      if (inputRef.current) {
        if (typeof inputRef.current.showPicker === 'function') {
          inputRef.current.showPicker()
        } else {
          inputRef.current.focus()
        }
      }
    } catch {
      inputRef.current?.focus()
    }
  }

  const esteJueves = getUpcomingThursday(0)
  const proximoJueves = getUpcomingThursday(1)
  const finDeMes = getEndOfMonth()

  return (
    <div className="date-picker-container" style={{ marginBottom: 14 }}>
      {label && (
        <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span>{label}</span>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#6ee7b7' }}>📅 Clic para abrir calendario</span>
        </label>
      )}

      <div
        className="date-input-wrapper"
        onClick={openCalendar}
        style={{
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <input
          ref={inputRef}
          type="date"
          value={value}
          onChange={e => onChange(e.target.value)}
          onClick={e => {
            e.stopPropagation()
            openCalendar()
          }}
          style={{
            cursor: 'pointer',
            paddingRight: '48px',
            colorScheme: 'dark',
          }}
        />

        <button
          type="button"
          className="calendar-toggle-btn"
          aria-label="Desplegar calendario"
          title="Desplegar calendario"
          onClick={e => {
            e.stopPropagation()
            openCalendar()
          }}
          style={{
            position: 'absolute',
            right: '8px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'transparent',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          📅
        </button>
      </div>

      {/* Chips con fechas rápidas típicas para jugar fulbito */}
      <div className="preset-group" style={{ marginTop: 8 }}>
        <button
          type="button"
          className={`preset-btn ${value === esteJueves ? 'active' : ''}`}
          onClick={() => onChange(esteJueves)}
        >
          ⚽ Este Jueves
        </button>
        <button
          type="button"
          className={`preset-btn ${value === proximoJueves ? 'active' : ''}`}
          onClick={() => onChange(proximoJueves)}
        >
          ⚽ Próximo Jueves
        </button>
        <button
          type="button"
          className={`preset-btn ${value === finDeMes ? 'active' : ''}`}
          onClick={() => onChange(finDeMes)}
        >
          🗓️ Fin de Mes
        </button>
        {value && (
          <button
            type="button"
            className="preset-btn"
            style={{ color: '#f87171' }}
            onClick={() => onChange('')}
          >
            ✕ Quitar fecha
          </button>
        )}
      </div>

      {/* Vista previa en lenguaje natural */}
      {value ? (
        <div
          style={{
            marginTop: 8,
            padding: '8px 12px',
            background: '#092113',
            border: '1px solid #1a4f2d',
            borderRadius: 10,
            fontSize: 13,
            color: '#6ee7b7',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span>✓</span>
          <span><strong>Fecha seleccionada:</strong> {formatFriendlyDate(value)}</span>
        </div>
      ) : helperText ? (
        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#88a694' }}>{helperText}</p>
      ) : null}
    </div>
  )
}
