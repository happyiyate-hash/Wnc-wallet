
/**
 * WEVINA BACKGROUND CONTROLLER
 * Version: 2.0.0 (Session Engine)
 * Manages institutional state and handles secure registry requests.
 */

let pendingRequests = {};

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
      // Update local storage so popup can read the session
      chrome.storage.local.set({ activeRequest: pendingRequests[requestId] }, () => {
        // Open the popup window if not already open
        chrome.action.openPopup();
      });
    } else {
      // For non-sensitive read-only methods (mock implementation)
      sendResponse({ result: [] });
    }

    return true; // Keep channel open for async popup response
  }

  // Handle resolution from the Popup UI
  if (request.type === "WEVINA_WALLET_RESOLVE_REQUEST") {
    const { requestId, result, error } = request;
    console.log(`[CONTROLLER] Resolving Request: ${requestId}`, result);

    // Forward resolution back to the original content script
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        chrome.tabs.sendMessage(tab.id, {
          type: "WEVINA_WALLET_RPC_RESPONSE",
          requestId,
          result,
          error
        }).catch(() => {}); // Ignore tabs where extension isn't active
      });
    });

    delete pendingRequests[requestId];
    chrome.storage.local.remove("activeRequest");
  }
});
