import React, { useState, useEffect } from 'react'
import Sticker from './Stickers'
import '../styles/admin-ratings-panel.css'

/**
 * Panel administrativo para ver todas las calificaciones de usuarios
 * Muestra: nombre/email, logro, calificación, comentario, fecha
 */
const AdminRatingsPanel = ({ apiBase = 'http://localhost:8000' }) => {
  const [ratings, setRatings] = useState([])
  const [filteredRatings, setFilteredRatings] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [ratingFilter, setRatingFilter] = useState(0) // 0 = todas
  const [stats, setStats] = useState({
    total: 0,
    average: 0,
    fiveStarCount: 0,
    withCommentCount: 0
  })

  // Cargar calificaciones
  useEffect(() => {
    loadRatings()
  }, [])

  // Filtrar cuando cambian los filtros
  useEffect(() => {
    filterRatings()
  }, [ratings, searchTerm, ratingFilter])

  const loadRatings = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${apiBase}/admin/feedback`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setRatings(data)
        loadStats()
      }
    } catch (error) {
      console.error('Error cargando calificaciones:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const response = await fetch(`${apiBase}/admin/feedback/stats`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
        }
      })

      if (response.ok) {
        const data = await response.json()
        setStats({
          total: data.total_feedback || 0,
          average: (data.average_rating || 0).toFixed(1),
          fiveStarCount: data.five_star_count || 0,
          withCommentCount: data.with_comment_count || 0
        })
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error)
    }
  }

  const filterRatings = () => {
    let filtered = [...ratings]

    // Filtrar por búsqueda (email, nombre o comentario)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      filtered = filtered.filter(r =>
        r.user_email?.toLowerCase().includes(term) ||
        r.user_name?.toLowerCase().includes(term) ||
        r.comment?.toLowerCase().includes(term)
      )
    }

    // Filtrar por calificación
    if (ratingFilter > 0) {
      filtered = filtered.filter(r => r.rating === ratingFilter)
    }

    setFilteredRatings(filtered)
  }

  const renderStars = (rating) => (
    Array.from({ length: 5 }, (_, i) => (
      <Sticker key={i} name="star" size={15} className={i < rating ? '' : 'is-off'} />
    ))
  )

  const formatDate = (dateString) => {
    if (!dateString) return '-'
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
    } catch {
      return dateString
    }
  }

  const exportToCSV = () => {
    const headers = ['Email', 'Nombre', 'Logro', 'Calificación', 'Comentario', 'Fecha']
    const rows = filteredRatings.map(r => [
      r.user_email || '',
      r.user_name || '',
      r.achievement_id || '',
      r.rating || 0,
      `"${(r.comment || '').replace(/"/g, '""')}"`, // Escapar comillas
      formatDate(r.created_at)
    ])

    const csv = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)

    link.setAttribute('href', url)
    link.setAttribute('download', `calificaciones_${new Date().getTime()}.csv`)
    link.style.visibility = 'hidden'

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  return (
    <div className="admin-ratings-panel">
      <div className="panel-header">
        <h2><Sticker name="star" size={26} /> Calificaciones de usuarios</h2>
        <button className="btn-refresh" onClick={loadRatings} disabled={isLoading}>
          {isLoading ? 'Cargando…' : <><Sticker name="repeat" size={15} /> Actualizar</>}
        </button>
      </div>

      {/* Estadísticas */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Total de Calificaciones</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Promedio</div>
          <div className="stat-value">{stats.average} <Sticker name="star" size={20} /></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">5 Estrellas</div>
          <div className="stat-value">{stats.fiveStarCount}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Con Comentario</div>
          <div className="stat-value">{stats.withCommentCount}</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <input
          type="text"
          className="search-input"
          placeholder="Buscar por email, nombre o comentario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <select
          className="rating-filter"
          value={ratingFilter}
          onChange={(e) => setRatingFilter(Number(e.target.value))}
        >
          <option value={0}>Todas las calificaciones</option>
          <option value={5}>5 · Excelente</option>
          <option value={4}>4 · Muy bueno</option>
          <option value={3}>3 · Bueno</option>
          <option value={2}>2 · Regular</option>
          <option value={1}>1 · Pobre</option>
        </select>

        <button className="btn-export" onClick={exportToCSV}>
          <Sticker name="doc" size={15} /> Exportar CSV
        </button>
      </div>

      {/* Lista de calificaciones */}
      <div className="ratings-container">
        {filteredRatings.length === 0 ? (
          <div className="empty-state">
            <p>No hay calificaciones que coincidan con los filtros</p>
          </div>
        ) : (
          <table className="ratings-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Nombre</th>
                <th>Logro</th>
                <th>Calificación</th>
                <th>Comentario</th>
                <th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {filteredRatings.map((rating, idx) => (
                <tr key={idx} className={`rating-row rating-row--${rating.rating}`}>
                  <td className="cell-email">
                    <span className="email-badge">{rating.user_email || 'N/A'}</span>
                  </td>
                  <td className="cell-name">{rating.user_name || 'Anónimo'}</td>
                  <td className="cell-achievement">{rating.achievement_id || 'N/A'}</td>
                  <td className="cell-rating">
                    <span className="rating-stars">{renderStars(rating.rating)}</span>
                  </td>
                  <td className="cell-comment">
                    <span className="comment-text">{rating.comment || '-'}</span>
                  </td>
                  <td className="cell-date">{formatDate(rating.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      <div className="panel-footer">
        Mostrando {filteredRatings.length} de {ratings.length} calificaciones
      </div>
    </div>
  )
}

export default AdminRatingsPanel
