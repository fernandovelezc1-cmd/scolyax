/**
 * Servicio de sincronización para PWA
 * Gestiona la sincronización de datos cuando se recupera la conexión
 */

import offlineStorage from './offlineStorage'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')

class SyncService {
  constructor() {
    this.isSyncing = false
    this.syncCallbacks = []
    this.setupOnlineListener()
  }

  /**
   * Configura listener para detectar cuando vuelve la conexión
   */
  setupOnlineListener() {
    window.addEventListener('online', () => {
      console.log('🌐 Conexión restaurada, iniciando sincronización...')
      this.syncAll()
    })

    window.addEventListener('offline', () => {
      console.log('🔌 Sin conexión, modo offline activado')
    })
  }

  /**
   * Verifica si hay conexión a internet
   */
  async checkOnline() {
    if (!navigator.onLine) {
      return false
    }

    try {
      const response = await fetch(`${API_URL}/health`, {
        method: 'HEAD',
        cache: 'no-store'
      })
      return response.ok
    } catch {
      return false
    }
  }

  /**
   * Sincroniza todos los datos pendientes
   */
  async syncAll() {
    if (this.isSyncing) {
      console.log('⏳ Sincronización ya en progreso')
      return
    }

    const isOnline = await this.checkOnline()
    if (!isOnline) {
      console.log('🔌 Sin conexión, sincronización cancelada')
      return
    }

    this.isSyncing = true
    console.log('🔄 Iniciando sincronización completa...')

    try {
      await this.syncTasks()
      await this.syncReminders()
      await this.processSyncQueue()
      
      console.log('✅ Sincronización completa exitosa')
      this.notifyCallbacks({ success: true })
    } catch (error) {
      console.error('❌ Error en sincronización:', error)
      this.notifyCallbacks({ success: false, error })
    } finally {
      this.isSyncing = false
    }
  }

  /**
   * Sincroniza tareas no sincronizadas
   */
  async syncTasks() {
    const sessionToken = localStorage.getItem('scolyax.sessionToken')
    if (!sessionToken) {
      console.log('⚠️ No hay sesión activa, omitiendo sincronización de tareas')
      return
    }

    const unsyncedTasks = await offlineStorage.getUnsyncedTasks()
    console.log(`📋 Sincronizando ${unsyncedTasks.length} tareas...`)

    for (const task of unsyncedTasks) {
      try {
        // Si tiene ID del servidor, actualizar
        if (task.serverId) {
          await this.updateTaskOnServer(task, sessionToken)
        } else {
          // Si no, crear nueva
          const serverTask = await this.createTaskOnServer(task, sessionToken)
          // Actualizar con el ID del servidor
          await offlineStorage.updateTask(task.id, { 
            serverId: serverTask.id,
            synced: true 
          })
        }
        
        await offlineStorage.markAsSynced('tasks', task.id)
        console.log('✅ Tarea sincronizada:', task.title)
      } catch (error) {
        console.error('❌ Error sincronizando tarea:', task.title, error)
      }
    }
  }

  /**
   * Sincroniza recordatorios no sincronizados
   */
  async syncReminders() {
    const sessionToken = localStorage.getItem('scolyax.sessionToken')
    if (!sessionToken) {
      console.log('⚠️ No hay sesión activa, omitiendo sincronización de recordatorios')
      return
    }

    const unsyncedReminders = await offlineStorage.getUnsyncedReminders()
    console.log(`⏰ Sincronizando ${unsyncedReminders.length} recordatorios...`)

    for (const reminder of unsyncedReminders) {
      try {
        if (reminder.serverId) {
          await this.updateReminderOnServer(reminder, sessionToken)
        } else {
          const serverReminder = await this.createReminderOnServer(reminder, sessionToken)
          await offlineStorage.updateReminder(reminder.id, { 
            serverId: serverReminder.id,
            synced: true 
          })
        }
        
        await offlineStorage.markAsSynced('reminders', reminder.id)
        console.log('✅ Recordatorio sincronizado:', reminder.title)
      } catch (error) {
        console.error('❌ Error sincronizando recordatorio:', reminder.title, error)
      }
    }
  }

