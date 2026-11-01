# Roadmap

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
