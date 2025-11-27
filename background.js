/**
 * Background Service Worker
 * Handles context menu creation and image URL capture
 */

// Create context menu on extension install
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "check-image-real",
    title: "IS THIS IMAGE REAL?",
    contexts: ["image"]
  });
  
  console.log("[Is This Image Real?] Extension installed and context menu created");
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "check-image-real") return;
  
  const imageUrl = info.srcUrl;
  
  // Validate the image URL
  if (!imageUrl) {
    showNotification("Error", "Could not detect image URL. Please try another image.");
    return;
  }
  
  // Check if it's a valid web URL (not base64 or local file)
  if (!isValidWebUrl(imageUrl)) {
    showNotification(
      "Unsupported Image", 
      "This image type is not supported. Please try an image from a website."
    );
    return;
  }
  
  console.log("[Is This Image Real?] Checking image:", imageUrl);
  
  try {
    // Store the image URL for the content script to pick up
    await chrome.storage.local.set({ 
      pendingImageCheck: {
        imageUrl: imageUrl,
        timestamp: Date.now(),
        sourceTabId: tab.id
      }
    });
    
    // Open Gemini in a new tab
    const geminiTab = await chrome.tabs.create({
      url: "https://gemini.google.com/app",
      active: true
    });
    
    console.log("[Is This Image Real?] Opened Gemini tab:", geminiTab.id);
    
  } catch (error) {
    console.error("[Is This Image Real?] Error:", error);
    showNotification("Error", "Something went wrong. Please try again.");
  }
});

/**
 * Check if URL is a valid web URL (http/https)
 */
function isValidWebUrl(url) {
  if (!url) return false;
  
  // Reject base64 encoded images
  if (url.startsWith("data:")) {
    return false;
  }
  
  // Reject local file URLs
  if (url.startsWith("file://")) {
    return false;
  }
  
  // Reject blob URLs
  if (url.startsWith("blob:")) {
    return false;
  }
  
  // Must be http or https
  return url.startsWith("http://") || url.startsWith("https://");
}

/**
 * Show a browser notification to the user
 */
function showNotification(title, message) {
  // Use an alert via the active tab since notifications require extra permission
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: (title, message) => {
          alert(`${title}\n\n${message}`);
        },
        args: [title, message]
      }).catch(err => {
        console.error("Could not show notification:", err);
      });
    }
  });
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "GET_PENDING_IMAGE") {
    chrome.storage.local.get("pendingImageCheck", (result) => {
      sendResponse(result.pendingImageCheck || null);
      
      // Clear the pending image after retrieval
      if (result.pendingImageCheck) {
        chrome.storage.local.remove("pendingImageCheck");
      }
    });
    return true; // Keep channel open for async response
  }
  
  if (message.type === "FETCH_IMAGE") {
    console.log("[Is This Image Real?] Background fetching image:", message.imageUrl);
    
    fetchImageAsDataUrl(message.imageUrl)
      .then(dataUrl => {
        console.log("[Is This Image Real?] Background fetch successful, data URL length:", dataUrl.length);
        sendResponse({ success: true, dataUrl: dataUrl });
      })
      .catch(error => {
        console.error("[Is This Image Real?] Background fetch failed:", error.message);
        sendResponse({ success: false, error: error.message });
      });
    
    return true; // Keep channel open for async response
  }
  
  if (message.type === "CHECK_COMPLETE") {
    console.log("[Is This Image Real?] Check complete:", message.success);
  }
  
  if (message.type === "CHECK_ERROR") {
    console.error("[Is This Image Real?] Check error:", message.error);
  }
});

/**
 * Fetch an image and convert it to a data URL
 * Background scripts have more permissive CORS handling
 */
async function fetchImageAsDataUrl(imageUrl) {
  console.log("[Is This Image Real?] Fetching:", imageUrl);
  
  const response = await fetch(imageUrl, {
    mode: 'cors',
    credentials: 'omit',
    headers: {
      'Accept': 'image/*'
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  const blob = await response.blob();
  console.log("[Is This Image Real?] Got blob, type:", blob.type, "size:", blob.size);
  
  // Convert blob to data URL
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Failed to read image data"));
    reader.readAsDataURL(blob);
  });
}

