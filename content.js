/**
 * Content Script for Gemini
 * Handles image upload and @SynthID query automation
 */

// Constants defined at module scope for accessibility
const LOG_PREFIX = "[Is This Image Real?]";
const MAX_WAIT_TIME = 30000; // 30 seconds max wait
const POLL_INTERVAL = 500;   // Check every 500ms

(async function() {
  "use strict";
  
  console.log(`${LOG_PREFIX} Content script loaded on Gemini`);
  
  // Check if we have a pending image to process
  const pendingImage = await getPendingImage();
  
  if (!pendingImage) {
    console.log(`${LOG_PREFIX} No pending image check, exiting`);
    return;
  }
  
  // Check if the pending image is recent (within last 30 seconds)
  if (Date.now() - pendingImage.timestamp > 30000) {
    console.log(`${LOG_PREFIX} Pending image is too old, ignoring`);
    return;
  }
  
  console.log(`${LOG_PREFIX} Processing image:`, pendingImage.imageUrl);
  
  // Show loading indicator
  showLoadingOverlay();
  
  try {
    // Wait for Gemini to fully load
    const inputArea = await waitForGeminiReady();
    console.log(`${LOG_PREFIX} Gemini is ready, input area found:`, inputArea);
    
    // Small delay to ensure everything is settled
    await delay(1000);
    
    // ============================================
    // STEP 1: Type @SynthID FIRST (while input is clean)
    // ============================================
    // Hide overlay temporarily so dropdown is visible
    hideLoadingOverlay();
    showTypingOverlay();
    
    console.log(`${LOG_PREFIX} Step 1: Typing @SynthID query...`);
    await typeSynthIDQuery(inputArea);
    console.log(`${LOG_PREFIX} Query typed successfully`);
    
    // Small delay before uploading
    await delay(500);
    
    // ============================================
    // STEP 2: Upload the image
    // ============================================
    hideTypingOverlay();
    showUploadingOverlay();
    
    console.log(`${LOG_PREFIX} Step 2: Fetching image...`);
    const imageBlob = await fetchImage(pendingImage.imageUrl);
    console.log(`${LOG_PREFIX} Image fetched, size:`, imageBlob.size);
    
    console.log(`${LOG_PREFIX} Step 3: Uploading image...`);
    await uploadImageToGemini(imageBlob, pendingImage.imageUrl);
    console.log(`${LOG_PREFIX} Image upload complete`);
    
    // Wait for upload to process
    await delay(2000);
    
    // Verify image was uploaded
    const imageUploaded = checkForUploadedImage();
    console.log(`${LOG_PREFIX} Image upload verified:`, imageUploaded);
    
    if (!imageUploaded) {
      console.log(`${LOG_PREFIX} WARNING: Image may not have uploaded.`);
    }
    
    // ============================================
    // STEP 3: Auto-send the message!
    // ============================================
    hideUploadingOverlay();
    showSendingOverlay();
    
    await delay(800);
    console.log(`${LOG_PREFIX} Step 4: Auto-sending message...`);
    const sendSuccess = await clickSendButton();
    
    // All done!
    hideSendingOverlay();
    
    if (sendSuccess) {
      showCompletionAnimation();
    } else {
      // Show manual send prompt if auto-send failed
      showManualSendPrompt();
    }
    
    // Notify background script
    chrome.runtime.sendMessage({ type: "CHECK_COMPLETE", success: true });
    
  } catch (error) {
    console.error(`${LOG_PREFIX} Error:`, error);
    hideLoadingOverlay();
    showErrorMessage(error.message);
    chrome.runtime.sendMessage({ type: "CHECK_ERROR", error: error.message });
  }
})();

/**
 * Get pending image from background script
 */
function getPendingImage() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: "GET_PENDING_IMAGE" }, (response) => {
      resolve(response);
    });
  });
}

/**
 * Wait for Gemini's chat interface to be ready
 */
