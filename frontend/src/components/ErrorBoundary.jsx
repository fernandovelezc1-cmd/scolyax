/**
 * Error Boundary Component
 * 
 * Componente que captura errores de React y muestra fallbacks graceful.
 * Implementa estrategia de retry automático y recuperación de errores.
 */

import React, { Component } from 'react';
import { showToast } from './components/NotificationCenter';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
      maxRetries: 3,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error,
      errorInfo,
    });
    
    // Log error
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Enviar a servicio de logging (opcional)
    this.logErrorToService(error, errorInfo);
    
    // Mostrar notificación
    showToast('Error', 'Algo salió mal, intentando recuperar...', 'error');
  }

  logErrorToService = (error, errorInfo) => {
    // Enviar error a servicio de análisis
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: error.toString(),
          stack: errorInfo.componentStack,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href,
        }),
      }).catch(console.error);
    } catch (e) {
      console.error('Failed to log error:', e);
    }
  };

  handleRetry = () => {
    const { retryCount, maxRetries } = this.state;
    
    if (retryCount < maxRetries) {
      this.setState({
        retryCount: retryCount + 1,
        hasError: false,
        error: null,
        errorInfo: null,
      });
      
      showToast('Info', `Reintentando... (${retryCount + 1}/${maxRetries})`, 'info');
    } else {
      showToast('Error', 'No se puede recuperar del error. Por favor, recarga la página.', 'error');
    }
  };

  handleRefresh = () => {
    window.location.reload();
  };

  render() {
    const { hasError, error, errorInfo, retryCount, maxRetries } = this.state;

    if (hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.card}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>⚠️</span>
            </div>
            
            <h1 style={styles.title}>Oops! Algo salió mal</h1>
            
            <p style={styles.message}>
              Encontramos un error inesperado. Estamos trabajando para solucionarlo.
            </p>
            
            {error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Detalles del error</summary>
                <pre style={styles.errorText}>
                  {error.toString()}
                  {errorInfo && errorInfo.componentStack}
                </pre>
              </details>
            )}
            
            <div style={styles.buttonContainer}>
              {retryCount < maxRetries && (
                <button 
                  onClick={this.handleRetry}
                  style={{ ...styles.button, ...styles.retryButton }}
                >
                  🔄 Reintentar ({retryCount + 1}/{maxRetries})
                </button>
              )}
              
              <button 
                onClick={this.handleRefresh}
                style={{ ...styles.button, ...styles.refreshButton }}
              >
                🔁 Recargar página
              </button>
              
              <button 
                onClick={() => window.location.href = '/'}
                style={{ ...styles.button, ...styles.homeButton }}
              >
                🏠 Ir al inicio
              </button>
            </div>
            
            <p style={styles.helpText}>
              Si el problema persiste, contacta a soporte en support@scolyax.app
            </p>
          </div>
          
          {/* Patrón de fondo */}
          <div style={styles.background} />
        </div>
      );
    }

    return this.props.children;
  }
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8f9fa',
    padding: '20px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  
  card: {
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0, 0, 0, 0.1)',
    maxWidth: '500px',
    width: '100%',
    padding: '40px',
    textAlign: 'center',
    zIndex: 10,
    position: 'relative',
  },
  
  iconContainer: {
    marginBottom: '20px',
  },
  
  icon: {
    fontSize: '64px',
    display: 'inline-block',
    animation: 'pulse 2s infinite',
  },
  
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    margin: '0 0 16px 0',
  },
  
  message: {
    fontSize: '16px',
    color: '#666',
    lineHeight: '1.6',
    marginBottom: '24px',
  },
  
  details: {
    marginBottom: '24px',
    backgroundColor: '#f5f5f5',
    padding: '12px',
    borderRadius: '8px',
    textAlign: 'left',
    cursor: 'pointer',
  },
  
  summary: {
    fontWeight: '500',
    color: '#d32f2f',
    cursor: 'pointer',
    userSelect: 'none',
  },
  
  errorText: {
    backgroundColor: '#fafafa',
    padding: '12px',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#d32f2f',
    overflow: 'auto',
    maxHeight: '200px',
    marginTop: '12px',
    border: '1px solid #ffebee',
    fontFamily: 'monospace',
  },
  
  buttonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px',
  },
  
  button: {
    padding: '12px 24px',
    borderRadius: '8px',
    border: 'none',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    width: '100%',
  },
  
  retryButton: {
    backgroundColor: '#2196F3',
    color: 'white',
  },
  
  refreshButton: {
    backgroundColor: '#4CAF50',
    color: 'white',
  },
  
  homeButton: {
    backgroundColor: '#FF9800',
    color: 'white',
  },
  
  helpText: {
    fontSize: '12px',
    color: '#999',
    margin: '0',
  },
  
  background: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
    height: '100%',
    background: 'radial-gradient(circle at 20% 50%, rgba(33, 150, 243, 0.1) 0%, transparent 50%), ' +
                'radial-gradient(circle at 80% 80%, rgba(76, 175, 80, 0.1) 0%, transparent 50%)',
    zIndex: 1,
    pointerEvents: 'none',
  },
};

/**
 * Hook para capturar errores en componentes funcionales
 * 
 * Usage:
 *   const { error, handleError } = useErrorHandler();
 *   
 *   try {
 *     // alguna operación
 *   } catch (err) {
 *     handleError(err, 'Contexto descriptivo');
 *   }
 */
export function useErrorHandler() {
  const handleError = (error, context = '') => {
    console.error(`Error in ${context}:`, error);
    
    showToast('Error', error.message || 'Algo salió mal', 'error');
    
    // Enviar a servicio de logging si es necesario
    if (error.severity === 'critical') {
      // Enviar a Sentry/Rollbar/etc
    }
  };
  
  return { handleError };
}

/**
 * HOC para envolver componentes con error handling
 */
export function withErrorBoundary(Component) {
  return function WithErrorBoundary(props) {
    return (
      <ErrorBoundary>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

/**
 * Hook useAsync con error handling integrado
 */
export function useAsync(
  asyncFunction,
  immediate = true,
  onError = null,
  onSuccess = null
) {
  const [status, setStatus] = React.useState('idle');
  const [value, setValue] = React.useState(null);
  const [error, setError] = React.useState(null);

  const execute = React.useCallback(async () => {
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction();
      setValue(response);
      setStatus('success');
      
      if (onSuccess) {
        onSuccess(response);
      }
      
      return response;
    } catch (error) {
      setError(error);
      setStatus('error');
      
      showToast('Error', error.message || 'Error al cargar datos', 'error');
      
      if (onError) {
        onError(error);
      }
    }
  }, [asyncFunction, onError, onSuccess]);

  React.useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, status, value, error };
}
