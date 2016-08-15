'use strict';

chrome.runtime.onConnect.addListener(extensionPort => {
  window.addEventListener('message', event => {
    if (event.source !== window) {
      return;
    }
    switch (event.data.type) {
      case 'connect':
        return;
      case 'set-token':
        extensionPort.postMessage(event.data.token);
        break;
    }
  });
  // Connect to the page.
  window.postMessage({'type': 'connect'}, '*');
});
