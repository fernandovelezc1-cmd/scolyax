/**
 * Panel de control de alarmas
 * Permite configurar volumen y habilitar/deshabilitar alarmas
 */
import React, { useEffect, useState } from 'react';
import alarmSystem from '../utils/alarmSystem';

const AlarmControl = () => {
  const [volume, setVolume] = useState(0.3);
  const [enabled, setEnabled] = useState(true);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    alarmSystem.setVolume(volume);
  }, [volume]);

  useEffect(() => {
    alarmSystem.setEnabled(enabled);
  }, [enabled]);

  const testAlarm = (type) => {
    switch (type) {
      case 'completion':
        alarmSystem.playCompletionAlarm();
        break;
      case 'warning':
        alarmSystem.playWarningAlarm();
        break;
      case 'break':
        alarmSystem.playBreakAlarm();
        break;
      default:
        break;
    }
  };

  return (
    <div className="alarm-control">
      <button
        className="alarm-control__toggle"
        onClick={() => setShowControls(!showControls)}
        title="Configuración de alarmas"
        aria-label="Abrir configuración de alarmas"
      >
        🔔
      </button>

      {showControls && (
        <div className="alarm-control__panel">
          <div className="alarm-control__header">
            <h3>Configuración de Alarmas</h3>
            <button
              className="alarm-control__close"
              onClick={() => setShowControls(false)}
              aria-label="Cerrar panel"
            >
              ✕
            </button>
          </div>

          <div className="alarm-control__section">
            <label className="alarm-control__label">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="alarm-control__checkbox"
              />
              <span>Activar alarmas</span>
            </label>
          </div>

          {enabled && (
            <>
              <div className="alarm-control__section">
                <label className="alarm-control__label">
                  Volumen: <span className="alarm-control__value">{Math.round(volume * 100)}%</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.1"
                  value={volume}
                  onChange={(e) => setVolume(parseFloat(e.target.value))}
                  className="alarm-control__slider"
                  style={{ '--thumb-pos': `${volume * 100}%` }}
                />
              </div>

              <div className="alarm-control__section">
                <p className="alarm-control__subtitle">Probar alarmas</p>
                <div className="alarm-control__buttons">
                  <button
                    className="alarm-control__test-btn alarm-control__test-btn--completion"
                    onClick={() => testAlarm('completion')}
                  >
                    Finalización
                  </button>
                  <button
                    className="alarm-control__test-btn alarm-control__test-btn--warning"
                    onClick={() => testAlarm('warning')}
                  >
                    Aviso
                  </button>
                  <button
                    className="alarm-control__test-btn alarm-control__test-btn--break"
                    onClick={() => testAlarm('break')}
                  >
                    Pausa
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AlarmControl;
