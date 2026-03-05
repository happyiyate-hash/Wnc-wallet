
/**
 * WEVINA CONTENT SENTINEL
 * Relays RPC requests and State Events between the dApp Proxy and the Background Controller.
 */

// 1. Inject the provider script into the DOM
const script = document.createElement("script");
script.src = chrome.runtime.getURL("inject.js");
script.onload = function () {
  this.remove();
};
(document.head || document.documentElement).appendChild(script);

// 2. Listen for messages from the Proxy (Website)
window.addEventListener("message", (event) => {
  if (event.source !== window) return;

  if (event.data.type === "WEVINA_WALLET_RPC_REQUEST") {
    // Forward RPC payload to background script
    chrome.runtime.sendMessage(event.data);
  }
});

// 3. Listen for signals from the Background Controller (RPC Responses & Events)
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "WEVINA_WALLET_RPC_RESPONSE" || message.type === "WEVINA_WALLET_EVENT") {
    // Relay to the injected provider script
    window.postMessage(message, "*");
  }
});
