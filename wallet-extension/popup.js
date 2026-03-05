
/**
 * WEVINA POPUP CONTROLLER
 * Version: 2.0.0 (Handshake Engine)
 * Manages the approval UI and communicates with the Background Controller.
 */
document.addEventListener('DOMContentLoaded', async () => {
  const addressDisplay = document.getElementById("address");
  const defaultView = document.getElementById("default-view");
  const approvalView = document.getElementById("approval-view");
  
  const originLabel = document.getElementById("request-origin");
  const messageLabel = document.getElementById("request-message");
  
  const approveBtn = document.getElementById("approve");
  const rejectBtn = document.getElementById("reject");

  // Mocked Institutional Address (In production, read from secure storage)
  const myAddress = "0x835729104AC6729384729104837529104837";
  addressDisplay.innerText = `${myAddress.slice(0, 10)}...${myAddress.slice(-8)}`;

  // 1. CHECK FOR PENDING REQUESTS
  chrome.storage.local.get(["activeRequest"], (result) => {
    if (result.activeRequest) {
      const { requestId, method, origin } = result.activeRequest;
      
      // Update UI for Approval Mode
      defaultView.style.display = "none";
      approvalView.style.display = "block";
      originLabel.innerText = new URL(origin).hostname;
      
      if (method === "eth_requestAccounts") {
        messageLabel.innerText = "Requesting permission to view your identity node.";
        approveBtn.innerText = "Connect";
      } else if (method === "eth_sendTransaction") {
        messageLabel.innerText = "Requesting signature for a new ledger transfer.";
        approveBtn.innerText = "Sign & Send";
      } else {
        messageLabel.innerText = `Requesting: ${method}`;
        approveBtn.innerText = "Authorize";
      }

      // 2. APPROVAL HANDLER
      approveBtn.onclick = () => {
        chrome.runtime.sendMessage({
          type: "WEVINA_WALLET_RESOLVE_REQUEST",
          requestId,
          result: method === "eth_requestAccounts" ? [myAddress] : "0x_mock_tx_hash"
        });
        window.close(); // Close popup after resolution
      };

      // 3. REJECTION HANDLER
      rejectBtn.onclick = () => {
        chrome.runtime.sendMessage({
          type: "WEVINA_WALLET_RESOLVE_REQUEST",
          requestId,
          error: "User rejected the request."
        });
        window.close();
      };
    }
  });
});
