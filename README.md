# NTP & CTS Time Services

An Android app (Kotlin, Jetpack Compose) that gathers time from several sources, combines them into one clock estimate, and serves that time to other devices over NTP and Bluetooth LE.

> **Status:** builds and runs. It has been installed and exercised on one device (Samsung Galaxy A34, Android 16): the screens, NTP polling, GNSS, offline handling and alerts, and several of the languages. Not yet tested: serving real NTP clients from other machines, the BLE server/client against a real peer, and the optional raw GNSS clock. Treat it as a working prototype.

## Features

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

## Important limits

- An app cannot set the Android system clock. The "disciplined" time is the system clock plus the estimated offset.
- Android cannot bind UDP port 123 without root, so the NTP server uses a high port (default 12123). Clients must target the phone's IP and that port, or you forward port 123 on your router.
- The BLE peripheral advertises under the phone's own Bluetooth name.
- The service cannot auto-start at boot (Android blocks location and Bluetooth foreground services there). Open the app once after a reboot.
- Some vendors (Xiaomi, Samsung, Huawei) may kill background apps despite the foreground service; exempt the app from battery optimisation if so.
- Phone hotspot (tethering) is not visible to apps as a network, so the NTP server does not count it as "online".
- The German, French, Spanish and Chinese texts are drafts and should be reviewed by native speakers.

## Build and install

See [android/SETUP.md](android/SETUP.md) for the tool downloads. Then:

```bash
cd android
./gradlew installDebug      # phone connected over USB with USB debugging on
```

Requirements: JDK 17 or newer, Android SDK platform 35, Gradle 8.10.2 (via the wrapper), Android Gradle Plugin 8.7.3, Kotlin 2.0.21, Compose BOM 2024.12.01. The app supports Android 8.0 (API 26) and newer.

Debugging: the log tag is `TimeServices` (`adb logcat -s TimeServices`); source status changes are logged there. Recovered crashes are in the app's `files/crash.log`.

## Translations

All texts live in one table, [android/tools/gen_strings.py](android/tools/gen_strings.py) (English, German, French, Spanish), plus [zh_strings.py](android/tools/zh_strings.py) (Simplified Chinese) and [zht_strings.py](android/tools/zht_strings.py) (Traditional Chinese). The script checks that every string exists in every language and that placeholders such as `%1$d` match, then writes `res/values*/strings.xml`. Do not edit those XML files by hand:

```bash
python3 android/tools/gen_strings.py android/app/src/main/res
```

To add a language: add its column or dictionary in the script, a `<locale>` in `res/xml/locales_config.xml`, the code in `resourceConfigurations` in `app/build.gradle.kts` (script variants use the form `b+zh+Hant`), and a button in the Settings language card.

## Permissions

| Permission | Used for |
|---|---|
| Internet, network state | NTP queries and serving; detecting when no network is up |
| Fine location | GNSS source; required for BLE scanning on Android 11 and older |
| Bluetooth scan / advertise / connect | BLE CTS client and server (Android 12+) |
| Notifications | The service notification and error alerts |
| Foreground service (special use, connected device, location) | Keeping the servers running in the background |
| Wake lock | Optional "keep running with screen off" |

## Project layout

```
android/
  tools/                 translation table and generator
  app/src/main/java/com/pschatzmann/timeservices/
    TimeEngine.kt        source polling, fusion, server control (process-wide)
    TimeService.kt       foreground service and its notification
    TimeServicesApp.kt   application; installs the safety net
    Safety.kt            survives uncaught exceptions, writes crash.log
    AlertNotifier.kt     error notifications
    NetworkMonitor.kt    Wi-Fi / mobile / Ethernet availability
    GnssSource.kt        phone GNSS time source (Location API)
    GnssRawClock.kt      optional raw GNSS clock source
    ConfigStore.kt       settings persistence
    UiText.kt            translatable messages from non-UI code
    TimeZoneEngine.kt    time zone details and names
    net/                 NtpClient, NtpServer
    ble/                 CTS codec, BLE server, BLE client
    ui/                  Compose screens, charts and theme
```

## Before publishing on Google Play

- Use a name without "Android" (Google's trademark rules); the current name is "NTP & CTS Time Services". Search Play and a trademark database (for example EUIPO or USPTO) for existing products with a similar name first.
- The package ID `com.pschatzmann.timeservices` is permanent once published.
- Play needs a signed release bundle (`.aab`), a privacy policy URL, written justifications for the location, Bluetooth and `specialUse` foreground-service permissions, and a target API level that meets the current requirement.
- Do not describe the app as setting the phone's clock.

## Roadmap

Roughly in order of priority.

1. **Verify on real hardware** (nothing below has been tested yet):
   - the optional raw GNSS clock, outdoors, against a trusted reference on your own network (internet NTP is too jittery to prove sub-millisecond accuracy), on a phone that provides raw measurements;
   - the NTP server answering real clients (chrony, `ntpdate`) from another machine;
   - the BLE server and client against a real Current Time Service peer.
2. **Native review of all translations** (German, French, Spanish, Simplified and Traditional Chinese).
3. **Automated tests:** none exist yet. Unit tests for the NTP packet code, the BLE time codec and the fusion logic, plus UI tests for Settings.
4. **Sub-millisecond serving:** nanosecond timestamps in the NTP server (it stamps whole milliseconds today). Scheduling jitter in Java code will still limit the result to roughly a millisecond.
5. **Optional root support** for binding UDP port 123, and documentation for forwarding port 123 on a router.
6. **Release readiness:** signed `.aab`, privacy policy, Play Console declarations for location, Bluetooth and the foreground-service type, store listing, and a check of the current target-API requirement.
7. **Smaller ideas:** treating phone hotspot (tethering) as an online network, and an in-app view of `crash.log`.
