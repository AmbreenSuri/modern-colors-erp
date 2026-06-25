// Offline-tolerant queue for receiving actions (scan / weight) — invariant I9.
// Actions are persisted in IndexedDB and flushed to the backend when online.
// The backend endpoints are idempotent, so re-sending a queued action is safe.

import { api } from './api'

const DB_NAME = 'mc-offline'
const STORE = 'receiving'

export interface QueuedAction {
  id?: number
  kind: 'scan' | 'weight'
  uniqueId: string
  weight?: number
  device?: string
  clientTime: string
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true })
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await openDb()
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode)
    const req = fn(t.objectStore(STORE))
    req.onsuccess = () => resolve(req.result as T)
    req.onerror = () => reject(req.error)
  })
}

export async function enqueue(action: QueuedAction): Promise<void> {
  await tx('readwrite', (s) => s.add(action))
}

export async function pending(): Promise<QueuedAction[]> {
  return tx<QueuedAction[]>('readonly', (s) => s.getAll())
}

async function remove(id: number): Promise<void> {
  await tx('readwrite', (s) => s.delete(id))
}

async function send(a: QueuedAction): Promise<void> {
  if (a.kind === 'scan') {
    await api.post('/receiving/scan', {
      uniqueId: a.uniqueId,
      device: a.device,
      clientTime: a.clientTime,
    })
  } else {
    await api.post(`/receiving/${encodeURIComponent(a.uniqueId)}/weight`, {
      weight: a.weight,
      device: a.device,
      clientTime: a.clientTime,
    })
  }
}

/** Try to flush all queued actions. Returns how many were synced. */
export async function flush(): Promise<number> {
  const items = await pending()
  let synced = 0
  for (const item of items) {
    try {
      await send(item)
      if (item.id != null) await remove(item.id)
      synced++
    } catch (err) {
      // Network failure → stop and leave the rest queued for the next attempt.
      if (err instanceof TypeError) break
      // A non-network API error (e.g. 4xx) won't succeed on retry — drop it so
      // the queue doesn't get stuck on a permanently-bad item.
      if (item.id != null) await remove(item.id)
    }
  }
  return synced
}

/** Send now if possible; on network failure, queue for later. Returns 'sent' | 'queued'. */
export async function sendOrQueue(a: QueuedAction): Promise<'sent' | 'queued'> {
  try {
    await send(a)
    return 'sent'
  } catch (err) {
    if (err instanceof TypeError) {
      await enqueue(a)
      return 'queued'
    }
    throw err // real API error — surface to the caller
  }
}
