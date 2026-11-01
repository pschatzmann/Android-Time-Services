# Releasing on GitHub

A release is a signed APK attached to a GitHub Release.

## The signing key

The release key was created once and lives **outside the repository**, readable only by its owner:

```
~/Android/keystore/timeservices-release.jks      the key
~/Android/keystore/keystore.properties           its alias and passwords
```

- **Back both files up** (for example in a password manager or on an offline drive). If the key is lost, new versions can no longer be installed over existing ones; users would have to uninstall first.
- **Never commit them.** `*.jks` and `keystore.properties` do not belong in git.
- Certificate SHA-256 fingerprint, for users who want to verify the APK:
  `E3:88:04:3F:B9:8A:6F:56:D1:7E:46:7E:F2:4C:BB:99:10:E5:B2:A5:0B:D7:CD:CB:60:11:AC:58:EE:E1:B0:90`

To sign with a key in another location, point `TIMESERVICES_KEYSTORE_PROPERTIES` at a properties file with `storeFile`, `storePassword`, `keyAlias` and `keyPassword`. Without a key file the release build is produced unsigned.

## Build and check

Raise `versionCode` (every release) and `versionName` in `android/app/build.gradle.kts`, then:

```bash
cd android
./gradlew assembleRelease
~/Android/Sdk/build-tools/35.0.0/apksigner verify --print-certs app/build/outputs/apk/release/app-release.apk
```

The APK is `android/app/build/outputs/apk/release/app-release.apk`. A release build cannot be installed over a debug build (different signature); uninstall the debug build first.

## Publish

```bash
VERSION=1.0.0
cp android/app/build/outputs/apk/release/app-release.apk NTP-CTS-Time-Services-$VERSION.apk
sha256sum NTP-CTS-Time-Services-$VERSION.apk > NTP-CTS-Time-Services-$VERSION.apk.sha256
gh release create v$VERSION NTP-CTS-Time-Services-$VERSION.apk NTP-CTS-Time-Services-$VERSION.apk.sha256 \
  --title "v$VERSION" --notes "Release notes here"
```

`*.apk` is git-ignored, so the file is only attached to the release and never committed.

## For users

Installing an APK from outside Google Play needs "Install unknown apps" allowed for the browser or file manager used, and Play Protect may ask for confirmation. The README says so.
