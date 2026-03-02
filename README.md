# VOIP-Caster

A BetterDiscord plugin that uses your systems text-to-speech to announce voice channel activity out loud. Someone joins, leaves, mutes, or starts sharing their screen, you'll hear it, no matter what you're doing.

Built because constantly glancing at Discord to see who's in VC or who is muted gets old fast.

---

![Downloads](https://img.shields.io/github/downloads/ldeology/VOIP-Caster/total?style=flat-square&label=downloads&color=4c9be8)
![Release](https://img.shields.io/github/v/release/ldeology/VOIP-Caster?style=flat-square&label=latest&color=4c9be8)

---

## What it does

- Announces joins, leaves, mutes, unmutes, deafens, and screen shares
- Detects server mutes and deafens (admin actions) separately
- Optional announcement for when you yourself join or leave

---

## Installation

1. Install [BetterDiscord](https://betterdiscord.app) if you haven't already
2. Download [VOIPcaster.plugin.js](https://github.com/ldeology/VOIP-Caster/blob/main/VOIPcaster.plugin.js)
3. Drop it into your BetterDiscord plugins folder:
   - **Windows** - `%appdata%\BetterDiscord\plugins`
   - **Mac** - `~/Library/Application Support/BetterDiscord/plugins`
   - **Linux** - `~/.config/BetterDiscord/plugins`
4. Enable it under **Settings → Plugins**

---

## Configuration


Click **Open Configuration** in the plugin settings. From there you can:

- Toggle which events get announced
- Set a custom phrase for each event - use `{name}` where the username should go
- Pick a voice, adjust volume, speed, and pitch
- Set a cooldown so it doesn't spam you

Preview buttons let you hear each phrase before saving.

![VOIP-Caster configuration panel](https://github.com/user-attachments/assets/c45e2247-bc51-4b60-b42e-e57b80e2cf5b)
png)

---

## Updates

VOIP-Caster uses BetterDiscord's built-in update system. When a new version is pushed you'll get a notification automatically.

---

## Known Issues

- None reported yet

---

## License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

