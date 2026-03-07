/**
 * INSTITUTIONAL REGISTRY DATABASE (IndexedDB)
 * Version: 1.3.0 (Tiered Memory + Persistent Cache)
 * 
 * Provides high-speed storage for identity nodes and asset branding.
 * Includes an L1 Memory Cache to eliminate UI flicker during component mounting.
 */

const DB_NAME = 'wevina_registry_v1';
const DB_VERSION = 1;

// L1 MEMORY CACHE: Synchronous lookup for active session
const MEMORY_LOGO_CACHE = new Map<string, string>();

export interface CachedWallet {
  id: string; // mnemonic fingerprint
  wallets: any[];
  accountNumber: string;
  timestamp: number;
}

export interface CachedLogo {
  id: string; // identifier slug
  url: string;
  timestamp: number;
}

class RegistryDB {
  private db: IDBDatabase | null = null;

  async init(): Promise<IDBDatabase> {
    if (this.db) return this.db;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('vault_cache')) {
          db.createObjectStore('vault_cache', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('logo_registry')) {
          db.createObjectStore('logo_registry', { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve(this.db);
      };

      request.onerror = () => reject(new Error("Registry DB Init Failed"));
    });
  }

  async getVault(fingerprint: string): Promise<CachedWallet | null> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('vault_cache', 'readonly');
      const store = transaction.objectStore('vault_cache');
      const request = store.get(fingerprint);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => resolve(null);
    });
  }

  async saveVault(data: CachedWallet) {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('vault_cache', 'readwrite');
      const store = transaction.objectStore('vault_cache');
      store.put(data);
      transaction.oncomplete = () => resolve(true);
    });
  }

  // TIRED LOGO LOOKUP (L1 Memory -> L2 DB)
  async getLogo(id: string): Promise<string | null> {
    // 1. Check L1 Memory (Synchronous)
    if (MEMORY_LOGO_CACHE.has(id)) {
      return MEMORY_LOGO_CACHE.get(id)!;
    }

    // 2. Check L2 IndexedDB (Asynchronous)
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('logo_registry', 'readonly');
        const store = transaction.objectStore('logo_registry');
        const request = store.get(id);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.url) {
            // Update L1 for next synchronous access
            MEMORY_LOGO_CACHE.set(id, result.url);
            resolve(result.url);
          } else {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    } catch (e) {
      return null;
    }
  }

  async saveLogo(id: string, url: string) {
    // Update L1
    MEMORY_LOGO_CACHE.set(id, url);

    // Update L2
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('logo_registry', 'readwrite');
        const store = transaction.objectStore('logo_registry');
        store.put({ id, url, timestamp: Date.now() });
        transaction.oncomplete = () => resolve(true);
      });
    } catch (e) {
      return false;
    }
  }

  async purgeAll() {
    MEMORY_LOGO_CACHE.clear();
    try {
      const db = await this.init();
      const transaction = db.transaction(['vault_cache', 'logo_registry'], 'readwrite');
      transaction.objectStore('vault_cache').clear();
      transaction.objectStore('logo_registry').clear();
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
      });
    } catch (e) {
      return false;
    }
  }
}

export const registryDb = new RegistryDB();
