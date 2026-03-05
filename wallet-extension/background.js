
/**
 * WEVINA BACKGROUND CONTROLLER
 * Version: 3.0.0 (EIP-1193 Orchestrator)
 * Manages institutional state and handles secure registry requests.
 */

let pendingRequests = {};
let currentChainId = "0x1"; // Default to Ethereum
let activeAccount = null;

/**
 * Broadcasts a state change event to all active dApp tabs
 */
function broadcastEvent(eventName, data) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, {
        type: "WEVINA_WALLET_EVENT",
        name: eventName,
        data: data
      }).catch(() => {}); // Ignore tabs where extension isn't active
    });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // RPC REQUEST HANDLING
  if (request.type === "WEVINA_WALLET_RPC_REQUEST") {
    const { requestId, method, params } = request;
    
    // Store request in the pending session registry
    pendingRequests[requestId] = {
      requestId,
      method,
      params,
      origin: sender.tab?.url || "Unknown"
    };

    console.log(`[CONTROLLER] New Request Received: ${method}`, pendingRequests[requestId]);

    // TRIGGER POPUP: For sensitive methods, we must alert the user
    if (["eth_requestAccounts", "eth_sendTransaction", "personal_sign"].includes(method)) {
      chrome.storage.local.set({ activeRequest: pendingRequests[requestId] }, () => {
        chrome.action.openPopup();
      });
    } else if (method === "eth_chainId") {
      // Direct response for non-sensitive chain info
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "WEVINA_WALLET_RPC_RESPONSE",
        requestId,
        result: currentChainId
      });
    } else {
      // Placeholder for other non-sensitive methods
      chrome.tabs.sendMessage(sender.tab.id, {
        type: "WEVINA_WALLET_RPC_RESPONSE",
        requestId,
        result: null
      });
    }
  }

  // RESOLUTION HANDLING (From Popup)
  if (request.type === "WEVINA_WALLET_RESOLVE_REQUEST") {
    const { requestId, result, error } = request;
    console.log(`[CONTROLLER] Resolving Request: ${requestId}`, result);

    // If accounts were requested, update internal state and broadcast event
    if (pendingRequests[requestId]?.method === 'eth_requestAccounts' && !error) {
      activeAccount = result[0];
      broadcastEvent('accountsChanged', result);
    }

    // Forward resolution back to the original content script
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: "WEVINA_WALLET_RPC_RESPONSE",
          requestId,
          result,
          error
        }).catch(() => {});
      });
    });

    delete pendingRequests[requestId];
    chrome.storage.local.remove("activeRequest");
  }
});
