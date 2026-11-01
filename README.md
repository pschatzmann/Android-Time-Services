# NTP & CTS Time Services

An Android app that gathers time from NTP servers, the phone's GNSS receiver and Bluetooth LE peers, combines it into one clock estimate, and serves that time to other devices over NTP and Bluetooth LE (Current Time Service).

> **Status:** working prototype, tested on one phone (Samsung Galaxy A34, Android 16). See [Important limits](docs/limits.md) and the [Roadmap](docs/roadmap.md).

## Highlights

- **Sources:** a configurable list of NTP servers, phone GNSS (with an optional raw GNSS clock), and BLE Current Time Service peers.
- **Fusion:** weighted mean, median or PLL/FLL smoothing with outlier rejection and holdover.
- **Publishing:** an NTP server (UDP) and a BLE Current Time Service peripheral; you choose which source is published.
- **Background operation:** runs as a foreground service, follows Wi-Fi and Bluetooth state, and raises notifications when something goes wrong.
- **Languages:** English, German, French, Spanish, Simplified and Traditional Chinese.

## Install

Download the APK from the [Releases](https://github.com/pschatzmann/Android-Time-Services/releases) page (Android 8.0 or newer). Installing outside Google Play requires allowing "Install unknown apps" for your browser or file manager, and Play Protect may ask for confirmation.

To build it yourself: `cd android && ./gradlew installDebug` (see [Build and install](docs/build.md)).

## Documentation

- [Features](docs/features.md)
- [Time scales on the Clock screen](docs/time-scales.md) (UTC, TAI, GPS)
- [Important limits](docs/limits.md)
- [Build and install](docs/build.md) and [tool setup](android/SETUP.md)
- [Translations](docs/translations.md)
- [Permissions](docs/permissions.md)
- [Project layout](docs/project-layout.md)
- [Releasing on GitHub](docs/releasing.md)
- [Before publishing on Google Play](docs/google-play.md)
- [Roadmap](docs/roadmap.md)

## License

[MIT](LICENSE)
