# Stand setup

What to set up on the stand so Tapcue runs all day without anyone touching it. The player and the
server do their part; these steps are the part only the devices can do
([ADR 0015](adr/0015-screen-wake.md)). Allow about 15 minutes, plus 5 per tablet.

## 1. Network

- **Use a dedicated access point** for the stand: a small router of your own, not the venue's
  Wi-Fi. Venue networks often block devices from reaching each other (client isolation), and
  their load makes taps slower. No internet connection is needed.
- **Put everything on it:** the Tapcue computer, the tablets and the media servers. Connect the
  computer and the media servers by cable if you can; tablets on 5 GHz Wi-Fi.
- **Give the Tapcue computer a fixed address** (a DHCP reservation in the router, or a static
  IP). The station URLs and QR codes contain this address; if it changes, every tablet must be
  set up again.

## 2. The Tapcue computer

- **Start Tapcue** with `npm start` (see the [README](../README.md#development)). It prints the
  editor URL and one URL per station.
- **Allow incoming connections** when the system asks on the first start (macOS: "Allow";
  Windows Defender Firewall: allow on private networks). Without this, tablets cannot connect.
- **Keep it awake and powered:** on the power adapter, with sleep turned off (macOS: System
  Settings → Battery or Energy → prevent automatic sleeping; Windows: Settings → System → Power
  → Sleep → Never). The display may turn off; the computer must not sleep.
- **Check the media servers** from the editor: select a hotspot with a command and press
  "Send test". The command log shows whether it was sent.

## 3. Each tablet (iPad)

1. **Open the station:** in the editor's Stations tab, scan the station's QR code with the
   iPad's camera and open the link in Safari.
2. **Add it to the Home Screen:** Share → Add to Home Screen. Open Tapcue from that icon from
   now on: it runs full screen, without Safari's address bar.
3. **Keep the screen on:** Settings → Display & Brightness → Auto-Lock → **Never**. A page
   served over `http://` cannot keep an iPad awake by itself. On iPads with Face ID, also turn
   off Settings → Face ID & Passcode → Attention Aware Features, so the screen does not dim.
4. **Lock the tablet to Tapcue with Guided Access:** Settings → Accessibility → Guided Access →
   on, set a passcode, and set Display Auto-Lock to **Never**. Then open Tapcue from the Home
   Screen and triple-click the top (or Home) button → Start. Visitors cannot leave the player;
   triple-click and the passcode end it.
5. **Keep it charging,** with Low Power Mode off: Low Power Mode can turn the screen off
   regardless of Auto-Lock.

Android tablets and desktop browsers keep the screen on by themselves where the browser allows
it; use the device's own kiosk or screen-pinning mode to keep visitors in the player.

## 4. Before visitors arrive

- Tap through every station once: pages change, the media servers react, and each tap shows in
  the editor's command log.
- Leave a tablet untouched for its idle time: it returns to its start page.
- Turn a tablet's Wi-Fi off and on: it shows "Reconnecting…" and recovers without a reload.

## Security

Tapcue has no password in this version ([ADR 0010](adr/0010-no-auth-in-mvp.md)): anyone on the
stand's network can open the editor and change the project. Keep the network to the stand's own
devices, never expose the Tapcue computer to the internet, and keep visitors in the player with
Guided Access.
