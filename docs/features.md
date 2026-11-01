# Features

- **Time sources**
  - **NTP servers**, queried over UDP (RFC 5905). The list is yours to manage in *Settings → NTP time servers*: add, edit, enable/disable or remove servers, with quick-add buttons for common public servers. A built-in packet analyser is on the *Sources* tab.
  - **Phone GNSS** (Location API). Needs a sky view; accuracy is tens of milliseconds, not PPS-grade. Devices without a GNSS receiver are detected and the source is disabled.
  - **Optional raw GNSS clock** (*Settings → Satellite time*): on phones that report the receiver's raw clock, the offset is computed from it instead, which can be far more precise. It switches itself off on phones that do not provide the data and the app falls back to the normal GNSS time. Not yet verified on a device.
  - **Bluetooth LE peer** offering the Current Time Service (0x1805).
- **Clock disciplining:** weighted mean, median or PLL/FLL smoothing, with outlier rejection, slew limit and holdover.
- **Publishing**
  - **NTP server** on UDP (default port 12123).
  - **BLE Current Time Service** peripheral (0x2A2B, 0x2A0F, 0x2A14) with notifications at a configurable interval (0.1 s to 24 h).
  - Choose what is published: the fused clock, the phone system clock, or any single source. If the chosen source has no recent sample, the servers advertise stratum 16 (unsynchronised).
- **Follows the radios:** the NTP server runs only while a Wi-Fi, mobile or Ethernet network is up; the BLE server only while Bluetooth is on. Sources go to standby within about a second of losing their radio.
- **Runs in the background:** a foreground service keeps the servers alive after the app is closed, with an optional wake and Wi-Fi lock for screen-off operation.
- **Error notifications:** problems (server cannot start, Bluetooth fault, a source failing for a minute, serving unsynchronised time, service cannot start) raise a system notification and clear themselves when fixed.
- **Stability:** uncaught exceptions are logged to `files/crash.log`, reported by notification and survived instead of closing the app. If errors repeat (5 in 30 s) or memory runs out, normal crash behaviour returns.
- **Screens:** *Clock* (local, UTC, TAI and GPS time, time zones, sync quality), *Sources*, *Publish*, *Metrics* (charts with a value scale and a short explanation each), *Settings* (every section explained; Save and Reset are greyed out when there is nothing to save or reset, and Reset asks for confirmation).
- **Languages:** English, German, French, Spanish, Simplified Chinese and Traditional Chinese (Taiwan wording). The app follows the phone's language and falls back to English; a picker in Settings (and Android's per-app language settings) overrides it.
