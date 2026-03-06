
/**
 * INSTITUTIONAL REGISTRY DATABASE (IndexedDB)
 * Version: 1.1.0 (High-Speed Cryptographic Cache & Logo Node)
 * 
 * Provides persistent storage for derived identity nodes and asset branding.
 */

const DB_NAME = 'wevina_registry_v1';
const DB_VERSION = 1;

export interface CachedWallet {
  id: string; // mnemonic fingerprint
  wallets: any[];
  accountNumber: string;
  timestamp: number;
}

export interface CachedLogo {
  id: string; // identifier slug
  url: string;
  blob?: Blob; // Optional: Store raw blob for instant display
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

  async getLogo(id: string): Promise<string | null> {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('logo_registry', 'readonly');
      const store = transaction.objectStore('logo_registry');
      const request = store.get(id);
      request.onsuccess = () => {
        const result = request.result;
        if (result && result.url) {
          resolve(result.url);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => resolve(null);
    });
  }

  async saveLogo(id: string, url: string) {
    const db = await this.init();
    return new Promise((resolve) => {
      const transaction = db.transaction('logo_registry', 'readwrite');
      const store = transaction.objectStore('logo_registry');
      store.put({ id, url, timestamp: Date.now() });
      transaction.oncomplete = () => resolve(true);
    });
  }

  async purgeAll() {
    const db = await this.init();
    const transaction = db.transaction(['vault_cache', 'logo_registry'], 'readwrite');
    transaction.objectStore('vault_cache').clear();
    transaction.objectStore('logo_registry').clear();
    return new Promise((resolve) => {
      transaction.oncomplete = () => resolve(true);
    });
  }
}

export const registryDb = new RegistryDB();
