
/**
 * WEVINA PROVIDER INJECTION
 * Version: 3.0.0 (EIP-1193 Standard)
 * Injects a fully compliant window.ethereum provider for dApp interoperability.
 */
(function () {
  const listeners = {};

  const provider = {
    isWevina: true,
    isMetaMask: false,
    chainId: "0x1", // Default to Ethereum Mainnet
    selectedAddress: null,

    /**
     * Main RPC Interface
     */
    request: async ({ method, params }) => {
      const requestId = Math.random().toString(36).substring(7);
      console.log(`[WEVINA_PROXY] Dispatching: ${method}`, params);

      return new Promise((resolve, reject) => {
        // Dispatch generic handshake request to content script
        window.postMessage({
          type: "WEVINA_WALLET_RPC_REQUEST",
          requestId,
          method,
          params
        }, "*");

        // Wait for registry response
        const handleResponse = (event) => {
          if (event.data.type === "WEVINA_WALLET_RPC_RESPONSE" && event.data.requestId === requestId) {
            window.removeEventListener("message", handleResponse);
            
            if (event.data.error) {
              reject(new Error(event.data.error));
            } else {
              resolve(event.data.result);
            }
          }
        };
        window.addEventListener("message", handleResponse);
      });
    },

    /**
     * Event Subscription (EIP-1193)
     */
    on: (event, callback) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
    },

    removeListener: (event, callback) => {
      if (!listeners[event]) return;
      listeners[event] = listeners[event].filter(cb => cb !== callback);
    },

    /**
     * Internal Event Dispatcher
     */
    emit: (event, data) => {
      if (!listeners[event]) return;
      listeners[event].forEach(cb => cb(data));
    }
  };

  /**
   * Listen for state updates from the Extension Background
   */
  window.addEventListener("message", (event) => {
    if (event.data.type === "WEVINA_WALLET_EVENT") {
      const { name, data } = event.data;
      
      // Update local provider state for synchronous property access
      if (name === 'accountsChanged') provider.selectedAddress = data[0] || null;
      if (name === 'chainChanged') provider.chainId = data;
      
      // Notify dApp listeners
      provider.emit(name, data);
    }
  });

  // Export to window
  window.ethereum = provider;
  
  // Announcement handshake
  window.dispatchEvent(new CustomEvent('ethereum#initialized'));
  console.log("[WEVINA_EXTENSION] EIP-1193 Provider Node Injected.");
})();
