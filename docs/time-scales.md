# Time scales on the Clock screen

The Clock screen can show the same instant on four scales:

| Scale | What it is | Offset from UTC |
|---|---|---|
| **Local** | UTC plus your time zone and daylight saving | zone-dependent |
| **UTC** | Civil time. Kept close to the Earth's rotation by occasionally inserting a leap second, so it is not perfectly continuous | 0 |
| **TAI** | International Atomic Time: a pure count of atomic-clock seconds with no leap seconds | currently +37 s |
| **GPS** | The time scale broadcast by the GPS satellites. It equalled UTC on 6 January 1980 and has never had a leap second added | currently +18 s (always 19 s behind TAI) |

Notes:

- The **GPS** button is a time scale, not a time source. It has nothing to do with the phone's GNSS receiver, although the receiver reports GPS time internally and the app converts it to UTC by subtracting the 18 s (the optional raw GNSS clock does this).
- The 37 s and 18 s offsets are fixed values in the app. They have not changed since 2017; if a leap second is ever added, both would be one second off until the app is updated.
- Most users want **Local** or **UTC**. TAI and GPS time are mainly useful for engineers and scientists working with satellite or astronomy timing.
