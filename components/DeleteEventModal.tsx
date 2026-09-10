'use client'

import React from 'react'

interface DeleteEventModalProps {
  isOpen: boolean
  eventName: string
  eventCode: string
  isFinished: boolean // true si status === 'drawn'
  memberCount: number
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteEventModal({
  isOpen,
  eventName,
  eventCode,
  isFinished,
  memberCount,
  busy = false,
  onConfirm,
  onCancel,
}: DeleteEventModalProps) {
  if (!isOpen) return null

  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!busy) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        className="modal-panel"
        onClick={e => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: '100%',
          background: isFinished ? '#0c1a11' : '#1e0c0a',
          border: isFinished ? '1px solid #235431' : '2px solid #ef4444',
          borderRadius: 20,
          padding: '24px 20px',
          boxShadow: isFinished
            ? '0 20px 50px rgba(0,0,0,0.7)'
            : '0 0 40px rgba(239, 68, 68, 0.35)',
          animation: 'fadeIn 0.2s ease',
        }}
      >
        {/* Encabezado y badge de advertencia */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: isFinished ? '#163520' : '#450a0a',
              border: isFinished ? '1px solid #28633c' : '1px solid #991b1b',
              fontSize: 22,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            {isFinished ? '🗑️' : '⚠️'}
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: isFinished ? '#86efac' : '#f87171',
              }}
            >
              {isFinished ? 'Eliminar Sorteo' : '¡Cuidado: Evento No Finalizado!'}
            </div>
            <h3 style={{ margin: '2px 0 0', fontSize: 19, color: '#fff', fontWeight: 900 }}>
              {isFinished ? '¿Eliminar este sorteo?' : '¿Eliminar antes de sortear?'}
            </h3>
          </div>
        </div>

        {/* Cuerpo explicativo */}
        {!isFinished ? (
          <div
            style={{
              background: '#2d0a07',
              border: '1px solid #7f1d1d',
              borderRadius: 14,
              padding: 14,
              margin: '16px 0',
            }}
          >
            <div style={{ color: '#fca5a5', fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
              <p style={{ margin: '0 0 8px' }}>
                El evento <strong>&ldquo;{eventName}&rdquo; (#{eventCode})</strong> todavía <strong>no ha finalizado</strong> (el sorteo no se realizó).
              </p>
              <p style={{ margin: '0 0 8px', color: '#fed7d7' }}>
                Hay <strong>{memberCount} participante{memberCount === 1 ? '' : 's'}</strong> en la sala esperando el sorteo.
              </p>
              <p style={{ margin: 0, fontSize: 13, color: '#f87171' }}>
                Si lo eliminás, la sala se cerrará de inmediato y todos los datos, miembros y camisetas no deseadas se borrarán definitivamente.
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              background: '#092113',
              border: '1px solid #1a4f2d',
              borderRadius: 14,
              padding: 14,
              margin: '16px 0',
            }}
          >
            <p style={{ margin: 0, color: '#bbf7d0', fontSize: 14, lineHeight: 1.5 }}>
              El evento <strong>&ldquo;{eventName}&rdquo; (#{eventCode})</strong> ya fue finalizado y sorteado. Si lo eliminás, se borrarán permanentemente las asignaciones secretas y el historial de la sala.
            </p>
          </div>
        )}

        <p style={{ margin: '12px 0 20px', fontSize: 13, color: '#94a3b8', textAlign: 'center' }}>
          Esta acción <strong>no se puede deshacer</strong>.
        </p>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button"
            onClick={onConfirm}
            disabled={busy}
            style={{
              flex: 1,
              background: 'linear-gradient(135deg, #ef4444, #b91c1c)',
              color: '#fff',
              border: '1px solid #f87171',
              padding: '13px 18px',
              fontSize: 14,
              fontWeight: 800,
              borderRadius: 12,
              cursor: busy ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)',
            }}
          >
            {busy
              ? 'Eliminando…'
              : !isFinished
              ? '⚠️ Sí, eliminar de todos modos'
              : '🗑️ Sí, eliminar evento'}
          </button>

          <button
            type="button"
            className="button secondary"
            onClick={onCancel}
            disabled={busy}
            style={{
              padding: '13px 18px',
              fontSize: 14,
              borderRadius: 12,
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
