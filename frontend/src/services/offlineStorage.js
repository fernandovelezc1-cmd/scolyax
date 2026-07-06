/**
 * Servicio de almacenamiento offline usando IndexedDB
 * Permite guardar tareas, recordatorios y datos cuando no hay conexión
 */

const DB_NAME = 'ScolyaxDB'
const DB_VERSION = 1

// Stores (tablas)
const STORES = {
  TASKS: 'tasks',
  REMINDERS: 'reminders',
  SYNC_QUEUE: 'syncQueue',
  USER_DATA: 'userData'
}

class OfflineStorage {
  constructor() {
    this.db = null
    this.initPromise = this.init()
  }

  /**
   * Inicializa la base de datos IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onerror = () => {
        console.error('❌ Error abriendo IndexedDB:', request.error)
        reject(request.error)
      }

      request.onsuccess = () => {
        this.db = request.result
        console.log('✅ IndexedDB inicializado')
        resolve(this.db)
      }

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        console.log('🔧 Actualizando esquema de IndexedDB')

        // Store de Tareas
        if (!db.objectStoreNames.contains(STORES.TASKS)) {
          const taskStore = db.createObjectStore(STORES.TASKS, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          taskStore.createIndex('status', 'status', { unique: false })
          taskStore.createIndex('dueDate', 'due_date', { unique: false })
          taskStore.createIndex('synced', 'synced', { unique: false })
        }

        // Store de Recordatorios
        if (!db.objectStoreNames.contains(STORES.REMINDERS)) {
          const reminderStore = db.createObjectStore(STORES.REMINDERS, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          reminderStore.createIndex('scheduledAt', 'scheduled_at', { unique: false })
          reminderStore.createIndex('synced', 'synced', { unique: false })
        }

        // Store de Cola de Sincronización
        if (!db.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(STORES.SYNC_QUEUE, { 
            keyPath: 'id', 
            autoIncrement: true 
          })
          syncStore.createIndex('timestamp', 'timestamp', { unique: false })
          syncStore.createIndex('type', 'type', { unique: false })
        }

        // Store de Datos de Usuario
        if (!db.objectStoreNames.contains(STORES.USER_DATA)) {
          db.createObjectStore(STORES.USER_DATA, { keyPath: 'key' })
        }
      }
    })
  }

  /**
   * Asegura que la DB está inicializada
   */
  async ensureDB() {
    if (!this.db) {
      await this.initPromise
    }
    return this.db
  }

  // ========== OPERACIONES GENÉRICAS ==========

