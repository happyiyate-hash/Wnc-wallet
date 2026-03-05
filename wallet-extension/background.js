
/**
 * WEVINA BACKGROUND WORKER
 * Manages institutional state and handles secure registry requests.
 */

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === "GET_ACCOUNTS") {
    // Fetch authorized accounts from extension local storage
    chrome.storage.local.get(["accounts"], (result) => {
      sendResponse(result.accounts || []);
    });
    return true; // Keeps the message channel open for async response
  }
});
