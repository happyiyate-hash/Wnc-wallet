
/**
 * WEVINA POPUP CONTROLLER
 * Simulates institutional node authorization for the initial prototype.
 */
document.addEventListener('DOMContentLoaded', () => {
  const connectButton = document.getElementById("connect");
  const addressDisplay = document.getElementById("address");

  // Check if already authorized
  chrome.storage.local.get(["accounts"], (result) => {
    if (result.accounts && result.accounts.length > 0) {
      addressDisplay.innerText = result.accounts[0];
      connectButton.innerText = "Synchronized";
      connectButton.disabled = true;
      connectButton.style.opacity = "0.5";
    }
  });

  connectButton.addEventListener("click", () => {
    // PROTOTYPE HANDSHAKE: Using a mock institutional address
    const mockAccount = "0x835729104AC6729384729104837529104837";

    chrome.storage.local.set({
      accounts: [mockAccount]
    }, () => {
      addressDisplay.innerText = mockAccount;
      connectButton.innerText = "Node Synchronized";
      connectButton.disabled = true;
      connectButton.style.opacity = "0.5";
      
      console.log("[WEVINA_POPUP] Identity Node Authorized.");
    });
  });
});
