# Android Time Services (Android, Kotlin / Jetpack Compose)

Native port of the former React/Node web app.

Build & install (USB debugging on):

    export ANDROID_HOME=~/Android/Sdk      # platform-tools, platforms;android-35, build-tools;35.0.0
    gradle wrapper --gradle-version 8.10.2 # once, or open the folder in Android Studio
    ./gradlew installDebug

The NTP server listens on UDP 12123 by default (Android cannot bind port 123 without root).
