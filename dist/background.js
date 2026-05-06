chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'TAKE_SCREENSHOT') {
    const windowId = sender.tab ? sender.tab.windowId : null;
    chrome.tabs.captureVisibleTab(windowId, { format: 'png' }, (dataUrl) => {
      chrome.storage.local.set({ pendingCapture: dataUrl }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=capture') });
      });
    });
  } else if (request.action === 'PROCESS_SCREENSHOT') {
      chrome.storage.local.set({ pendingCapture: request.dataUrl }, () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=capture') });
      });
  } else if (request.action === 'OPEN_CAPTURE_AUTOPASTE') {
      chrome.tabs.create({ url: chrome.runtime.getURL('index.html?view=capture&autoPaste=true') });
  } else if (request.action === 'GET_TAB_IMAGE') {
      const winId = sender.tab ? sender.tab.windowId : null;
      chrome.tabs.captureVisibleTab(winId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) {
             sendResponse({ error: chrome.runtime.lastError.message });
          } else {
             sendResponse({ dataUrl });
          }
      });
      return true; // Keep message channel open for async sendResponse
  }
});

chrome.commands.onCommand.addListener((command) => {
  if (command === 'take_screenshot') {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, { action: 'START_SNIP' }, () => {
           if (chrome.runtime.lastError) {
             console.log("No content script to start snip in background:", chrome.runtime.lastError.message);
           }
        });
      }
    });
  }
});

