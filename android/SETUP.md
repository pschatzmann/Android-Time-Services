# Developer tool setup (Linux)

Run the steps one at a time. `curl -C -` resumes a partial download, so you can re-run a line that was interrupted. Java 21 is already installed and works with the Gradle and Android Gradle plugin versions used here.

## 1. Android command-line tools (about 150 MB)

```bash
mkdir -p ~/Android/Sdk/cmdline-tools ~/Android/dl && cd ~/Android/dl
curl -L -C - -o clt.zip https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip
unzip -q clt.zip -d clt && rm -rf ~/Android/Sdk/cmdline-tools/latest
mv clt/cmdline-tools ~/Android/Sdk/cmdline-tools/latest
```

## 2. SDK packages (about 1–1.5 GB, the biggest download)

```bash
export ANDROID_HOME=~/Android/Sdk
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platform-tools"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "platforms;android-35"
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager "build-tools;35.0.0"
```

`platform-tools` includes `adb`. Run `sdkmanager` again if one line is interrupted.

## 3. Gradle 8.10.2 (about 130 MB)

```bash
cd ~/Android/dl
curl -L -C - -o gradle.zip https://services.gradle.org/distributions/gradle-8.10.2-bin.zip
unzip -q gradle.zip -d ~/Android
```

## 4. Put the tools on your PATH

```bash
cat >> ~/.bashrc <<'EOF'
export ANDROID_HOME=$HOME/Android/Sdk
export PATH=$PATH:$ANDROID_HOME/platform-tools:$HOME/Android/gradle-8.10.2/bin
EOF
source ~/.bashrc
adb version && gradle --version
```

## 5. Generate the Gradle wrapper (small)

```bash
cd ~/Development/Android-Time-Services/android
gradle wrapper --gradle-version 8.10.2
```

## 6. First build and install

```bash
./gradlew assembleDebug     # APK: app/build/outputs/apk/debug/app-debug.apk
./gradlew installDebug      # installs on the connected phone
```

The first build also downloads the Android Gradle plugin, Kotlin and the Compose libraries, roughly 300–500 MB. Gradle caches them for later builds.

## Preparing the phone

1. Settings → About phone → tap **Build number** 7 times.
2. Settings → Developer options → turn on **USB debugging**.
3. Plug in the USB cable and accept the "Allow USB debugging" prompt on the phone.
4. Check with `adb devices`; the phone should be listed as `device`.
