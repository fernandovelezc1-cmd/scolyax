// Utilidades para parseo de fechas usadas por el calendario

// Parsea una cadena de fecha/fecha-hora para el calendario.
// Objetivo: cuando la fecha representa solo un día (p. ej. "2025-10-29")
// o una ISO con midnight Z ("2025-10-29T00:00:00Z"), interpretarla como
// fecha local (crear new Date(y, m-1, d)). Si la cadena incluye una hora
// distinta de la medianoche con información horaria, preservamos la hora.
export const parseDateForCalendar = (value) => {
  if (!value) return null
  const str = String(value)
  // Coincide con YYYY-MM-DD o YYYY-MM-DDT00:00:00Z (posible .sss)
  const dateOnlyMatch = str.match(/^(\d{4}-\d{2}-\d{2})(?:T00:00:00(?:\.\d+)?Z)?$/)
  if (dateOnlyMatch) {
    const [y, m, d] = dateOnlyMatch[1].split('-').map(Number)
    return new Date(y, m - 1, d)
  }

  // Para otras formas (ISO con hora), dejar que Date maneje la representación
  // y use la hora local resultante.
  const parsed = new Date(str)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

export default { parseDateForCalendar }
