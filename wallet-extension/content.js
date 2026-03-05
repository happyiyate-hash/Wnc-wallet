
/**
 * WEVINA CONTENT SENTINEL
 * Relays messages between the Injected Provider and the Background Service Worker.
 */

// 1. Inject the provider script into the DOM
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 2. Listen for messages from the webpage
window.addEventListener("message", (event) => {
  // Security check: Only listen to messages from our own window
  if (event.source !== window) return;

  if (event.data.type === "WEVINA_WALLET_REQUEST_ACCOUNTS") {
    // Forward request to background script
    chrome.runtime.sendMessage({ type: "GET_ACCOUNTS" }, (accounts) => {
      // Send result back to the webpage
      window.postMessage({ 
        type: "WEVINA_WALLET_ACCOUNTS", 
        accounts: accounts || [] 
      }, "*");
    });
  }
});
