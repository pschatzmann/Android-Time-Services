# Project layout

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