  /**
   * Procesa la cola de sincronización
   */
  async processSyncQueue() {
    const queue = await offlineStorage.getSyncQueue()
    console.log(`📦 Procesando ${queue.length} operaciones en cola...`)

    for (const operation of queue) {
      try {
        await this.processOperation(operation)
        await offlineStorage.removeFromSyncQueue(operation.id)
        console.log('✅ Operación procesada:', operation.type, operation.resource)
      } catch (error) {
        console.error('❌ Error procesando operación:', operation, error)
      }
    }
  }

  /**
   * Procesa una operación individual de la cola
   */
  async processOperation(operation) {
    const sessionToken = localStorage.getItem('scolyax.sessionToken')
    if (!sessionToken) {
      throw new Error('No session token')
    }

    const { type, resource, data } = operation

    if (resource === 'task') {
      if (type === 'CREATE') {
        await this.createTaskOnServer(data, sessionToken)
      } else if (type === 'UPDATE') {
        await this.updateTaskOnServer(data, sessionToken)
      } else if (type === 'DELETE') {
        await this.deleteTaskOnServer(data.id, sessionToken)
      }
    } else if (resource === 'reminder') {
      if (type === 'CREATE') {
        await this.createReminderOnServer(data, sessionToken)
      } else if (type === 'UPDATE') {
        await this.updateReminderOnServer(data, sessionToken)
      } else if (type === 'DELETE') {
        await this.deleteReminderOnServer(data.id, sessionToken)
      }
    }
  }

  // ========== OPERACIONES CON EL SERVIDOR ==========

  async createTaskOnServer(task, sessionToken) {
    const response = await fetch(`${API_URL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        title: task.title,
        course: task.course,
        due_date: task.due_date,
        notes: task.notes,
        status: task.status || 'pending'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create task on server')
    }

    return response.json()
  }

  async updateTaskOnServer(task, sessionToken) {
    const response = await fetch(`${API_URL}/api/tasks/${task.serverId || task.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        title: task.title,
        course: task.course,
        due_date: task.due_date,
        notes: task.notes,
        status: task.status
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update task on server')
    }

    return response.json()
  }

  async deleteTaskOnServer(taskId, sessionToken) {
    const response = await fetch(`${API_URL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete task on server')
    }
  }

  async createReminderOnServer(reminder, sessionToken) {
    const response = await fetch(`${API_URL}/api/reminders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        title: reminder.title,
        description: reminder.description,
        scheduled_at: reminder.scheduled_at,
        type: reminder.type || 'task'
      })
    })

    if (!response.ok) {
      throw new Error('Failed to create reminder on server')
    }

    return response.json()
  }

  async updateReminderOnServer(reminder, sessionToken) {
    const response = await fetch(`${API_URL}/api/reminders/${reminder.serverId || reminder.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sessionToken}`
      },
      body: JSON.stringify({
        title: reminder.title,
        description: reminder.description,
        scheduled_at: reminder.scheduled_at,
        type: reminder.type
      })
    })

    if (!response.ok) {
      throw new Error('Failed to update reminder on server')
    }

    return response.json()
  }

  async deleteReminderOnServer(reminderId, sessionToken) {
    const response = await fetch(`${API_URL}/api/reminders/${reminderId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${sessionToken}`
      }
    })

    if (!response.ok) {
      throw new Error('Failed to delete reminder on server')
    }
  }

  // ========== CALLBACKS ==========

  /**
   * Registra un callback para cuando se complete la sincronización
   */
  onSyncComplete(callback) {
    this.syncCallbacks.push(callback)
  }

  /**
   * Notifica a todos los callbacks registrados
   */
  notifyCallbacks(result) {
    this.syncCallbacks.forEach(callback => {
      try {
        callback(result)
      } catch (error) {
        console.error('Error en callback de sincronización:', error)
      }
    })
  }

  /**
   * Solicita sincronización en background (si está disponible)
   */
  async requestBackgroundSync(tag) {
    if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
      try {
        const registration = await navigator.serviceWorker.ready
        await registration.sync.register(tag)
        console.log('📅 Background sync registrado:', tag)
      } catch (error) {
        console.error('❌ Error registrando background sync:', error)
      }
    }
  }
}

// Exportar instancia única (singleton)
const syncService = new SyncService()
export default syncService
