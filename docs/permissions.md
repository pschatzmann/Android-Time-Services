# Permissions

| Permission | Used for |
|---|---|
| Internet, network state | NTP queries and serving; detecting when no network is up |
| Fine location | GNSS source; required for BLE scanning on Android 11 and older |
| Bluetooth scan / advertise / connect | BLE CTS client and server (Android 12+) |
| Notifications | The service notification and error alerts |
| Foreground service (special use, connected device, location) | Keeping the servers running in the background |
| Wake lock | Optional "keep running with screen off" |
