# Important limits

- An app cannot set the Android system clock. The "disciplined" time is the system clock plus the estimated offset.
- Android cannot bind UDP port 123 without root, so the NTP server uses a high port (default 12123). Clients must target the phone's IP and that port, or you forward port 123 on your router.
- The BLE peripheral advertises under the phone's own Bluetooth name.
- The service cannot auto-start at boot (Android blocks location and Bluetooth foreground services there). Open the app once after a reboot.
- Some vendors (Xiaomi, Samsung, Huawei) may kill background apps despite the foreground service; exempt the app from battery optimisation if so.
- Phone hotspot (tethering) is not visible to apps as a network, so the NTP server does not count it as "online".
- The German, French, Spanish and Chinese texts are drafts and should be reviewed by native speakers.