async function waitForGeminiReady() {
  const startTime = Date.now();
  
  // First, wait for document to be fully loaded
  if (document.readyState !== 'complete') {
    console.log(`${LOG_PREFIX} Waiting for document to load...`);
    await new Promise(resolve => {
      window.addEventListener('load', resolve, { once: true });
      // Fallback in case load already fired
      setTimeout(resolve, 2000);
    });
  }
  
  // Give the app time to hydrate
  await delay(2000);
  
  console.log(`${LOG_PREFIX} Document ready, looking for input area...`);
  
  while (Date.now() - startTime < MAX_WAIT_TIME) {
    // Debug: Log all contenteditable elements periodically
    const allEditable = document.querySelectorAll('[contenteditable="true"]');
    if (allEditable.length > 0) {
      console.log(`${LOG_PREFIX} Found ${allEditable.length} contenteditable elements`);
      
      // Try to find the main input - usually it's in the lower part of the page
      // and has certain characteristics
      for (const el of allEditable) {
        // Skip tiny elements or hidden ones
        const rect = el.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 20) {
          console.log(`${LOG_PREFIX} Found suitable input:`, el, 'rect:', rect);
          return el;
        }
      }
    }
    
    // Also try specific selectors
    const inputArea = findInputArea();
    if (inputArea) {
      const rect = inputArea.getBoundingClientRect();
      console.log(`${LOG_PREFIX} Found input via selector:`, inputArea, 'rect:', rect);
      return inputArea;
    }
    
    await delay(POLL_INTERVAL);
  }
  
  // Final debug info
  console.log(`${LOG_PREFIX} TIMEOUT - Debug info:`);
  console.log(`${LOG_PREFIX} - URL:`, window.location.href);
  console.log(`${LOG_PREFIX} - contenteditable elements:`, document.querySelectorAll('[contenteditable]'));
  console.log(`${LOG_PREFIX} - body innerHTML length:`, document.body.innerHTML.length);
  
  throw new Error("Gemini took too long to load. Please refresh and try again.");
}

/**
 * Fetch image from URL and return as Blob
 */
async function fetchImage(imageUrl) {
  console.log(`${LOG_PREFIX} Attempting to fetch image:`, imageUrl);
  
  // First, try fetching via background script (has more permissions)
  try {
    console.log(`${LOG_PREFIX} Trying background script fetch...`);
    const result = await fetchImageViaBackground(imageUrl);
    if (result && result.success) {
      console.log(`${LOG_PREFIX} Background fetch successful, converting to blob...`);
      // Convert base64 to blob
      const response = await fetch(result.dataUrl);
      return await response.blob();
    }
    console.log(`${LOG_PREFIX} Background fetch failed:`, result?.error);
  } catch (bgError) {
    console.log(`${LOG_PREFIX} Background fetch error:`, bgError);
  }
  
  // Fallback: try direct fetch from content script
  try {
    console.log(`${LOG_PREFIX} Trying direct CORS fetch...`);
    const response = await fetch(imageUrl, {
      mode: 'cors',
      credentials: 'omit'
    });
    
    if (!response.ok) {
      console.log(`${LOG_PREFIX} Direct fetch failed with status:`, response.status);
      throw new Error(`Failed to fetch image: ${response.status}`);
    }
    
    console.log(`${LOG_PREFIX} Direct fetch successful`);
    return await response.blob();
  } catch (error) {
    console.log(`${LOG_PREFIX} Direct fetch error:`, error.message);
  }
  
  // If all else fails
  throw new Error("Could not download this image. It may be protected. Try saving the image first, then uploading manually to Gemini.");
}

/**
 * Fetch image via background script (has more permissions)
 */
