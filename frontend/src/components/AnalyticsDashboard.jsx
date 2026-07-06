/**
 * Analytics Dashboard Component
 * 
 * Muestra métricas de uso, performance y estadísticas del sistema
 */

import React, { useState, useEffect } from 'react';
import './AnalyticsDashboard.css';

export function AnalyticsDashboard() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalFocusSessions: 0,
    averageFocusDuration: 0,
    systemHealth: 'healthy',
    uptime: 0,
    performance: {
      apiResponseTime: 0,
      dbQueryTime: 0,
      cacheHitRate: 0,
    },
  });
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('7d'); // 7d, 30d, 90d, 1y

  useEffect(() => {
    fetchAnalytics();
    // Actualizar cada 5 minutos
    const interval = setInterval(fetchAnalytics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/analytics?range=${timeRange}`);
      
      if (!response.ok) throw new Error('Failed to fetch analytics');
      
      const data = await response.json();
      setStats(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Analytics fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="analytics-loading">Cargando análiticas...</div>;
  }

  const completionRate = stats.totalTasks > 0 
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  const activeUserRate = stats.totalUsers > 0
    ? Math.round((stats.activeUsers / stats.totalUsers) * 100)
    : 0;

  return (
    <div className="analytics-dashboard">
      {/* Header */}
      <div className="analytics-header">
        <h1>📊 Panel de Análitica</h1>
        
        <div className="time-range-selector">
          {['7d', '30d', '90d', '1y'].map(range => (
            <button
              key={range}
              className={`range-btn ${timeRange === range ? 'active' : ''}`}
              onClick={() => setTimeRange(range)}
            >
              {range === '7d' ? '7 días' : range === '30d' ? '30 días' : range === '90d' ? '90 días' : '1 año'}
            </button>
          ))}
        </div>
        
        <button className="refresh-btn" onClick={fetchAnalytics}>
          🔄 Actualizar
        </button>
      </div>

      {error && (
        <div className="analytics-error">
          ⚠️ Error: {error}
        </div>
      )}

      {/* Main Metrics Grid */}
      <div className="metrics-grid">
        {/* User Metrics */}
        <div className="metric-card user-card">
          <div className="metric-icon">👥</div>
          <div className="metric-content">
            <div className="metric-label">Usuarios Totales</div>
            <div className="metric-value">{stats.totalUsers.toLocaleString()}</div>
            <div className="metric-subtext">{stats.activeUsers} activos ({activeUserRate}%)</div>
          </div>
          <div className="metric-trend">↗️ +12%</div>
        </div>

        {/* Tasks Metrics */}
        <div className="metric-card tasks-card">
          <div className="metric-icon">✅</div>
          <div className="metric-content">
            <div className="metric-label">Tareas Completadas</div>
            <div className="metric-value">{stats.completedTasks.toLocaleString()}</div>
            <div className="metric-subtext">de {stats.totalTasks.toLocaleString()} tareas ({completionRate}%)</div>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${completionRate}%` }}></div>
          </div>
        </div>

        {/* Focus Sessions */}
        <div className="metric-card focus-card">
          <div className="metric-icon">🎯</div>
          <div className="metric-content">
            <div className="metric-label">Sesiones de Enfoque</div>
            <div className="metric-value">{stats.totalFocusSessions.toLocaleString()}</div>
            <div className="metric-subtext">Promedio: {stats.averageFocusDuration.toFixed(1)} min</div>
          </div>
          <div className="metric-trend">↗️ +8%</div>
        </div>

        {/* System Health */}
        <div className="metric-card health-card">
          <div className="metric-icon">🏥</div>
          <div className="metric-content">
            <div className="metric-label">Estado del Sistema</div>
            <div className="metric-value">{stats.systemHealth === 'healthy' ? 'Saludable' : 'Degradado'}</div>
            <div className="metric-subtext">Uptime: {(stats.uptime / 86400).toFixed(1)} días</div>
          </div>
          <div className={`status-indicator ${stats.systemHealth}`}></div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="performance-section">
        <h2>⚡ Performance</h2>
        
        <div className="performance-grid">
          <div className="perf-metric">
            <div className="perf-label">Tiempo de Respuesta API</div>
            <div className="perf-value">{stats.performance.apiResponseTime.toFixed(1)}ms</div>
            <div className={`perf-status ${stats.performance.apiResponseTime < 100 ? 'good' : 'warning'}`}>
              {stats.performance.apiResponseTime < 100 ? '✅ Excelente' : '⚠️ Revisar'}
            </div>
          </div>

          <div className="perf-metric">
            <div className="perf-label">Tiempo de BD</div>
            <div className="perf-value">{stats.performance.dbQueryTime.toFixed(1)}ms</div>
            <div className={`perf-status ${stats.performance.dbQueryTime < 50 ? 'good' : 'warning'}`}>
              {stats.performance.dbQueryTime < 50 ? '✅ Óptimo' : '⚠️ Revisar'}
            </div>
          </div>

          <div className="perf-metric">
            <div className="perf-label">Cache Hit Rate</div>
            <div className="perf-value">{stats.performance.cacheHitRate.toFixed(1)}%</div>
            <div className={`perf-status ${stats.performance.cacheHitRate > 70 ? 'good' : 'warning'}`}>
              {stats.performance.cacheHitRate > 70 ? '✅ Bueno' : '⚠️ Mejorar'}
            </div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <h2>📈 Gráficos</h2>
        
        <div className="charts-grid">
          {/* User Growth Chart */}
          <div className="chart-container">
            <h3>Crecimiento de Usuarios</h3>
            <div className="chart-placeholder">
              📊 Gráfico de crecimiento (Next: implementar con Chart.js)
            </div>
          </div>

          {/* Task Completion Chart */}
          <div className="chart-container">
            <h3>Tasa de Completación</h3>
            <div className="chart-placeholder">
              📊 Gráfico de completación (Next: implementar con Chart.js)
            </div>
          </div>

          {/* Response Time Chart */}
          <div className="chart-container">
            <h3>Tiempo de Respuesta</h3>
            <div className="chart-placeholder">
              📊 Gráfico de performance (Next: implementar con Chart.js)
            </div>
          </div>

          {/* Activity Heatmap */}
          <div className="chart-container">
            <h3>Mapa de Actividad</h3>
            <div className="chart-placeholder">
              📊 Heatmap de actividad por hora (Next: implementar)
            </div>
          </div>
        </div>
      </div>

      {/* Top Users Section */}
      <div className="top-users-section">
        <h2>🏆 Usuarios Más Activos</h2>
        
        <table className="users-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Tareas Completadas</th>
              <th>Racha</th>
              <th>Minutos de Enfoque</th>
              <th>Última Actividad</th>
            </tr>
          </thead>
          <tbody>
            {[...Array(5)].map((_, i) => (
              <tr key={i}>
                <td>usuario{i + 1}@example.com</td>
                <td className="number">{Math.floor(Math.random() * 100)}</td>
                <td className="number streak">{Math.floor(Math.random() * 30)} 🔥</td>
                <td className="number">{Math.floor(Math.random() * 500)}</td>
                <td>Hace {Math.floor(Math.random() * 24)} horas</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export Section */}
      <div className="export-section">
        <h2>📥 Exportar</h2>
        
        <div className="export-buttons">
          <button className="export-btn" onClick={() => exportAsCSV()}>
            📄 Descargar CSV
          </button>
          <button className="export-btn" onClick={() => exportAsJSON()}>
            📋 Descargar JSON
          </button>
          <button className="export-btn" onClick={() => exportAsPDF()}>
            🖨️ Generar PDF
          </button>
        </div>
      </div>
    </div>
  );
}

// Funciones de exportación
function exportAsCSV() {
  console.log('Exportando CSV...');
  // Implementar descarga CSV
}

function exportAsJSON() {
  console.log('Exportando JSON...');
  // Implementar descarga JSON
}

function exportAsPDF() {
  console.log('Generando PDF...');
  // Implementar generación PDF
}

export default AnalyticsDashboard;
