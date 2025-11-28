# Privacy Policy for "Is This Image Real?"

**Last updated:** November 2025

## Overview

"Is This Image Real?" is a Chrome extension that helps users check if an image was created by AI using Google's SynthID technology. 

## Data Collection

**We do NOT collect, store, or transmit any personal data.**

This extension:
- ❌ Does NOT collect personal information
- ❌ Does NOT track your browsing history
- ❌ Does NOT use analytics or tracking scripts
- ❌ Does NOT store any data on external servers
- ❌ Does NOT share any data with third parties

## How the Extension Works

1. When you right-click an image and select "Is This Image Real?", the extension:
   - Downloads the image temporarily in your browser's memory
   - Opens Google Gemini (gemini.google.com) in a new tab
   - Uploads the image to Gemini for analysis
   - Clears the temporary data immediately after

2. The image is sent **directly to Google Gemini** through your own Google account. We have no access to:
   - The images you check
   - The results from Gemini
   - Your Google account information

## Permissions Explained

The extension requires certain permissions to function:

| Permission | Why It's Needed |
|------------|-----------------|
| `contextMenus` | To add "Is This Image Real?" to the right-click menu |
| `activeTab` | To access the image you right-clicked on |
| `storage` | To temporarily pass image data between browser tabs (cleared immediately) |
| `scripting` | To interact with Google Gemini's interface |
| `host_permissions` (gemini.google.com) | To upload images and enter queries on Gemini |
| `host_permissions` (all_urls) | To download images from any website you visit |

## Third-Party Services

This extension uses **Google Gemini** to analyze images. When you use this extension:
- You are subject to [Google's Privacy Policy](https://policies.google.com/privacy)
- You are subject to [Google's Terms of Service](https://policies.google.com/terms)

## Local Storage

The extension uses Chrome's local storage **only** to temporarily hold image data while switching tabs. This data:
- Is stored locally on your device only
- Is automatically cleared after use
- Is never transmitted to any external server

## Open Source

This extension is open source. You can review the complete source code at:
https://github.com/rslosh/synthid-chrome_extension

## Changes to This Policy

If we make changes to this privacy policy, we will update the "Last updated" date at the top.

## Contact

If you have questions about this privacy policy, please open an issue on our GitHub repository.

---

**Summary:** This extension does ONE thing — it helps you check images using Google Gemini. We don't collect any data. Everything stays on your device and goes directly to Google through your own account.