  /**
   * Guarda un item en un store
   */
  async save(storeName, data) {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      
      const item = {
        ...data,
        synced: false,
        localTimestamp: Date.now()
      }
      
      const request = store.put(item)
      
      request.onsuccess = () => {
        console.log('💾 Item guardado en IndexedDB:', storeName, request.result)
        resolve(request.result)
      }
      
      request.onerror = () => {
        console.error('❌ Error guardando en IndexedDB:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Obtiene todos los items de un store
   */
  async getAll(storeName) {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.getAll()
      
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onerror = () => {
        console.error('❌ Error obteniendo de IndexedDB:', request.error)
        reject(request.error)
      }
    })
  }

  /**
   * Obtiene un item por ID
   */
  async get(storeName, id) {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readonly')
      const store = transaction.objectStore(storeName)
      const request = store.get(id)
      
      request.onsuccess = () => {
        resolve(request.result)
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * Elimina un item por ID
   */
  async delete(storeName, id) {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const request = store.delete(id)
      
      request.onsuccess = () => {
        console.log('🗑️ Item eliminado de IndexedDB:', storeName, id)
        resolve()
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * Actualiza un item
   */
  async update(storeName, id, updates) {
    const item = await this.get(storeName, id)
    if (!item) {
      throw new Error('Item no encontrado')
    }
    
    const updated = {
      ...item,
      ...updates,
      synced: false,
      localTimestamp: Date.now()
    }
    
    return this.save(storeName, updated)
  }

  // ========== TAREAS ==========

  async saveTasks(tasks) {
    const promises = tasks.map(task => this.save(STORES.TASKS, task))
    return Promise.all(promises)
  }

  async getTasks() {
    return this.getAll(STORES.TASKS)
  }

  async saveTask(task) {
    return this.save(STORES.TASKS, task)
  }

  async deleteTask(id) {
    return this.delete(STORES.TASKS, id)
  }

  async updateTask(id, updates) {
    return this.update(STORES.TASKS, id, updates)
  }

  async getUnsyncedTasks() {
    const tasks = await this.getTasks()
    return tasks.filter(task => !task.synced)
  }

  // ========== RECORDATORIOS ==========

  async saveReminders(reminders) {
    const promises = reminders.map(reminder => this.save(STORES.REMINDERS, reminder))
    return Promise.all(promises)
  }

  async getReminders() {
    return this.getAll(STORES.REMINDERS)
  }

  async saveReminder(reminder) {
    return this.save(STORES.REMINDERS, reminder)
  }

  async deleteReminder(id) {
    return this.delete(STORES.REMINDERS, id)
  }

  async updateReminder(id, updates) {
    return this.update(STORES.REMINDERS, id, updates)
  }

  async getUnsyncedReminders() {
    const reminders = await this.getReminders()
    return reminders.filter(reminder => !reminder.synced)
  }

  // ========== COLA DE SINCRONIZACIÓN ==========

  /**
   * Agrega una operación a la cola de sincronización
   */
  async addToSyncQueue(operation) {
    const item = {
      type: operation.type, // 'CREATE', 'UPDATE', 'DELETE'
      resource: operation.resource, // 'task', 'reminder'
      data: operation.data,
      timestamp: Date.now()
    }
    
    return this.save(STORES.SYNC_QUEUE, item)
  }

  /**
   * Obtiene todas las operaciones pendientes de sincronización
   */
  async getSyncQueue() {
    return this.getAll(STORES.SYNC_QUEUE)
  }

  /**
   * Limpia la cola de sincronización después de sincronizar
   */
  async clearSyncQueue() {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([STORES.SYNC_QUEUE], 'readwrite')
      const store = transaction.objectStore(STORES.SYNC_QUEUE)
      const request = store.clear()
      
      request.onsuccess = () => {
        console.log('🧹 Cola de sincronización limpiada')
        resolve()
      }
      
      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  /**
   * Elimina un item de la cola de sincronización
   */
  async removeFromSyncQueue(id) {
    return this.delete(STORES.SYNC_QUEUE, id)
  }

  // ========== DATOS DE USUARIO ==========

  async saveUserData(key, value) {
    return this.save(STORES.USER_DATA, { key, value })
  }

  async getUserData(key) {
    const item = await this.get(STORES.USER_DATA, key)
    return item ? item.value : null
  }

  async deleteUserData(key) {
    return this.delete(STORES.USER_DATA, key)
  }

  // ========== SINCRONIZACIÓN ==========

  /**
   * Marca un item como sincronizado
   */
  async markAsSynced(storeName, id) {
    const db = await this.ensureDB()
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([storeName], 'readwrite')
      const store = transaction.objectStore(storeName)
      const getRequest = store.get(id)
      
      getRequest.onsuccess = () => {
        const item = getRequest.result
        if (item) {
          item.synced = true
          item.syncedAt = Date.now()
          const putRequest = store.put(item)
          
          putRequest.onsuccess = () => resolve()
          putRequest.onerror = () => reject(putRequest.error)
        } else {
          resolve()
        }
      }
      
      getRequest.onerror = () => reject(getRequest.error)
    })
  }

  // ========== UTILIDADES ==========

  /**
   * Limpia toda la base de datos
   */
  async clearAll() {
    const db = await this.ensureDB()
    const storeNames = [STORES.TASKS, STORES.REMINDERS, STORES.SYNC_QUEUE, STORES.USER_DATA]
    
    const promises = storeNames.map(storeName => {
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([storeName], 'readwrite')
        const store = transaction.objectStore(storeName)
        const request = store.clear()
        
        request.onsuccess = () => resolve()
        request.onerror = () => reject(request.error)
      })
    })
    
    return Promise.all(promises)
  }

  /**
   * Obtiene el tamaño estimado del almacenamiento
   */
  async getStorageEstimate() {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate()
      return {
        usage: estimate.usage,
        quota: estimate.quota,
        percentUsed: (estimate.usage / estimate.quota * 100).toFixed(2)
      }
    }
    return null
  }
}

// Exportar instancia única (singleton)
const offlineStorage = new OfflineStorage()
export default offlineStorage