function fetchImageViaBackground(imageUrl) {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { type: "FETCH_IMAGE", imageUrl: imageUrl },
      (response) => {
        if (chrome.runtime.lastError) {
          console.log(`${LOG_PREFIX} Background message error:`, chrome.runtime.lastError);
          resolve({ success: false, error: chrome.runtime.lastError.message });
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Upload image to Gemini's chat interface
 */
async function uploadImageToGemini(imageBlob, originalUrl) {
  // Create a File object from the blob
  const fileName = getFileNameFromUrl(originalUrl) || "image.png";
  const mimeType = imageBlob.type || "image/png";
  const file = new File([imageBlob], fileName, { type: mimeType });
  
  console.log(`${LOG_PREFIX} Uploading image:`, fileName, 'type:', mimeType, 'size:', file.size);
  
  // Method 1: Try clicking the "+" button to open upload menu
  console.log(`${LOG_PREFIX} Looking for add/upload button...`);
  const addButtonSelectors = [
    'button[aria-label*="Add"]',
    'button[aria-label*="add"]', 
    'button[aria-label*="Upload"]',
    'button[aria-label*="upload"]',
    'button[aria-label*="Attach"]',
    '[data-tooltip*="Add"]',
    '[data-tooltip*="Upload"]',
    '.input-area button',
    // The + button in Gemini's input area
    'button:has(svg)',
  ];
  
  let addButton = null;
  for (const selector of addButtonSelectors) {
    try {
      const buttons = document.querySelectorAll(selector);
      console.log(`${LOG_PREFIX} Selector "${selector}" found ${buttons.length} elements`);
      for (const btn of buttons) {
        const rect = btn.getBoundingClientRect();
        // Look for buttons in the lower part of the screen (input area)
        if (rect.bottom > window.innerHeight - 300 && rect.width > 20) {
          console.log(`${LOG_PREFIX} Found potential add button:`, btn, 'aria-label:', btn.getAttribute('aria-label'));
          addButton = btn;
          break;
        }
      }
      if (addButton) break;
    } catch (e) {
      // :has() selector might not be supported
    }
  }
  
  if (addButton) {
    console.log(`${LOG_PREFIX} Clicking add button...`);
    addButton.click();
    await delay(800);
  }
  
  // Method 2: Look for file input (may appear after clicking add button)
  let fileInput = document.querySelector('input[type="file"]');
  console.log(`${LOG_PREFIX} File input found:`, !!fileInput);
  
  if (fileInput) {
    console.log(`${LOG_PREFIX} Using file input method...`);
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
    
    // Trigger multiple events to ensure it's picked up
    fileInput.dispatchEvent(new Event('change', { bubbles: true }));
    fileInput.dispatchEvent(new Event('input', { bubbles: true }));
    
    console.log(`${LOG_PREFIX} File input updated, waiting for processing...`);
    await delay(2000);
    
    // Check if image appeared
    const hasImage = checkForUploadedImage();
    if (hasImage) {
      console.log(`${LOG_PREFIX} Image upload confirmed!`);
      return;
    }
    console.log(`${LOG_PREFIX} Image not detected after file input, trying other methods...`);
  }
  
  // Method 3: Try clipboard paste
  console.log(`${LOG_PREFIX} Trying clipboard paste method...`);
  try {
    await pasteImageFromClipboard(file);
    await delay(2000);
    
    const hasImage = checkForUploadedImage();
    if (hasImage) {
      console.log(`${LOG_PREFIX} Image upload via clipboard confirmed!`);
      return;
    }
  } catch (clipboardError) {
    console.log(`${LOG_PREFIX} Clipboard method failed:`, clipboardError.message);
  }
  
  // Method 4: Try drag and drop
  console.log(`${LOG_PREFIX} Trying drag-drop method...`);
  await simulateDragDropUpload(file);
  await delay(2000);
  
  const hasImage = checkForUploadedImage();
  if (hasImage) {
    console.log(`${LOG_PREFIX} Image upload via drag-drop confirmed!`);
    return;
  }
  
  console.log(`${LOG_PREFIX} WARNING: Could not confirm image upload. Proceeding anyway...`);
}

/**
 * Check if an image has been uploaded to the chat
 */
function checkForUploadedImage() {
  // Look for image thumbnails or preview elements
  const imageIndicators = [
    'img[src*="blob:"]',
    'img[src*="data:"]',
    '[data-image]',
    '.image-preview',
    '.attachment',
    '.uploaded-image'
  ];
  
  for (const selector of imageIndicators) {
    const el = document.querySelector(selector);
    if (el) {
      console.log(`${LOG_PREFIX} Found image indicator:`, selector, el);
      return true;
    }
  }
  return false;
}

/**
 * Try to paste image using clipboard API
 */
async function pasteImageFromClipboard(file) {
  const inputArea = findInputArea();
  if (!inputArea) {
    throw new Error("No input area found");
  }
  
  // Create clipboard data
  const clipboardData = new DataTransfer();
  clipboardData.items.add(file);
  
  // Create and dispatch paste event
  const pasteEvent = new ClipboardEvent('paste', {
    bubbles: true,
    cancelable: true,
    clipboardData: clipboardData
  });
  
  inputArea.focus();
  inputArea.dispatchEvent(pasteEvent);
  
  console.log(`${LOG_PREFIX} Paste event dispatched`);
}

/**
 * Simulate drag and drop upload
 */
async function simulateDragDropUpload(file) {
  // Find the drop target - try multiple areas
  const dropTargets = [
    findInputArea(),
    document.querySelector('.chat-container'),
    document.querySelector('main'),
    document.body
  ].filter(Boolean);
  
  console.log(`${LOG_PREFIX} Drag-drop: found ${dropTargets.length} potential drop targets`);
  
  for (const dropTarget of dropTargets) {
    console.log(`${LOG_PREFIX} Trying drag-drop on:`, dropTarget.tagName, dropTarget.className);
    
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    dataTransfer.dropEffect = 'copy';
    
    // Create and dispatch drag events
    const dragEnterEvent = new DragEvent('dragenter', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    
    const dragOverEvent = new DragEvent('dragover', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    
    const dropEvent = new DragEvent('drop', {
      bubbles: true,
      cancelable: true,
      dataTransfer: dataTransfer
    });
    
    dropTarget.dispatchEvent(dragEnterEvent);
    await delay(100);
    dropTarget.dispatchEvent(dragOverEvent);
    await delay(100);
    dropTarget.dispatchEvent(dropEvent);
    
    await delay(500);
    
    // Check if it worked
    if (checkForUploadedImage()) {
      console.log(`${LOG_PREFIX} Drag-drop successful on:`, dropTarget.tagName);
      return;
    }
  }
  
  console.log(`${LOG_PREFIX} Drag-drop did not result in visible image upload`);
}

/**
 * Type the @SynthID query into the chat
 * With smart dropdown waiting to fix race condition
 */
async function typeSynthIDQuery(inputArea) {
  if (!inputArea) {
    inputArea = findInputArea();
  }
  
  if (!inputArea) {
    throw new Error("Could not find Gemini's chat input.");
  }
  
  console.log(`${LOG_PREFIX} === STARTING @SynthID ENTRY ===`);
  
  // Step 1: Focus the input
  inputArea.focus();
  inputArea.click();
  await delay(300);
  console.log(`${LOG_PREFIX} Step 1: Focused input`);
  
  // Step 2: Type "@"
  await simulateTyping(inputArea, "@");
  console.log(`${LOG_PREFIX} Step 2: Typed @`);
  
  // Step 3: Wait for dropdown to appear (KEY FIX!)
  console.log(`${LOG_PREFIX} Step 3: Waiting for dropdown...`);
  await waitForDropdown();
  
  // Step 4: Type "synthid" to filter dropdown
  await simulateTyping(inputArea, "synthid");
  console.log(`${LOG_PREFIX} Step 4: Typed synthid`);
  
  // Step 5: Wait for dropdown to update with filtered results
  await delay(300);
  await waitForDropdown();
  console.log(`${LOG_PREFIX} Step 5: Dropdown ready`);
  
  // Step 6: Press Tab to select from dropdown
  console.log(`${LOG_PREFIX} Step 6: Pressing Tab...`);
  pressTab(inputArea);
  await delay(300);
  
  // Check if Tab worked
  let hasTag = checkForSynthIdTag(inputArea);
  console.log(`${LOG_PREFIX} Tab selected @SynthID:`, hasTag);
  
  // If Tab didn't work, retry once
  if (!hasTag) {
    console.log(`${LOG_PREFIX} Tab didn't work, retrying...`);
    await delay(300);
    pressTab(inputArea);
    await delay(300);
    hasTag = checkForSynthIdTag(inputArea);
    console.log(`${LOG_PREFIX} Retry result:`, hasTag);
  }
  
  // Step 7: Type the rest of the question
  await simulateTyping(inputArea, " is this image real?");
  console.log(`${LOG_PREFIX} Step 7: Typed question`);
  
  console.log(`${LOG_PREFIX} === FINISHED ===`);
}

/**
 * Wait for the @ dropdown to appear
 */
async function waitForDropdown(maxWait = 3000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < maxWait) {
    // Look for Angular CDK overlay (what Gemini uses)
    const cdkOverlay = document.querySelector('.cdk-overlay-container');
    if (cdkOverlay && cdkOverlay.children.length > 0) {
      // Check if there's actual content in the overlay
      const panes = cdkOverlay.querySelectorAll('.cdk-overlay-pane');
      for (const pane of panes) {
        if (pane.offsetHeight > 0 && pane.textContent.trim().length > 0) {
          console.log(`${LOG_PREFIX} Dropdown detected (CDK overlay with content)`);
          return true;
        }
      }
    }
    
    // Also check for generic dropdown indicators
    const dropdown = document.querySelector(
      '[role="listbox"]:not(:empty), ' +
      '[role="menu"]:not(:empty)'
    );
    if (dropdown) {
      console.log(`${LOG_PREFIX} Dropdown detected (role listbox/menu)`);
      return true;
    }
    
    await delay(100);
  }
  
  console.log(`${LOG_PREFIX} Dropdown wait timed out, proceeding anyway`);
  return false;
}

/**
 * Check if @SynthID tag was properly selected (vs just text)
 */
function checkForSynthIdTag(inputArea) {
  const html = inputArea.innerHTML || '';
  const text = inputArea.textContent || '';
  
  console.log(`${LOG_PREFIX} Check tag - text: "${text}"`);
  
  // If text shows "@SynthID" (capital ID) - tag was selected
  // If text shows "@synthid" (lowercase) - just raw text, Tab didn't work
  if (text.includes('@SynthID')) {
    return true;
  }
  
  // Also check for chip/mention markup
  if (html.includes('chip') || html.includes('mention') || html.includes('data-')) {
    return true;
  }
  
  return false;
}

/**
 * Press Tab key
 */
function pressTab(element) {
  const tabEvent = new KeyboardEvent('keydown', {
    key: 'Tab',
    code: 'Tab',
    keyCode: 9,
    which: 9,
    bubbles: true,
    cancelable: true
  });
  element.dispatchEvent(tabEvent);
}

/**
 * Try to find and click SynthID option in dropdown
 */
async function selectSynthIdFromDropdown() {
  console.log(`${LOG_PREFIX} Searching for SynthID dropdown...`);
  
  // Look for Angular Material CDK overlay (where dropdowns appear)
  const cdkOverlay = document.querySelector('.cdk-overlay-container');
  if (cdkOverlay) {
    console.log(`${LOG_PREFIX} Found CDK overlay container`);
    console.log(`${LOG_PREFIX} CDK overlay content:`, cdkOverlay.innerHTML?.substring(0, 500));
    
    // Look for SynthID in the overlay
    const allElements = cdkOverlay.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim() || '';
      if (text === 'SynthID' || text.startsWith('SynthID')) {
        console.log(`${LOG_PREFIX} Found SynthID in CDK overlay:`, el.tagName, el.className);
        el.click();
        await delay(300);
        return true;
      }
    }
  }
  
  // Look for any overlay/popup that might contain the dropdown
  const overlaySelectors = [
    '.cdk-overlay-pane',
    '[class*="overlay"]',
    '[class*="popup"]', 
    '[class*="menu"]:not([class*="menu-trigger"])',
    '[class*="dropdown"]:not(.dropdown-icon)',
    '[class*="suggest"]',
    '[class*="autocomplete"]',
    '[role="listbox"]',
    '[role="menu"]'
  ];
  
  for (const selector of overlaySelectors) {
    const overlays = document.querySelectorAll(selector);
    for (const overlay of overlays) {
      // Skip our own overlay
      if (overlay.id?.includes('image-check')) continue;
      if (overlay.closest('#image-check-loading-overlay')) continue;
      
      const text = overlay.textContent || '';
      if (text.includes('SynthID') && !text.includes('uploading your image')) {
        console.log(`${LOG_PREFIX} Found overlay with SynthID:`, selector, overlay);
        
        // Find the clickable SynthID item within
        const items = overlay.querySelectorAll('div, span, button, li, a, mat-option, [role="option"]');
        for (const item of items) {
          const itemText = item.textContent?.trim() || '';
          // Skip our overlay text
          if (itemText.includes('uploading') || itemText.includes('Checking')) continue;
          
          if (itemText === 'SynthID' || (itemText.includes('SynthID') && itemText.length < 50)) {
            console.log(`${LOG_PREFIX} Clicking SynthID item:`, item.tagName, itemText);
            item.click();
            item.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
            item.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
            await delay(300);
            return true;
          }
        }
      }
    }
  }
  
  // Last resort: find any element with JUST "SynthID" text (excluding our overlay)
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT);
  let node;
  while (node = walker.nextNode()) {
    // Skip our overlay
    if (node.closest('#image-check-loading-overlay')) continue;
    if (node.closest('#image-check-success-toast')) continue;
    if (node.closest('#image-check-error-toast')) continue;
    
    const directText = Array.from(node.childNodes)
      .filter(n => n.nodeType === Node.TEXT_NODE)
      .map(n => n.textContent?.trim())
      .join('');
    
    if (directText === 'SynthID') {
      const rect = node.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        console.log(`${LOG_PREFIX} Found exact SynthID match:`, node.tagName, rect);
        node.click();
        await delay(300);
        return true;
      }
    }
  }
  
  console.log(`${LOG_PREFIX} Could not find SynthID in dropdown`);
  return false;
}

/**
 * Try to select dropdown item via keyboard
 */
async function tryKeyboardSelection(inputArea) {
  // First, let's see what the current input value is
  console.log(`${LOG_PREFIX} Input area content before keyboard:`, inputArea.textContent);
  
  // Try Tab first (common for autocomplete)
  console.log(`${LOG_PREFIX} Trying Tab key...`);
  simulateKeyPress(inputArea, 'Tab', 9);
  await delay(500);
  console.log(`${LOG_PREFIX} Input after Tab:`, inputArea.textContent);
  
  // Check if it changed
  if (inputArea.textContent?.includes('@SynthID') || inputArea.innerHTML?.includes('SynthID')) {
    console.log(`${LOG_PREFIX} Tab worked!`);
    return;
  }
  
  // Try Enter
  console.log(`${LOG_PREFIX} Trying Enter key...`);
  simulateKeyPress(inputArea, 'Enter', 13);
  await delay(500);
  console.log(`${LOG_PREFIX} Input after Enter:`, inputArea.textContent);
  
  // Try ArrowDown then Enter
  console.log(`${LOG_PREFIX} Trying ArrowDown + Enter...`);
  simulateKeyPress(inputArea, 'ArrowDown', 40);
  await delay(300);
  simulateKeyPress(inputArea, 'Enter', 13);
  await delay(500);
  console.log(`${LOG_PREFIX} Input after ArrowDown+Enter:`, inputArea.textContent);
  
  // Try Space (some dropdowns use space to select)
  console.log(`${LOG_PREFIX} Trying Space key...`);
  simulateKeyPress(inputArea, ' ', 32);
  await delay(300);
}

/**
 * Find the input area using multiple selectors
 */
function findInputArea() {
  const selectors = [
    'rich-textarea [contenteditable="true"]',
    'rich-textarea',
    '.ql-editor[contenteditable="true"]',
    'div[contenteditable="true"][aria-label]',
    '[data-placeholder*="Ask"]',
    '.input-area [contenteditable="true"]',
    'div[contenteditable="true"]'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
  }
  return null;
}

/**
 * Simulate a key press event
 */
function simulateKeyPress(element, key, keyCode) {
  const events = ['keydown', 'keypress', 'keyup'];
  
  events.forEach(eventType => {
    const event = new KeyboardEvent(eventType, {
      key: key,
      code: key,
      keyCode: keyCode,
      which: keyCode,
      bubbles: true,
      cancelable: true,
      composed: true
    });
    element.dispatchEvent(event);
  });
}

/**
 * Simulate typing text character by character
 */
async function simulateTyping(element, text) {
  element.focus();
  
  for (const char of text) {
    // Use execCommand for contenteditable elements
    document.execCommand('insertText', false, char);
    
    // Also dispatch input event
    element.dispatchEvent(new InputEvent('input', {
      bubbles: true,
      cancelable: true,
      inputType: 'insertText',
      data: char
    }));
    
    // Small delay between characters for natural typing
    await delay(50);
  }
}

/**
 * Extract filename from URL
 */
function getFileNameFromUrl(url) {
  try {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const parts = pathname.split('/');
    const lastPart = parts[parts.length - 1];
    
    if (lastPart && lastPart.includes('.')) {
      return lastPart;
    }
    return "image.png";
  } catch {
    return "image.png";
  }
}

/**
 * Utility: delay/sleep function
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * ============================================
 * WARM DARK UI
 * 
 * Color Palette:
 * - Background: #1a1a1a (soft black)
 * - Text: #f5f5f5 (warm white)
 * - Accent: #f59e0b (amber)
 * - Muted: #888, #666
 * ============================================
 */

// Inject global styles once
function injectStyles() {
  if (document.getElementById('synthid-checker-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'synthid-checker-styles';
  styles.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap');
    
    @keyframes synthid-fadeIn {
      from { opacity: 0; transform: translate(-50%, 20px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }
    @keyframes synthid-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    @keyframes synthid-spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .synthid-overlay {
      position: fixed;
      bottom: 40px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 999999;
      font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
      animation: synthid-fadeIn 0.3s ease-out forwards;
    }
    
    .synthid-toast {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 20px;
      box-shadow: 0 16px 56px rgba(0,0,0,0.5);
      padding: 28px 36px;
      display: flex;
      align-items: center;
      gap: 24px;
      min-width: 420px;
    }
    
    .synthid-icon {
      width: 64px;
      height: 64px;
      background: #f59e0b;
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 36px;
      font-weight: 800;
      color: #1a1a1a;
      flex-shrink: 0;
    }
    
    .synthid-icon.working {
      animation: synthid-pulse 1.5s ease-in-out infinite;
    }
    
    .synthid-content {
      flex: 1;
    }
    
    .synthid-title {
      font-size: 22px;
      font-weight: 600;
      color: #f5f5f5;
      margin-bottom: 4px;
    }
    
    .synthid-subtitle {
      font-size: 16px;
      color: #888;
      line-height: 1.4;
    }
    
    /* Light mode */
    @media (prefers-color-scheme: light) {
      .synthid-toast {
        background: #ffffff;
        border: 1px solid #e5e5e5;
        box-shadow: 0 16px 56px rgba(0,0,0,0.12);
      }
      
      .synthid-icon {
        background: #d97706;
      }
      
      .synthid-title {
        color: #1a1a1a;
      }
      
      .synthid-subtitle {
        color: #666;
      }
    }
  `;
  document.head.appendChild(styles);
}

/**
 * Show typing overlay - preparing the question
 */
function showTypingOverlay() {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-working';
  overlay.className = 'synthid-overlay';
  overlay.innerHTML = `
    <div class="synthid-toast">
      <div class="synthid-icon working">?</div>
      <div class="synthid-content">
        <div class="synthid-title">Getting ready...</div>
        <div class="synthid-subtitle">Preparing to check your image</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Show uploading overlay - uploading the image
 */
function showUploadingOverlay() {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-working';
  overlay.className = 'synthid-overlay';
  overlay.innerHTML = `
    <div class="synthid-toast">
      <div class="synthid-icon working">?</div>
      <div class="synthid-content">
        <div class="synthid-title">Uploading your image...</div>
        <div class="synthid-subtitle">This might take a few seconds</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

/**
 * Show sending overlay - sending to Gemini
 */
function showSendingOverlay() {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-working';
  overlay.className = 'synthid-overlay';
  overlay.innerHTML = `
    <div class="synthid-toast">
      <div class="synthid-icon working">?</div>
      <div class="synthid-content">
        <div class="synthid-title">Starting the check...</div>
        <div class="synthid-subtitle">Sending to Google AI</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
}

function hideTypingOverlay() { }
function hideUploadingOverlay() { }
function hideSendingOverlay() { removeAllOverlays(); }

/**
 * Show completion message - Gemini is now processing
 */
function showCompletionAnimation() {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-complete';
  overlay.className = 'synthid-overlay';
  overlay.innerHTML = `
    <div class="synthid-toast">
      <div class="synthid-icon">✓</div>
      <div class="synthid-content">
        <div class="synthid-title">Sent!</div>
        <div class="synthid-subtitle">Gemini is analyzing — watch above for results</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Remove after 8 seconds
  setTimeout(() => overlay.remove(), 8000);
}

/**
 * Show manual send prompt - if auto-send fails
 */
function showManualSendPrompt() {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-manual';
  overlay.className = 'synthid-overlay';
  overlay.innerHTML = `
    <div class="synthid-toast">
      <div class="synthid-icon">!</div>
      <div class="synthid-content">
        <div class="synthid-title">Almost there!</div>
        <div class="synthid-subtitle">Click the Send button to start the check</div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  // Remove after 20 seconds
  setTimeout(() => overlay.remove(), 20000);
}

/**
 * Remove all overlays
 */
function removeAllOverlays() {
  ['synthid-working', 'synthid-complete', 'synthid-manual', 'synthid-error-overlay',
   'synthid-typing-toast', 'synthid-uploading-toast', 'synthid-sending-toast', 
   'synthid-complete-toast', 'image-check-loading-overlay', 'image-check-success-toast',
   'image-check-test-toast'].forEach(id => {
    document.getElementById(id)?.remove();
  });
}

/**
 * Click the send button
 */
async function clickSendButton() {
  console.log(`${LOG_PREFIX} Looking for send button...`);
  
  // Method 1: Look for button with mat-icon or arrow icon in bottom area
  const allButtons = document.querySelectorAll('button');
  console.log(`${LOG_PREFIX} Found ${allButtons.length} buttons total`);
  
  for (const btn of allButtons) {
    const rect = btn.getBoundingClientRect();
    
    // Send button is at bottom of page, right side
    if (rect.bottom > window.innerHeight - 200 && rect.right > window.innerWidth / 2) {
      // Check if it's a circular/icon button (send buttons are usually small and round)
      const isIconButton = rect.width < 100 && rect.height < 100 && rect.width > 20;
      const hasArrow = btn.innerHTML.includes('arrow') || btn.innerHTML.includes('send') || 
                       btn.innerHTML.includes('M2') || btn.innerHTML.includes('path');
      const ariaLabel = btn.getAttribute('aria-label') || '';
      
      console.log(`${LOG_PREFIX} Button candidate:`, {
        rect: `${rect.width}x${rect.height} at ${rect.right},${rect.bottom}`,
        ariaLabel,
        isIconButton,
        hasArrow
      });
      
      if (isIconButton && (hasArrow || ariaLabel.toLowerCase().includes('send'))) {
        console.log(`${LOG_PREFIX} Clicking send button!`);
        btn.click();
        await delay(100);
        btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        return true;
      }
    }
  }
  
  // Method 2: Find by aria-label
  const sendByLabel = document.querySelector('[aria-label*="Send" i], [aria-label*="submit" i]');
  if (sendByLabel) {
    console.log(`${LOG_PREFIX} Found send by aria-label:`, sendByLabel);
    sendByLabel.click();
    return true;
  }
  
  // Method 3: Find the rightmost button in the input area
  const inputArea = findInputArea();
  if (inputArea) {
    const inputRect = inputArea.getBoundingClientRect();
    let bestButton = null;
    let bestRight = 0;
    
    for (const btn of allButtons) {
      const rect = btn.getBoundingClientRect();
      // Button should be near the input area vertically
      if (Math.abs(rect.top - inputRect.top) < 100 && rect.right > bestRight) {
        bestButton = btn;
        bestRight = rect.right;
      }
    }
    
    if (bestButton) {
      console.log(`${LOG_PREFIX} Clicking rightmost button near input:`, bestButton);
      bestButton.click();
      return true;
    }
  }
  
  console.log(`${LOG_PREFIX} Could not find send button - user will need to click manually`);
  return false;
}

// Keep old functions for compatibility
function showLoadingOverlay() {
  showTypingOverlay();
}

function hideLoadingOverlay() {
  removeAllOverlays();
}

/**
 * Show success message (legacy - now using showCompletionAnimation)
 */
function showSuccessMessage() {
  showCompletionAnimation();
}

/**
 * Show manual send prompt - fallback if auto-send fails
 */
function showManualSendPrompt() {
  injectStyles();
  removeAllOverlays();
  
  const notification = document.createElement('div');
  notification.id = 'synthid-manual-send';
  notification.className = 'synthid-notification';
  notification.innerHTML = `
    <div class="synthid-card" style="background: #e8f0fe; border: 2px solid #1a73e8;">
      <div class="synthid-icon">👆</div>
      <div class="synthid-text">
        <div class="synthid-title" style="color: #1a73e8;">Almost done!</div>
        <div class="synthid-subtitle">Click the <strong>Send button</strong> (➤) to check your image</div>
      </div>
    </div>
  `;
  document.body.appendChild(notification);
  
  // Remove after 10 seconds
  setTimeout(() => notification.remove(), 10000);
}

/**
 * Show error message - warm dark theme
 */
function showErrorMessage(message) {
  injectStyles();
  removeAllOverlays();
  
  const overlay = document.createElement('div');
  overlay.id = 'synthid-error-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
    font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
  `;
  
  const modal = document.createElement('div');
  modal.style.cssText = `
    background: #1a1a1a;
    border: 1px solid #2a2a2a;
    padding: 40px 44px;
    border-radius: 20px;
    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
    max-width: 380px;
    text-align: center;
  `;
  
  modal.innerHTML = `
    <div style="font-size: 48px; margin-bottom: 20px;">😕</div>
    <h2 style="margin: 0 0 12px; color: #f5f5f5; font-size: 22px; font-weight: 600;">
      That didn't work
    </h2>
    <p style="margin: 0 0 28px; color: #888; font-size: 15px; line-height: 1.6;">
      ${message}
    </p>
    <button id="synthid-error-close" style="
      background: #f59e0b;
      color: #1a1a1a;
      border: none;
      padding: 14px 36px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    ">
      OK, got it
    </button>
  `;
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Add click handlers
  document.getElementById('synthid-error-close').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

