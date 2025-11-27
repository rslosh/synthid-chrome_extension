# 🔍 Is This Image Real?

[![Chrome Web Store](https://img.shields.io/badge/Chrome-Web%20Store-blue?logo=googlechrome)](https://chrome.google.com/webstore)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-green.svg)](https://developer.chrome.com/docs/extensions/mv3/)

A simple Chrome extension that helps you check if an image is AI-generated using Google's SynthID technology.

**Perfect for anyone who wants to verify the authenticity of images they see online.**

![Extension Demo](https://via.placeholder.com/800x400?text=Demo+Screenshot)

## ✨ Features

- 🖱️ **Right-click any image** on the web to check if it's real
- 🤖 **Automatic** — Opens Google Gemini and uploads the image for you
- 🔐 **Privacy-first** — No data collection, all processing through your Google account
- 🎨 **Beautiful UI** — Modern design with dark/light mode support

## 📥 Installation

### From Chrome Web Store (Recommended)
1. Visit the [Chrome Web Store listing](#) _(link coming soon)_
2. Click "Add to Chrome"
3. Done!

### From Source (Developer Mode)
1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable **"Developer mode"** (toggle in top-right corner)
4. Click **"Load unpacked"**
5. Select this folder
6. The extension should now appear in your extensions list!

## 🚀 How to Use

1. **Find an image** on any website you want to verify
2. **Right-click** on the image
3. Select **"IS THIS IMAGE REAL?"** from the menu
4. **Google Gemini** will open and automatically analyze the image
5. View the results!

## 🔒 Privacy

This extension:
- ✅ Does NOT collect any personal data
- ✅ Does NOT track your browsing
- ✅ Only sends images to Google Gemini when YOU choose to check them
- ✅ All processing happens through your Google account
- ✅ 100% open source — review the code yourself!

Read our full [Privacy Policy](PRIVACY.md).

## ⚙️ Permissions Explained

| Permission | Why It's Needed |
|------------|-----------------|
| `contextMenus` | Add right-click menu option |
| `activeTab` | Access the image you clicked |
| `storage` | Temporarily pass data between tabs |
| `scripting` | Interact with Gemini's interface |
| Host permissions | Download images & upload to Gemini |

## 🛠️ Technical Details

- **Manifest Version:** 3 (latest)
- **Frameworks:** Vanilla JavaScript (no dependencies)
- **Size:** < 50KB
- **Compatibility:** Chrome 88+

## ⚠️ Limitations

- **SynthID detection only**: This tool detects SynthID watermarks embedded in images created by Google AI (like Imagen). It won't detect images from other AI generators (Midjourney, DALL-E, etc.)
- **Requires Google account**: You need to be signed into Google to use Gemini
- **Protected images**: Some images can't be downloaded due to CORS restrictions

## 🐛 Troubleshooting

### "Could not download this image"
Some images are protected. Try saving the image to your computer first, then upload manually to Gemini.

### Gemini doesn't load properly
Make sure you're signed into Google and Gemini is available in your region.

### SynthID option doesn't appear
You may need to enable SynthID in Gemini's settings.

## 🤝 Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Google SynthID](https://deepmind.google/technologies/synthid/) for the watermarking technology
- [Google Gemini](https://gemini.google.com) for AI analysis

---

Made with ❤️ to help people identify AI-generated images
