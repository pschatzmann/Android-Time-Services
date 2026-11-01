# Translations

All texts live in one table, [android/tools/gen_strings.py](../android/tools/gen_strings.py) (English, German, French, Spanish), plus [zh_strings.py](../android/tools/zh_strings.py) (Simplified Chinese) and [zht_strings.py](../android/tools/zht_strings.py) (Traditional Chinese). The script checks that every string exists in every language and that placeholders such as `%1$d` match, then writes `res/values*/strings.xml`. Do not edit those XML files by hand:

```bash
python3 android/tools/gen_strings.py android/app/src/main/res
```

To add a language: add its column or dictionary in the script, a `<locale>` in `res/xml/locales_config.xml`, the code in `resourceConfigurations` in `app/build.gradle.kts` (script variants use the form `b+zh+Hant`), and a button in the Settings language card.
