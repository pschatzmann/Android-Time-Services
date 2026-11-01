# Android Time Services

An Android app (Kotlin, Jetpack Compose) that gathers time from several sources, combines them into one clock estimate, and serves that time to other devices over NTP and Bluetooth LE.

> **Status:** the code is written but has not been compiled or run on a device yet. Expect some compile fixes on the first build.

## Features

- **Time sources**
  - NTP servers, queried over UDP (RFC 5905), with a built-in packet analyser.
  - Phone GNSS (Location API). Needs a sky view; accuracy is tens of milliseconds, not PPS-grade.
  - A Bluetooth LE peer that offers the Current Time Service (0x1805).
- **Clock disciplining:** weighted mean, median or PLL/FLL smoothing, with outlier rejection, slew limit and holdover.
- **Publishing**
  - NTP server on UDP (default port 12123).
  - BLE Current Time Service peripheral (0x2A2B, 0x2A0F, 0x2A14, notifications at a configurable interval).
  - Choose what is published: the fused clock, the phone system clock, or any single source.
- **Runs in the background:** a foreground service keeps the servers alive after the app is closed, with an optional wake and Wi-Fi lock for screen-off operation.
- **Screens:** Clock (local, UTC, TAI, GPS time and time zones), Sources, Publish, Metrics, Settings.

## Important limits

- An app cannot set the Android system clock. The "disciplined" time is the system clock plus the estimated offset.
- Android cannot bind UDP port 123 without root, so the NTP server uses a high port (default 12123). Clients must target the phone's IP and that port.
- The BLE peripheral advertises under the phone's own Bluetooth name.
- The service cannot auto-start at boot (Android blocks location and Bluetooth foreground services there). Open the app once after a reboot.
- Some vendors (Xiaomi, Samsung, Huawei) may kill background apps despite the foreground service; exempt the app from battery optimisation if so.

## Build and install

See [android/SETUP.md](android/SETUP.md) for the tool downloads. Then:

```bash
cd android
./gradlew installDebug      # phone connected over USB with USB debugging on
```

Requirements: JDK 17 or newer, Android SDK platform 35, Gradle 8.10.2 (via the wrapper). The app supports Android 8.0 (API 26) and newer.

## Permissions

| Permission | Used for |
|---|---|
| Internet | NTP queries and serving |
| Fine location | GNSS source; required for BLE scanning on Android 11 and older |
| Bluetooth scan / advertise / connect | BLE CTS client and server (Android 12+) |
| Notifications, foreground service | The background service and its notification |
| Wake lock | Optional "keep running with screen off" |

## Project layout

```
android/app/src/main/java/com/pschatzmann/chronos/
  ChronosEngine.kt     source polling, fusion, server control (process-wide)
  ChronosService.kt    foreground service and notification
  GnssSource.kt        phone GNSS time source
  net/                 NtpClient, NtpServer
  ble/                 CTS codec, BLE server, BLE client
  ui/                  Compose screens and theme
```

## Roadmap

- Translations: English, German, French, Spanish, plus an in-app language picker.
- Optional sub-millisecond GPS time from raw GNSS clock measurements.
