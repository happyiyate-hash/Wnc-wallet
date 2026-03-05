
/**
 * WEVINA PROVIDER INJECTION
 * Version: 1.0.0
 * Injects window.ethereum into the target webpage context.
 */
(function () {
  const provider = {
    isWevina: true,
    isMetaMask: false, // Explicitly identifying as Wevina Node

    request: async ({ method, params }) => {
      console.log(`[WEVINA_EXTENSION] Request: ${method}`, params);

      if (method === "eth_requestAccounts" || method === "eth_accounts") {
        return new Promise((resolve) => {
          // Dispatch handshake request to content script
          window.postMessage({
            type: "WEVINA_WALLET_REQUEST_ACCOUNTS"
          }, "*");

          // Wait for registry response
          const handleResponse = (event) => {
            if (event.data.type === "WEVINA_WALLET_ACCOUNTS") {
              window.removeEventListener("message", handleResponse);
              resolve(event.data.accounts);
            }
          };
          window.addEventListener("message", handleResponse);
        });
      }

      // Placeholder for other RPC methods (eth_sendTransaction, etc.)
      console.warn(`[WEVINA_EXTENSION] Method ${method} not yet implemented in this node.`);
      return null;
    }
  };

  window.ethereum = provider;
  console.log("[WEVINA_EXTENSION] Handshake Node Injected.");
})();
