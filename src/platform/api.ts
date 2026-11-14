import { toast } from '../store/useToastStore'
import { createBrowserApi, StorageWriteError, unavailableStorage } from './browserApi'
import type { CustomApi } from './types'

/** localStorage, or a stand-in that refuses writes when the browser blocks it. */
function browserStorage(): Storage {
  try {
    const storage = window.localStorage
    storage.getItem('ev-cost:probe')
    return storage
  } catch {
    return unavailableStorage()
  }
}

/**
 * The store reports failed project changes and deletes with a toast, but lets
 * the forms show add, edit and import errors inline. A full or blocked browser
 * storage is worth a toast wherever it happens, so those three add one here.
 */
function toastStorageFailures(api: CustomApi): CustomApi {
  const wrap =
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
    async (...args: A): Promise<R> => {
      try {
        return await fn(...args)
      } catch (err) {
        if (err instanceof StorageWriteError) toast.error(`${err.message}.`)
        throw err
      }
    }
  return {
    ...api,
    costs: {
      ...api.costs,
      addItem: wrap(api.costs.addItem),
      updateItem: wrap(api.costs.updateItem),
      bulkImport: wrap(api.costs.bulkImport)
    }
  }
}

/**
 * The data bridge the stores talk to. On the desktop it is the API the Electron
 * preload script exposes; on the web it is backed by this browser's localStorage,
 * so nothing else has to know which it is running on.
 */
export const api: CustomApi = toastStorageFailures(createBrowserApi(browserStorage()))
