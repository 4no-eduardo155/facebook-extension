chrome.runtime.onInstalled.addListener(() => {
    console.log("AutoFill Image Extension Installed!");
});

chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.action !== 'openDrafts') return;

    chrome.tabs.create({ url: 'https://www.facebook.com/marketplace/you/selling' }, (tab) => {
        const tabId = tab.id;
        const listener = (updatedTabId, changeInfo) => {
            if (updatedTabId === tabId && changeInfo.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);
                setTimeout(() => {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ['content_draft_opener.js']
                    }).catch(err => console.warn('Draft opener injection failed:', err));
                }, 1800);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
});