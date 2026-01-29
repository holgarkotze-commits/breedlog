import { 
  getAllFromStore, 
  getFromStore, 
  putInStore, 
  putManyInStore, 
  deleteFromStore, 
  addToSyncQueue 
} from './indexeddb';
import { apiRequest } from './queryClient';

export async function fetchWithOffline<T>(
  apiUrl: string, 
  storeName: string,
  options?: { id?: number }
): Promise<T | T[]> {
  if (!navigator.onLine) {
    console.log(`[Offline] Fetching ${storeName} from IndexedDB`);
    if (options?.id) {
      const item = await getFromStore<T>(storeName, options.id);
      if (!item) throw new Error(`${storeName} not found in offline storage`);
      return item;
    }
    return getAllFromStore<T>(storeName);
  }

  try {
    const url = options?.id ? `${apiUrl}/${options.id}` : apiUrl;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (Array.isArray(data)) {
      await putManyInStore(storeName, data);
    } else if (data) {
      await putInStore(storeName, data);
    }
    
    return data;
  } catch (error) {
    console.log(`[Offline] Network error, falling back to IndexedDB for ${storeName}`);
    
    if (options?.id) {
      const item = await getFromStore<T>(storeName, options.id);
      if (item) return item;
    } else {
      const items = await getAllFromStore<T>(storeName);
      if (items.length > 0) return items;
    }
    
    throw error;
  }
}

export async function createWithOffline<T extends { id?: number }>(
  apiUrl: string,
  storeName: string,
  data: Omit<T, 'id'>
): Promise<T> {
  if (!navigator.onLine) {
    const tempId = -Date.now();
    const offlineItem = { ...data, id: tempId } as T;
    
    await putInStore(storeName, offlineItem);
    await addToSyncQueue({
      action: 'create',
      entity: storeName,
      data: data,
    });
    
    console.log(`[Offline] Created ${storeName} with temp ID:`, tempId);
    return offlineItem;
  }

  try {
    const response = await apiRequest('POST', apiUrl, data);
    const result = await response.json();
    await putInStore(storeName, result);
    return result;
  } catch (error) {
    console.log(`[Offline] Create failed, queuing for sync`);
    
    const tempId = -Date.now();
    const offlineItem = { ...data, id: tempId } as T;
    
    await putInStore(storeName, offlineItem);
    await addToSyncQueue({
      action: 'create',
      entity: storeName,
      data: data,
    });
    
    return offlineItem;
  }
}

export async function updateWithOffline<T extends { id: number }>(
  apiUrl: string,
  storeName: string,
  id: number,
  data: Partial<T>
): Promise<T> {
  const existing = await getFromStore<T>(storeName, id);
  const updated = { ...existing, ...data, id } as T;
  
  await putInStore(storeName, updated);
  
  if (!navigator.onLine) {
    await addToSyncQueue({
      action: 'update',
      entity: storeName,
      data: { id, ...data },
    });
    console.log(`[Offline] Update queued for ${storeName} ID:`, id);
    return updated;
  }

  try {
    const response = await apiRequest('PATCH', `${apiUrl}/${id}`, data);
    const result = await response.json();
    await putInStore(storeName, result);
    return result;
  } catch (error) {
    console.log(`[Offline] Update failed, queuing for sync`);
    await addToSyncQueue({
      action: 'update',
      entity: storeName,
      data: { id, ...data },
    });
    return updated;
  }
}

export async function deleteWithOffline(
  apiUrl: string,
  storeName: string,
  id: number
): Promise<void> {
  await deleteFromStore(storeName, id);
  
  if (!navigator.onLine) {
    await addToSyncQueue({
      action: 'delete',
      entity: storeName,
      data: { id },
    });
    console.log(`[Offline] Delete queued for ${storeName} ID:`, id);
    return;
  }

  try {
    await apiRequest('DELETE', `${apiUrl}/${id}`);
  } catch (error) {
    console.log(`[Offline] Delete failed, queuing for sync`);
    await addToSyncQueue({
      action: 'delete',
      entity: storeName,
      data: { id },
    });
  }
}
