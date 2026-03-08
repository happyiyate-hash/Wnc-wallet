/**
 * INSTITUTIONAL REGISTRY DATABASE (IndexedDB)
 * Version: 1.4.0 (Chart Data persistence added)
 * 
 * Provides high-speed storage for identity nodes, asset branding, and market history.
 * Includes an L1 Memory Cache to eliminate UI flicker during component mounting.
 */

const DB_NAME = 'wevina_registry_v1';
const DB_VERSION = 2; // Incremented for chart_data store

// L1 MEMORY CACHE: Synchronous lookup for active session
const MEMORY_LOGO_CACHE = new Map<string, string>();
const MEMORY_CHART_CACHE = new Map<string, any[]>();

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

export interface CachedChart {
  id: string; // tokenIdentifier:range (e.g., ethereum:1D)
  data: any[];
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
        if (!db.objectStoreNames.contains('chart_data')) {
          db.createObjectStore('chart_data', { keyPath: 'id' });
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

  // TIERED LOGO LOOKUP (L1 Memory -> L2 DB)
  async getLogo(id: string): Promise<string | null> {
    if (MEMORY_LOGO_CACHE.has(id)) return MEMORY_LOGO_CACHE.get(id)!;

    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('logo_registry', 'readonly');
        const store = transaction.objectStore('logo_registry');
        const request = store.get(id);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.url) {
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
    MEMORY_LOGO_CACHE.set(id, url);
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

  // CHART DATA PERSISTENCE
  async getChart(id: string): Promise<any[] | null> {
    if (MEMORY_CHART_CACHE.has(id)) return MEMORY_CHART_CACHE.get(id)!;

    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('chart_data', 'readonly');
        const store = transaction.objectStore('chart_data');
        const request = store.get(id);
        request.onsuccess = () => {
          const result = request.result;
          if (result && result.data) {
            MEMORY_CHART_CACHE.set(id, result.data);
            resolve(result.data);
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

  async saveChart(id: string, data: any[]) {
    MEMORY_CHART_CACHE.set(id, data);
    try {
      const db = await this.init();
      return new Promise((resolve) => {
        const transaction = db.transaction('chart_data', 'readwrite');
        const store = transaction.objectStore('chart_data');
        store.put({ id, data, timestamp: Date.now() });
        transaction.oncomplete = () => resolve(true);
      });
    } catch (e) {
      return false;
    }
  }

  async purgeAll() {
    MEMORY_LOGO_CACHE.clear();
    MEMORY_CHART_CACHE.clear();
    try {
      const db = await this.init();
      const transaction = db.transaction(['vault_cache', 'logo_registry', 'chart_data'], 'readwrite');
      transaction.objectStore('vault_cache').clear();
      transaction.objectStore('logo_registry').clear();
      transaction.objectStore('chart_data').clear();
      return new Promise((resolve) => {
        transaction.oncomplete = () => resolve(true);
      });
    } catch (e) {
      return false;
    }
  }
}

export const registryDb = new RegistryDB();
