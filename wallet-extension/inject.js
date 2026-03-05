
/**
 * WEVINA PROVIDER INJECTION
 * Version: 2.0.0 (Proxy Architecture)
 * Injects a fully generic window.ethereum proxy that forwards all requests to the controller.
 */
(function () {
  const provider = {
    isWevina: true,
    isMetaMask: false,

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
    }
  };

  window.ethereum = provider;
  window.dispatchEvent(new CustomEvent('ethereum#initialized'));
  console.log("[WEVINA_EXTENSION] Proxy Node Injected.");
})();
