# Build and install

See [android/SETUP.md](../android/SETUP.md) for the tool downloads. Then:

```bash
cd android
./gradlew installDebug      # phone connected over USB with USB debugging on
```

Requirements: JDK 17 or newer, Android SDK platform 35, Gradle 8.10.2 (via the wrapper), Android Gradle Plugin 8.7.3, Kotlin 2.0.21, Compose BOM 2024.12.01. The app supports Android 8.0 (API 26) and newer.

Debugging: the log tag is `TimeServices` (`adb logcat -s TimeServices`); source status changes are logged there. Recovered crashes are in the app's `files/crash.log`.
