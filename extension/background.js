// Service Worker for Tab-wide state synchronization broadcasts

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "BROADCAST_STATE") {
    // Distribute state packet to all other open tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach((tab) => {
        if (tab.id && tab.id !== sender.tab?.id) {
          chrome.tabs.sendMessage(tab.id, {
            type: "SYNC_STATE",
            state: message.state
          }).catch(() => {
            // Gracefully ignore scripts not injected yet
          });
        }
      });
    });
    sendResponse({ success: true });
  }
});
