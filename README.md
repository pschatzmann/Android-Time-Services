# NTP & CTS Time Services

An Android app that gathers time from NTP servers, the phone's GNSS receiver and Bluetooth LE peers, combines it into one clock estimate, and serves that time to other devices over NTP and Bluetooth LE (Current Time Service).

> **Status:** working prototype, tested on one phone (Samsung Galaxy A34, Android 16). See [Important limits](https://github.com/pschatzmann/Android-Time-Services/wiki/Important-Limits) and the [Roadmap](https://github.com/pschatzmann/Android-Time-Services/wiki/Roadmap).

## Highlights

- **Sources:** a configurable list of NTP servers, phone GNSS (with an optional raw GNSS clock), and BLE Current Time Service peers.
- **Fusion:** weighted mean, median or PLL/FLL smoothing with outlier rejection and holdover.
- **Publishing:** an NTP server (UDP) and a BLE Current Time Service peripheral; you choose which source is published.
- **Background operation:** runs as a foreground service, follows Wi-Fi and Bluetooth state, and raises notifications when something goes wrong.
- **Languages:** English, German, French, Spanish, Simplified and Traditional Chinese.

## Documentation

The documentation is in the [project wiki](https://github.com/pschatzmann/Android-Time-Services/wiki/Home):

- [Features](https://github.com/pschatzmann/Android-Time-Services/wiki/Features)
- [Time scales on the Clock screen](https://github.com/pschatzmann/Android-Time-Services/wiki/Time-Scales) (UTC, TAI, GPS)
- [Important limits](https://github.com/pschatzmann/Android-Time-Services/wiki/Important-Limits)
- [Build and install](https://github.com/pschatzmann/Android-Time-Services/wiki/Build-and-Install) and [tool setup](android/SETUP.md)
- [Translations](https://github.com/pschatzmann/Android-Time-Services/wiki/Translations)
- [Permissions](https://github.com/pschatzmann/Android-Time-Services/wiki/Permissions)
- [Project layout](https://github.com/pschatzmann/Android-Time-Services/wiki/Project-Layout)
- [Releasing on GitHub](https://github.com/pschatzmann/Android-Time-Services/wiki/Releasing-on-GitHub)
- [Before publishing on Google Play](https://github.com/pschatzmann/Android-Time-Services/wiki/Before-publishing-on-Google-Play)
- [Roadmap](https://github.com/pschatzmann/Android-Time-Services/wiki/Roadmap)

## Install

Download the APK from the [Releases](https://github.com/pschatzmann/Android-Time-Services/releases) page (Android 8.0 or newer). Installing outside Google Play requires allowing "Install unknown apps" for your browser or file manager, and Play Protect may ask for confirmation.

To build it yourself: `cd android && ./gradlew installDebug` (see [Build and install](https://github.com/pschatzmann/Android-Time-Services/wiki/Build-and-Install)).

## Sponsor Me

This software is totally free, but you can make me happy by rewarding me with a treat

- [Buy me a coffee](https://www.buymeacoffee.com/philschatzh)
- [Paypal me](https://paypal.me/pschatzmann?country.x=CH&locale.x=en_US)

## License

[MIT](LICENSE)
