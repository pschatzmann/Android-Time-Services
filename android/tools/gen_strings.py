#!/usr/bin/env python3
"""Generates values/strings.xml and values-{de,fr,es}/strings.xml from one table.

usage: gen_strings.py <res_dir>
Placeholders (%1$d, %2$s ...) must be identical across languages; this is checked.
"""
import os
import re
import sys

# key: (en, de, fr, es)
T = {
    # --- app / navigation ---
    "app_name": ("NTP & CTS Time Services", "NTP & CTS Time Services", "NTP & CTS Time Services", "NTP & CTS Time Services"),
    "app_bar_title": ("NTP & CTS Time Services", "NTP & CTS Time Services", "NTP & CTS Time Services", "NTP & CTS Time Services"),
    "nav_clock": ("Clock", "Uhr", "Horloge", "Reloj"),
    "nav_sources": ("Sources", "Quellen", "Sources", "Fuentes"),
    "nav_publish": ("Publish", "Senden", "Diffuser", "Publicar"),
    "nav_metrics": ("Metrics", "Messwerte", "Mesures", "Métricas"),
    "nav_settings": ("Settings", "Einstellungen", "Réglages", "Ajustes"),
    "chip_unsync": ("UNSYNC", "ASYNC", "DÉSYNC", "SIN SINC"),
    "cd_sync_now": ("Sync now", "Jetzt synchronisieren", "Synchroniser maintenant", "Sincronizar ahora"),
    "cd_toggle_theme": ("Toggle theme", "Design wechseln", "Changer de thème", "Cambiar tema"),

    # --- notification ---
    "notif_channel_name": ("Time services", "Zeitdienste", "Services horaires", "Servicios horarios"),
    "notif_title": ("Time services running", "Zeitdienste aktiv", "Services horaires actifs", "Servicios horarios activos"),
    "notif_starting": ("Starting…", "Wird gestartet …", "Démarrage…", "Iniciando…"),
    "notif_ntp": ("NTP port %1$d · %2$d served", "NTP-Port %1$d · %2$d beantwortet", "Port NTP %1$d · %2$d servies", "Puerto NTP %1$d · %2$d atendidas"),
    "notif_ble": ("BLE CTS · %1$d connected", "BLE CTS · %1$d verbunden", "BLE CTS · %1$d connectés", "BLE CTS · %1$d conectados"),
    "notif_stop": ("Stop", "Stoppen", "Arrêter", "Detener"),
    "notif_ntp_waiting": ("NTP · waiting for network", "NTP · wartet auf Netzwerk", "NTP · en attente du réseau", "NTP · esperando la red"),
    "notif_ble_waiting": ("BLE CTS · waiting for Bluetooth", "BLE CTS · wartet auf Bluetooth", "BLE CTS · en attente du Bluetooth", "BLE CTS · esperando el Bluetooth"),
    "state_waiting_network": ("○ Waiting for network", "○ Wartet auf Netzwerk", "○ En attente du réseau", "○ Esperando la red"),
    "state_waiting_bluetooth": ("○ Waiting for Bluetooth", "○ Wartet auf Bluetooth", "○ En attente du Bluetooth", "○ Esperando el Bluetooth"),

    # --- alerts (error notifications) ---
    "alert_channel_name": ("Alerts", "Warnungen", "Alertes", "Alertas"),
    "alert_ntp_failed_title": ("NTP server problem", "Problem mit dem NTP-Server", "Problème du serveur NTP", "Problema del servidor NTP"),
    "alert_ntp_low_port_hint": (
        "Ports below 1024 need root; choose a higher port in Settings.",
        "Ports unter 1024 benötigen Root; wählen Sie in den Einstellungen einen höheren Port.",
        "Les ports inférieurs à 1024 nécessitent root ; choisissez un port plus élevé dans les réglages.",
        "Los puertos por debajo de 1024 requieren root; elija un puerto más alto en Ajustes.",
    ),
    "alert_ble_failed_title": ("Bluetooth time service problem", "Problem mit dem Bluetooth-Zeitdienst", "Problème du service horaire Bluetooth", "Problema del servicio horario Bluetooth"),
    "alert_unsync_title": ("Publishing unsynchronised time", "Es wird unsynchronisierte Zeit bereitgestellt", "Diffusion d’une heure non synchronisée", "Se publica una hora no sincronizada"),
    "alert_unsync_text": (
        "No time source is reachable, so clients see stratum 16. Check the network connection.",
        "Keine Zeitquelle erreichbar, daher sehen Clients Stratum 16. Netzwerkverbindung prüfen.",
        "Aucune source de temps n’est joignable ; les clients voient la strate 16. Vérifiez la connexion réseau.",
        "No hay ninguna fuente de hora disponible, por lo que los clientes ven estrato 16. Compruebe la conexión de red.",
    ),
    "alert_source_title": ("Time source problem: %1$s", "Problem mit Zeitquelle: %1$s", "Problème de source de temps : %1$s", "Problema con la fuente de hora: %1$s"),
    "alert_service_title": ("Background service could not start", "Hintergrunddienst konnte nicht starten", "Le service en arrière-plan n’a pas pu démarrer", "No se pudo iniciar el servicio en segundo plano"),
    "alert_service_text": (
        "Open the app to restart the time services.",
        "Öffnen Sie die App, um die Zeitdienste neu zu starten.",
        "Ouvrez l’application pour redémarrer les services horaires.",
        "Abra la aplicación para reiniciar los servicios horarios.",
    ),
    "alert_crash_title": ("The app recovered from an error", "Die App hat sich von einem Fehler erholt", "L’application s’est rétablie après une erreur", "La aplicación se recuperó de un error"),
    "err_gnss_unsupported": ("This device has no GNSS receiver", "Dieses Gerät hat keinen GNSS-Empfänger", "Cet appareil n’a pas de récepteur GNSS", "Este dispositivo no tiene receptor GNSS"),
    "gnss_unsupported_note": (
        "This device has no GNSS (GPS) receiver, so this source cannot be used. Use NTP sources instead.",
        "Dieses Gerät hat keinen GNSS-(GPS-)Empfänger, daher kann diese Quelle nicht genutzt werden. Verwenden Sie stattdessen NTP-Quellen.",
        "Cet appareil n’a pas de récepteur GNSS (GPS) ; cette source est donc inutilisable. Utilisez plutôt des sources NTP.",
        "Este dispositivo no tiene receptor GNSS (GPS), por lo que esta fuente no se puede usar. Utilice fuentes NTP en su lugar.",
    ),
    "err_no_network": ("No network connection", "Keine Netzwerkverbindung", "Aucune connexion réseau", "Sin conexión de red"),
    "err_server_stopped": ("The NTP server is not running", "Der NTP-Server läuft nicht", "Le serveur NTP n’est pas en marche", "El servidor NTP no está en ejecución"),
    "query_offline_note": ("No network connection (Wi-Fi and mobile data are off).", "Keine Netzwerkverbindung (WLAN und mobile Daten sind aus).", "Aucune connexion réseau (Wi-Fi et données mobiles désactivés).", "Sin conexión de red (Wi-Fi y datos móviles desactivados)."),
    "alert_engine_title": ("Internal error", "Interner Fehler", "Erreur interne", "Error interno"),

    # --- clock screen ---
    "clock_scale_local": ("Local", "Lokal", "Local", "Local"),
    "clock_chip_synced": ("STRATUM %1$d · REF %2$s", "STRATUM %1$d · REF %2$s", "STRATUM %1$d · REF %2$s", "ESTRATO %1$d · REF %2$s"),
    "clock_chip_unsynced": ("NOT SYNCHRONISED", "NICHT SYNCHRONISIERT", "NON SYNCHRONISÉ", "NO SINCRONIZADO"),
    "clock_tai_label": ("TAI (+%1$ds)", "TAI (+%1$d s)", "TAI (+%1$d s)", "TAI (+%1$d s)"),
    "clock_gps_label": ("GPS (+%1$ds)", "GPS (+%1$d s)", "GPS (+%1$d s)", "GPS (+%1$d s)"),
    "cd_pps_click": ("1PPS click", "1PPS-Klick", "Clic 1PPS", "Clic 1PPS"),
    "tz_header": ("LOCAL TIME ZONE", "LOKALE ZEITZONE", "FUSEAU HORAIRE LOCAL", "ZONA HORARIA LOCAL"),
    "tz_change": ("Change zone", "Zone ändern", "Changer de fuseau", "Cambiar zona"),
    "tz_auto": ("Device / Android local time (auto-detect)", "Gerät / lokale Android-Zeit (automatisch)", "Appareil / heure locale Android (automatique)", "Dispositivo / hora local de Android (automático)"),
    "tile_iana": ("IANA", "IANA", "IANA", "IANA"),
    "tile_utc_offset": ("UTC offset", "UTC-Abweichung", "Décalage UTC", "Desfase UTC"),
    "tile_dst": ("DST", "Sommerzeit", "Heure d’été", "Horario de verano"),
    "dst_active": ("DST active", "Sommerzeit aktiv", "Heure d’été active", "Verano activo"),
    "dst_standard": ("Standard", "Normalzeit", "Heure standard", "Hora estándar"),
    "tile_ble_tz": ("BLE CTS 0x2A0F", "BLE CTS 0x2A0F", "BLE CTS 0x2A0F", "BLE CTS 0x2A0F"),
    "tz_ble_value": ("%1$d×15′ · DST %2$d", "%1$d×15′ · DST %2$d", "%1$d×15′ · DST %2$d", "%1$d×15′ · DST %2$d"),
    "tz_next_forward": ("Next: clocks forward (+%1$s h) on %2$s", "Nächste Umstellung: vor (+%1$s Std.) am %2$s", "Prochain changement : avance (+%1$s h) le %2$s", "Próximo cambio: adelanto (+%1$s h) el %2$s"),
    "tz_next_back": ("Next: clocks back (%1$s h) on %2$s", "Nächste Umstellung: zurück (%1$s Std.) am %2$s", "Prochain changement : retard (%1$s h) le %2$s", "Próximo cambio: atraso (%1$s h) el %2$s"),
    "sync_header": ("SYNCHRONISATION QUALITY", "SYNCHRONISATIONSQUALITÄT", "QUALITÉ DE SYNCHRONISATION", "CALIDAD DE SINCRONIZACIÓN"),
    "tile_offset_vs_system": ("Offset vs system", "Offset zur Systemuhr", "Décalage / système", "Desfase vs. sistema"),
    "tile_drift": ("Drift", "Drift", "Dérive", "Deriva"),
    "tile_root_disp": ("Root dispersion", "Root-Dispersion", "Dispersion racine", "Dispersión raíz"),
    "tile_root_delay": ("Root delay", "Root-Delay", "Délai racine", "Retardo raíz"),
    "clock_note": (
        "The Android system clock cannot be set by an app. Displayed time is the system clock plus the fused offset estimate from the enabled sources.",
        "Die Android-Systemuhr kann von einer App nicht gestellt werden. Die angezeigte Zeit ist die Systemuhr plus der aus den aktivierten Quellen geschätzte Offset.",
        "L’horloge système d’Android ne peut pas être réglée par une application. L’heure affichée est l’horloge système plus le décalage estimé à partir des sources activées.",
        "Una aplicación no puede ajustar el reloj del sistema de Android. La hora mostrada es el reloj del sistema más el desfase estimado a partir de las fuentes activadas.",
    ),

    # --- sources screen ---
    "sources_title": ("Time Sources & Disciplining", "Zeitquellen & Disziplinierung", "Sources de temps et asservissement", "Fuentes de hora y disciplina"),
    "sources_subtitle": (
        "Reference inputs feeding the disciplining engine: NTP servers, phone GNSS, BLE CTS peers. Weights set each source’s share of the fused offset.",
        "Referenzeingänge der Disziplinierung: NTP-Server, Handy-GNSS, BLE-CTS-Geräte. Die Gewichte legen den Anteil jeder Quelle am gemeinsamen Offset fest.",
        "Entrées de référence de l’asservissement : serveurs NTP, GNSS du téléphone, appareils BLE CTS. Les poids fixent la part de chaque source dans le décalage fusionné.",
        "Entradas de referencia de la disciplina del reloj: servidores NTP, GNSS del teléfono, dispositivos BLE CTS. Los pesos fijan la parte de cada fuente en el desfase combinado.",
    ),
    "grant_location": ("Grant location permission", "Standortberechtigung erteilen", "Accorder l’accès à la position", "Conceder permiso de ubicación"),
    "grant_bluetooth": ("Grant Bluetooth permission", "Bluetooth-Berechtigung erteilen", "Accorder l’accès au Bluetooth", "Conceder permiso de Bluetooth"),
    "gnss_active": ("GNSS active", "GNSS aktiv", "GNSS actif", "GNSS activo"),
    "yes": ("yes", "ja", "oui", "sí"),
    "no": ("no", "nein", "non", "no"),
    "gnss_sats": ("Satellites (used/visible)", "Satelliten (genutzt/sichtbar)", "Satellites (utilisés/visibles)", "Satélites (usados/visibles)"),
    "gnss_fix": ("Fix", "Fix", "Position", "Posición"),
    "gnss_fix_yes": ("yes, ±%1$.0f m", "ja, ±%1$.0f m", "oui, ±%1$.0f m", "sí, ±%1$.0f m"),
    "gnss_fix_waiting": ("waiting", "wartet", "en attente", "esperando"),
    "gnss_note": (
        "Fix latency limits accuracy to tens of ms; NTP is usually better.",
        "Die Fix-Latenz begrenzt die Genauigkeit auf einige zehn ms; NTP ist meist besser.",
        "La latence de la position limite la précision à quelques dizaines de ms ; NTP est généralement meilleur.",
        "La latencia del fix limita la precisión a decenas de ms; NTP suele ser mejor.",
    ),
    "ble_client_state": ("Client state", "Client-Status", "État du client", "Estado del cliente"),
    "ble_note": (
        "Leave the address empty to connect to the first peripheral advertising 0x1805.",
        "Adresse leer lassen, um sich mit dem ersten Gerät zu verbinden, das 0x1805 anbietet.",
        "Laissez l’adresse vide pour vous connecter au premier appareil annonçant 0x1805.",
        "Deje la dirección vacía para conectar con el primer dispositivo que anuncie 0x1805.",
    ),
    "kv_reach": ("Reach (octal)", "Reach (oktal)", "Reach (octal)", "Reach (octal)"),
    "kv_stratum": ("Stratum", "Stratum", "Strate", "Estrato"),
    "kv_poll": ("Poll interval", "Abfrageintervall", "Intervalle d’interrogation", "Intervalo de consulta"),
    "kv_last_seen": ("Last seen", "Zuletzt gesehen", "Dernière réponse", "Última vez visto"),
    "never": ("never", "nie", "jamais", "nunca"),
    "poll_value": ("%1$ds", "%1$d s", "%1$d s", "%1$d s"),
    "field_host": ("Host[:port]", "Host[:Port]", "Hôte[:port]", "Host[:puerto]"),
    "field_peer": ("Peer address (AA:BB:..)", "Geräteadresse (AA:BB:..)", "Adresse de l’appareil (AA:BB:..)", "Dirección del dispositivo (AA:BB:..)"),
    "weight_label": ("Weight %1$.2f", "Gewicht %1$.2f", "Poids %1$.2f", "Peso %1$.2f"),
    "tile_offset": ("Offset", "Offset", "Décalage", "Desfase"),
    "tile_delay": ("Delay", "Laufzeit", "Délai", "Retardo"),
    "tile_jitter": ("Jitter", "Jitter", "Gigue", "Jitter"),
    "status_locked": ("locked", "eingerastet", "verrouillé", "enganchado"),
    "status_candidate": ("candidate", "Kandidat", "candidat", "candidato"),
    "status_outlier": ("outlier", "Ausreißer", "aberrant", "atípico"),
    "status_standby": ("standby", "Bereitschaft", "en attente", "en espera"),
    "status_error": ("error", "Fehler", "erreur", "error"),
    "ntp_analyser": ("NTP packet analyser", "NTP-Paketanalyse", "Analyseur de paquets NTP", "Analizador de paquetes NTP"),
    "btn_query_udp": ("Query over UDP", "Per UDP abfragen", "Interroger en UDP", "Consultar por UDP"),
    "querying": ("Querying…", "Abfrage läuft …", "Interrogation…", "Consultando…"),
    "kv_offset": ("Offset", "Offset", "Décalage", "Desfase"),
    "kv_rtt": ("Round-trip delay", "Umlaufzeit", "Délai aller-retour", "Retardo de ida y vuelta"),
    "kv_stratum_ref": ("Stratum / ref", "Stratum / Ref", "Strate / réf.", "Estrato / ref."),
    "kv_precision": ("Precision", "Genauigkeit", "Précision", "Precisión"),
    "kv_root": ("Root delay / disp.", "Root-Delay / -Disp.", "Délai / disp. racine", "Retardo / disp. raíz"),
    "kv_t1": ("T1 originate", "T1 Absendezeit", "T1 émission", "T1 origen"),
    "kv_t2": ("T2 receive", "T2 Empfang", "T2 réception", "T2 recepción"),
    "kv_t3": ("T3 transmit", "T3 Antwort", "T3 transmission", "T3 transmisión"),
    "kv_t4": ("T4 destination", "T4 Ankunft", "T4 arrivée", "T4 destino"),
    "query_failed": ("Query failed", "Abfrage fehlgeschlagen", "Échec de l’interrogation", "La consulta falló"),
    "src_gps": ("Phone GNSS (Location API)", "Handy-GNSS (Standort-API)", "GNSS du téléphone (API de localisation)", "GNSS del teléfono (API de ubicación)"),
    "src_ntp_cf": ("Cloudflare NTP", "Cloudflare NTP", "Cloudflare NTP", "Cloudflare NTP"),
    "src_ntp_google": ("Google Public NTP", "Google Public NTP", "Google Public NTP", "Google Public NTP"),
    "src_ble_cts": ("BLE CTS peripheral", "BLE-CTS-Gerät", "Appareil BLE CTS", "Dispositivo BLE CTS"),
    "src_detail_disabled": ("disabled", "deaktiviert", "désactivé", "desactivado"),
    "src_detail_waiting": ("waiting for first sample", "wartet auf ersten Messwert", "en attente du premier échantillon", "esperando la primera muestra"),
    "src_detail_ntp": ("stratum %1$d, ref %2$s", "Stratum %1$d, Ref %2$s", "strate %1$d, réf. %2$s", "estrato %1$d, ref. %2$s"),
    "src_detail_gnss_acc": ("horizontal accuracy %1$.0f m", "horizontale Genauigkeit %1$.0f m", "précision horizontale %1$.0f m", "precisión horizontal %1$.0f m"),
    "src_detail_gnss_wait": ("waiting for GNSS fix (go outdoors)", "wartet auf GNSS-Fix (nach draußen gehen)", "en attente d’une position GNSS (sortez)", "esperando fix GNSS (salga al exterior)"),
    "src_detail_ble_peer": ("peer %1$s", "Gerät %1$s", "appareil %1$s", "dispositivo %1$s"),
    "err_location_perm": ("Location permission required", "Standortberechtigung erforderlich", "Autorisation de localisation requise", "Se requiere permiso de ubicación"),
    "err_ble_perm": ("Bluetooth permission required", "Bluetooth-Berechtigung erforderlich", "Autorisation Bluetooth requise", "Se requiere permiso de Bluetooth"),

    # --- publish screen ---
    "publish_title": ("Time Publishing Services", "Zeitdienste", "Services de diffusion de l’heure", "Servicios de publicación de hora"),
    "publish_subtitle": (
        "Serve the disciplined clock to other devices as an NTP server (UDP) and a Bluetooth LE Current Time Service peripheral.",
        "Die disziplinierte Uhr anderen Geräten als NTP-Server (UDP) und als Bluetooth-LE-Current-Time-Service bereitstellen.",
        "Fournit l’horloge asservie à d’autres appareils comme serveur NTP (UDP) et comme périphérique Bluetooth LE Current Time Service.",
        "Ofrece el reloj disciplinado a otros dispositivos como servidor NTP (UDP) y como periférico Bluetooth LE Current Time Service.",
    ),
    "ntp_server_title": ("NTP server (RFC 5905)", "NTP-Server (RFC 5905)", "Serveur NTP (RFC 5905)", "Servidor NTP (RFC 5905)"),
    "state_error": ("● Error", "● Fehler", "● Erreur", "● Error"),
    "ntp_serving": ("● Serving on UDP %1$d", "● Läuft auf UDP %1$d", "● Actif sur UDP %1$d", "● Activo en UDP %1$d"),
    "state_stopped": ("○ Stopped", "○ Gestoppt", "○ Arrêté", "○ Detenido"),
    "ble_advertising": ("● Advertising", "● Sendet Advertising", "● Annonce en cours", "● Anunciando"),
    "kv_time_source": ("Time source", "Zeitquelle", "Source de temps", "Fuente de hora"),
    "src_fused": ("Fused", "Kombiniert", "Fusionnée", "Combinada"),
    "src_system": ("System clock", "Systemuhr", "Horloge système", "Reloj del sistema"),
    "src_missing": ("(missing)", "(fehlt)", "(introuvable)", "(no encontrada)"),
    "kv_stratum_refid": ("Stratum / ref ID", "Stratum / Ref-ID", "Strate / ID de réf.", "Estrato / ID de ref."),
    "kv_packets": ("Packets served", "Beantwortete Pakete", "Paquets servis", "Paquetes atendidos"),
    "kv_dropped": ("Dropped (ACL / rate)", "Verworfen (ACL / Limit)", "Rejetés (ACL / débit)", "Descartados (ACL / límite)"),
    "kv_last_client": ("Last client", "Letzter Client", "Dernier client", "Último cliente"),
    "ntp_port_note": (
        "Android cannot bind ports below 1024 without root, so clients must target this phone’s IP on port %1$d (for example with chronyc or ntpdate -p). Change the port in Settings.",
        "Android kann ohne Root keine Ports unter 1024 belegen. Clients müssen daher die IP dieses Handys auf Port %1$d ansprechen (z. B. mit chronyc oder ntpdate -p). Der Port lässt sich in den Einstellungen ändern.",
        "Android ne peut pas ouvrir de port inférieur à 1024 sans root ; les clients doivent donc viser l’IP de ce téléphone sur le port %1$d (par exemple avec chronyc ou ntpdate -p). Le port se change dans les réglages.",
        "Android no puede abrir puertos por debajo de 1024 sin root, así que los clientes deben dirigirse a la IP de este teléfono en el puerto %1$d (por ejemplo con chronyc o ntpdate -p). El puerto se cambia en Ajustes.",
    ),
    "btn_test_self": ("Send test query to myself", "Testabfrage an mich selbst senden", "Envoyer une requête de test à moi-même", "Enviarme una consulta de prueba"),
    "kv_reply": ("Reply stratum / ref", "Antwort-Stratum / Ref", "Strate / réf. de la réponse", "Estrato / ref. de la respuesta"),
    "kv_offset_loopback": ("Offset (loopback)", "Offset (Loopback)", "Décalage (bouclage)", "Desfase (loopback)"),
    "kv_delay": ("Delay", "Laufzeit", "Délai", "Retardo"),
    "failed": ("failed", "fehlgeschlagen", "échec", "falló"),
    "ble_title": ("BLE Current Time Service (0x1805)", "BLE Current Time Service (0x1805)", "BLE Current Time Service (0x1805)", "BLE Current Time Service (0x1805)"),
    "kv_peers": ("Connected peers", "Verbundene Geräte", "Appareils connectés", "Dispositivos conectados"),
    "kv_subscribers": ("Notification subscribers", "Benachrichtigungs-Abonnenten", "Abonnés aux notifications", "Suscriptores de notificaciones"),
    "kv_notifications": ("Notifications", "Benachrichtigungen", "Notifications", "Notificaciones"),
    "notif_1hz": ("1 Hz", "1 Hz", "1 Hz", "1 Hz"),
    "notif_off": ("off", "aus", "désactivées", "desactivadas"),
    "ble_preview": ("0x2A2B Current Time (preview)", "0x2A2B Current Time (Vorschau)", "0x2A2B Current Time (aperçu)", "0x2A2B Current Time (vista previa)"),
    "ble_note_pub": (
        "The peripheral advertises under the phone’s own Bluetooth name. Characteristics: 0x2A2B Current Time (read/notify), 0x2A0F Local Time Info, 0x2A14 Reference Time Info.",
        "Das Gerät sendet unter dem eigenen Bluetooth-Namen des Handys. Merkmale: 0x2A2B Current Time (lesen/benachrichtigen), 0x2A0F Local Time Info, 0x2A14 Reference Time Info.",
        "L’appareil s’annonce sous le nom Bluetooth du téléphone. Caractéristiques : 0x2A2B Current Time (lecture/notification), 0x2A0F Local Time Info, 0x2A14 Reference Time Info.",
        "El periférico se anuncia con el nombre Bluetooth del propio teléfono. Características: 0x2A2B Current Time (lectura/notificación), 0x2A0F Local Time Info, 0x2A14 Reference Time Info.",
    ),
    "btn_server_settings": ("Server settings", "Servereinstellungen", "Réglages du serveur", "Ajustes del servidor"),

    # --- metrics screen ---
    "metrics_title": ("Telemetry & Clock Drift", "Telemetrie & Uhrendrift", "Télémétrie et dérive de l’horloge", "Telemetría y deriva del reloj"),
    "metrics_subtitle": (
        "Measured phase offset, correction rate in ppb (parts per billion), per-source offsets and transport delay.",
        "Gemessener Phasen-Offset, Korrekturrate in ppb (Teile pro Milliarde), Offsets je Quelle und Übertragungslaufzeit.",
        "Décalage de phase mesuré, taux de correction en ppb (parties par milliard), décalages par source et délai de transport.",
        "Desfase de fase medido, tasa de corrección en ppb (partes por mil millones), desfases por fuente y retardo de transporte.",
    ),
    "window_1m": ("1 min", "1 Min.", "1 min", "1 min"),
    "window_5m": ("5 min", "5 Min.", "5 min", "5 min"),
    "window_15m": ("15 min", "15 Min.", "15 min", "15 min"),
    "chart_fused": ("Fused offset (ms) & drift (ppb)", "Gemeinsamer Offset (ms) & Drift (ppb)", "Décalage fusionné (ms) et dérive (ppb)", "Desfase combinado (ms) y deriva (ppb)"),
    "chart_offset_ms": ("Offset (ms)", "Offset (ms)", "Décalage (ms)", "Desfase (ms)"),
    "chart_drift_now": ("Drift (ppb)  now %1$+.1f", "Drift (ppb)  aktuell %1$+.1f", "Dérive (ppb)  actuelle %1$+.1f", "Deriva (ppb)  ahora %1$+.1f"),
    "chart_note_offset": (
        "How far the phone’s clock is from true time, estimated from all enabled sources. Negative means the phone’s clock is ahead.",
        "Wie weit die Uhr des Handys von der wahren Zeit abweicht, geschätzt aus allen aktivierten Quellen. Negativ bedeutet: Die Handy-Uhr geht vor.",
        "Écart de l’horloge du téléphone par rapport à l’heure réelle, estimé à partir de toutes les sources activées. Une valeur négative signifie que l’horloge du téléphone avance.",
        "Cuánto se desvía el reloj del teléfono de la hora real, estimado con todas las fuentes activadas. Un valor negativo significa que el reloj del teléfono va adelantado.",
    ),
    "chart_note_drift": (
        "How fast that estimate is changing. Close to 0 means a steady clock; large values show a correction in progress.",
        "Wie schnell sich diese Schätzung ändert. Nahe 0 bedeutet eine stabile Uhr; große Werte zeigen eine laufende Korrektur.",
        "Vitesse à laquelle cette estimation change. Proche de 0 : horloge stable ; de grandes valeurs indiquent une correction en cours.",
        "A qué velocidad cambia esa estimación. Cerca de 0 indica un reloj estable; los valores grandes muestran una corrección en curso.",
    ),
    "chart_note_sources": (
        "What each source measures on its own. Sources that agree are combined; one far from the others is ignored as an outlier. GNSS is noisier than NTP.",
        "Was jede Quelle für sich misst. Übereinstimmende Quellen werden kombiniert; eine stark abweichende wird als Ausreißer ignoriert. GNSS ist ungenauer als NTP.",
        "Ce que mesure chaque source séparément. Les sources concordantes sont combinées ; une source très éloignée des autres est ignorée comme aberrante. Le GNSS est plus bruité que le NTP.",
        "Lo que mide cada fuente por separado. Las fuentes que coinciden se combinan; una muy alejada de las demás se ignora como atípica. El GNSS es más ruidoso que el NTP.",
    ),
    "chart_note_delay": (
        "Round-trip time to each source. Lower and steadier is better; high or jumpy delays make readings less accurate.",
        "Umlaufzeit zu jeder Quelle. Niedriger und stabiler ist besser; hohe oder schwankende Laufzeiten machen die Messwerte ungenauer.",
        "Temps aller-retour vers chaque source. Plus bas et plus stable, c’est mieux ; des délais élevés ou irréguliers rendent les mesures moins précises.",
        "Tiempo de ida y vuelta a cada fuente. Cuanto más bajo y estable, mejor; retardos altos o irregulares hacen las mediciones menos precisas.",
    ),
    "chart_per_source": ("Per-source offset (ms)", "Offset je Quelle (ms)", "Décalage par source (ms)", "Desfase por fuente (ms)"),
    "legend_ntp": ("● NTP  ", "● NTP  ", "● NTP  ", "● NTP  "),
    "legend_gnss": ("● GNSS  ", "● GNSS  ", "● GNSS  ", "● GNSS  "),
    "legend_ble": ("● BLE CTS", "● BLE CTS", "● BLE CTS", "● BLE CTS"),
    "chart_delay": ("Transport delay (ms)", "Übertragungslaufzeit (ms)", "Délai de transport (ms)", "Retardo de transporte (ms)"),
    "legend_ntp_rtt": ("● NTP round-trip  ", "● NTP-Umlaufzeit  ", "● Aller-retour NTP  ", "● Ida y vuelta NTP  "),
    "legend_ble_rtt": ("● BLE read round-trip", "● BLE-Leseumlaufzeit", "● Aller-retour lecture BLE", "● Ida y vuelta lectura BLE"),

    # --- settings screen ---
    "settings_title": ("Settings", "Einstellungen", "Réglages", "Ajustes"),
    "settings_subtitle": (
        "Server, BLE and clock-disciplining parameters. Saved on the phone.",
        "Parameter für Server, BLE und Uhren-Disziplinierung. Werden auf dem Handy gespeichert.",
        "Paramètres du serveur, du BLE et de l’asservissement de l’horloge. Enregistrés sur le téléphone.",
        "Parámetros del servidor, BLE y disciplina del reloj. Se guardan en el teléfono.",
    ),
    "pub_source_title": ("Publishing time source", "Zeitquelle für die Bereitstellung", "Source de l’heure diffusée", "Fuente de la hora publicada"),
    "pub_source_note": (
        "Which clock the NTP and BLE CTS servers hand out. If the chosen source has no recent sample, the servers advertise stratum 16 / unsynchronised.",
        "Welche Uhr die NTP- und BLE-CTS-Server ausgeben. Hat die gewählte Quelle keinen aktuellen Messwert, melden die Server Stratum 16 / nicht synchronisiert.",
        "L’horloge que fournissent les serveurs NTP et BLE CTS. Si la source choisie n’a pas d’échantillon récent, les serveurs annoncent la strate 16 / non synchronisé.",
        "El reloj que entregan los servidores NTP y BLE CTS. Si la fuente elegida no tiene una muestra reciente, los servidores anuncian estrato 16 / no sincronizado.",
    ),
    "pub_fused": ("Fused (all enabled sources)", "Kombiniert (alle aktivierten Quellen)", "Fusionnée (toutes les sources activées)", "Combinada (todas las fuentes activadas)"),
    "pub_system": ("Phone system clock (as is)", "Systemuhr des Handys (unverändert)", "Horloge système du téléphone (telle quelle)", "Reloj del sistema del teléfono (tal cual)"),
    "disabled_suffix": (" (disabled)", " (deaktiviert)", " (désactivée)", " (desactivada)"),
    "ntp_cfg_title": ("Phone NTP server", "NTP-Server auf dem Handy", "Serveur NTP du téléphone", "Servidor NTP del teléfono"),
    "f_port": ("UDP listen port (≥ 1024)", "UDP-Port (≥ 1024)", "Port d’écoute UDP (≥ 1024)", "Puerto UDP de escucha (≥ 1024)"),
    "f_stratum": ("Stratum", "Stratum", "Strate", "Estrato"),
    "f_refid": ("Reference ID (4 chars)", "Referenz-ID (4 Zeichen)", "ID de référence (4 car.)", "ID de referencia (4 car.)"),
    "f_leap": ("Leap indicator", "Schaltsekunden-Hinweis", "Indicateur de seconde intercalaire", "Indicador de segundo intercalar"),
    "leap_none": ("none", "keiner", "aucun", "ninguno"),
    "leap_add": ("+1s", "+1 s", "+1 s", "+1 s"),
    "leap_del": ("-1s", "−1 s", "−1 s", "−1 s"),
    "leap_unsync": ("unsync", "async", "désync", "sin sinc"),
    "f_rate": ("Rate limit per client (queries/min, 0 = off)", "Limit pro Client (Anfragen/Min., 0 = aus)", "Limite par client (requêtes/min, 0 = désactivé)", "Límite por cliente (consultas/min, 0 = sin límite)"),
    "f_subnets": ("Allowed subnets (CIDR, comma separated)", "Erlaubte Subnetze (CIDR, durch Komma getrennt)", "Sous-réseaux autorisés (CIDR, séparés par des virgules)", "Subredes permitidas (CIDR, separadas por comas)"),
    "ntp_servers_title": ("NTP time servers", "NTP-Zeitserver", "Serveurs de temps NTP", "Servidores de hora NTP"),
    "ntp_servers_note": (
        "Servers this phone queries over UDP. Use host or host:port. Changes apply when you press Save.",
        "Server, die dieses Handy per UDP abfragt. Format: Host oder Host:Port. Änderungen gelten nach „Speichern“.",
        "Serveurs interrogés en UDP par ce téléphone. Format : hôte ou hôte:port. Les modifications s’appliquent après « Enregistrer ».",
        "Servidores que este teléfono consulta por UDP. Use host o host:puerto. Los cambios se aplican al pulsar «Guardar».",
    ),
    "f_ntp_name": ("Name (optional)", "Name (optional)", "Nom (facultatif)", "Nombre (opcional)"),
    "f_ntp_poll": ("Poll (s)", "Abfrage (s)", "Interrogation (s)", "Consulta (s)"),
    "ntp_host_invalid": (
        "Enter a host name or IP address, optionally followed by :port",
        "Hostnamen oder IP-Adresse eingeben, optional mit :Port",
        "Saisissez un nom d’hôte ou une adresse IP, éventuellement suivi de :port",
        "Introduzca un nombre de host o una IP, opcionalmente seguido de :puerto",
    ),
    "btn_add_server": ("Add server", "Server hinzufügen", "Ajouter un serveur", "Añadir servidor"),
    "ntp_quick_add": ("Quick add", "Schnell hinzufügen", "Ajout rapide", "Añadir rápido"),
    "cd_remove_server": ("Remove server", "Server entfernen", "Supprimer le serveur", "Quitar servidor"),
    "f_notify_interval": ("Notification interval (0.1 s – 24 h)", "Benachrichtigungsintervall (0,1 s – 24 Std.)", "Intervalle de notification (0,1 s – 24 h)", "Intervalo de notificación (0,1 s – 24 h)"),
    "unit_seconds": ("seconds", "Sekunden", "secondes", "segundos"),
    "unit_minutes": ("minutes", "Minuten", "minutes", "minutos"),
    "unit_hours": ("hours", "Stunden", "heures", "horas"),
    "notify_every": ("every %1$s", "alle %1$s", "toutes les %1$s", "cada %1$s"),
    "legend_gnss_dashed": ("╌ GNSS (dashed)  ", "╌ GNSS (gestrichelt)  ", "╌ GNSS (pointillé)  ", "╌ GNSS (discontinua)  "),
    "ntp_cfg_note": (
        "Settings for the NTP server this phone offers to other devices. Switch it on in the Publish tab.",
        "Einstellungen für den NTP-Server, den dieses Handy anderen Geräten anbietet. Einschalten im Tab „Senden“.",
        "Réglages du serveur NTP que ce téléphone propose aux autres appareils. Activez-le dans l’onglet « Diffuser ».",
        "Ajustes del servidor NTP que este teléfono ofrece a otros dispositivos. Actívelo en la pestaña «Publicar».",
    ),
    "ble_cfg_note": (
        "Settings for the Bluetooth Current Time Service this phone offers to nearby devices. Switch it on in the Publish tab.",
        "Einstellungen für den Bluetooth-Current-Time-Service, den dieses Handy Geräten in der Nähe anbietet. Einschalten im Tab „Senden“.",
        "Réglages du service Bluetooth Current Time que ce téléphone propose aux appareils proches. Activez-le dans l’onglet « Diffuser ».",
        "Ajustes del servicio Bluetooth Current Time que este teléfono ofrece a dispositivos cercanos. Actívelo en la pestaña «Publicar».",
    ),
    "disc_note": (
        "How readings from the time sources are combined into one clock estimate, and how quickly that estimate follows them.",
        "Wie die Messwerte der Zeitquellen zu einer gemeinsamen Zeitschätzung kombiniert werden und wie schnell diese Schätzung ihnen folgt.",
        "Comment les mesures des sources de temps sont combinées en une seule estimation de l’heure, et à quelle vitesse cette estimation les suit.",
        "Cómo se combinan las lecturas de las fuentes de hora en una sola estimación del reloj y con qué rapidez la sigue.",
    ),
    "lang_note": (
        "Language of the app. “System default” follows your phone’s language.",
        "Sprache der App. „Systemstandard“ folgt der Sprache des Handys.",
        "Langue de l’application. « Par défaut du système » suit la langue du téléphone.",
        "Idioma de la aplicación. «Predeterminado del sistema» sigue el idioma del teléfono.",
    ),
    "ble_cfg_title": ("BLE Current Time Service", "BLE Current Time Service", "BLE Current Time Service", "BLE Current Time Service"),
    "f_adv": ("Advertising interval (ms)", "Advertising-Intervall (ms)", "Intervalle d’annonce (ms)", "Intervalo de anuncio (ms)"),
    "f_notify": ("Notify subscribers", "Abonnenten benachrichtigen", "Notifier les abonnés", "Notificar a los suscriptores"),
    "disc_title": ("Clock disciplining", "Uhren-Disziplinierung", "Asservissement de l’horloge", "Disciplina del reloj"),
    "algo_kalman": ("Weighted mean", "Gewichteter Mittelwert", "Moyenne pondérée", "Media ponderada"),
    "algo_marzullo": ("Median", "Median", "Médiane", "Mediana"),
    "algo_pll": ("PLL/FLL", "PLL/FLL", "PLL/FLL", "PLL/FLL"),
    "f_tau": ("PLL time constant τ (s)", "PLL-Zeitkonstante τ (s)", "Constante de temps PLL τ (s)", "Constante de tiempo PLL τ (s)"),
    "f_fll": ("FLL bandwidth (Hz, PLL/FLL only)", "FLL-Bandbreite (Hz, nur PLL/FLL)", "Bande passante FLL (Hz, PLL/FLL uniquement)", "Ancho de banda FLL (Hz, solo PLL/FLL)"),
    "f_slew": ("Max slew (ppm)", "Max. Korrekturrate (ppm)", "Pente max. (ppm)", "Pendiente máx. (ppm)"),
    "f_holdover": ("Holdover timeout (s)", "Holdover-Zeitlimit (s)", "Délai de maintien (s)", "Tiempo máximo de holdover (s)"),
    "f_prefer1": ("Prefer stratum-1 sources (2× weight)", "Stratum-1-Quellen bevorzugen (2× Gewicht)", "Privilégier les sources de strate 1 (poids ×2)", "Preferir fuentes de estrato 1 (peso ×2)"),
    "bg_title": ("Background operation", "Hintergrundbetrieb", "Fonctionnement en arrière-plan", "Funcionamiento en segundo plano"),
    "bg_note": (
        "While a server is enabled, a notification keeps the app running after you close it.",
        "Solange ein Server aktiv ist, hält eine Benachrichtigung die App nach dem Schließen am Laufen.",
        "Tant qu’un serveur est activé, une notification maintient l’application en marche après sa fermeture.",
        "Mientras haya un servidor activado, una notificación mantiene la aplicación en marcha tras cerrarla.",
    ),
    "bg_keep_awake": (
        "Keep running with screen off (wake + Wi-Fi lock, uses more battery)",
        "Bei ausgeschaltetem Bildschirm weiterlaufen (Wake- und WLAN-Sperre, höherer Akkuverbrauch)",
        "Continuer écran éteint (verrou d’éveil et Wi-Fi, consomme plus de batterie)",
        "Seguir funcionando con la pantalla apagada (bloqueo de reposo y Wi-Fi, mayor consumo de batería)",
    ),
    "bg_battery": ("Battery optimisation settings", "Akku-Optimierung", "Optimisation de la batterie", "Optimización de batería"),
    "btn_save": ("Save", "Speichern", "Enregistrer", "Guardar"),
    "btn_reset": ("Reset defaults", "Standard wiederherstellen", "Rétablir les valeurs par défaut", "Restablecer valores"),
    "lang_title": ("Language", "Sprache", "Langue", "Idioma"),
    "lang_system": ("System default", "Systemstandard", "Par défaut du système", "Predeterminado del sistema"),
    "lang_en": ("English", "English", "English", "English"),
    "lang_de": ("Deutsch", "Deutsch", "Deutsch", "Deutsch"),
    "lang_fr": ("Français", "Français", "Français", "Français"),
    "lang_es": ("Español", "Español", "Español", "Español"),
    "lang_zh": ("简体中文", "简体中文", "简体中文", "简体中文"),
    "lang_zht": ("繁體中文", "繁體中文", "繁體中文", "繁體中文"),

    # --- BLE server errors ---
    "ble_err_no_bt": ("This device has no Bluetooth", "Dieses Gerät hat kein Bluetooth", "Cet appareil n’a pas de Bluetooth", "Este dispositivo no tiene Bluetooth"),
    "ble_err_off": ("Bluetooth is turned off", "Bluetooth ist ausgeschaltet", "Le Bluetooth est désactivé", "El Bluetooth está desactivado"),
    "ble_err_no_adv": ("BLE advertising is not supported", "BLE-Advertising wird nicht unterstützt", "L’annonce BLE n’est pas prise en charge", "El anuncio BLE no es compatible"),
    "ble_err_denied": ("Bluetooth permission denied", "Bluetooth-Berechtigung verweigert", "Autorisation Bluetooth refusée", "Permiso de Bluetooth denegado"),
    "ble_err_gatt": ("Could not open GATT server", "GATT-Server konnte nicht geöffnet werden", "Impossible d’ouvrir le serveur GATT", "No se pudo abrir el servidor GATT"),
    "ble_err_add": ("addService failed", "addService fehlgeschlagen", "Échec de addService", "addService falló"),
    "ble_err_add_status": ("GATT service add failed (%1$d)", "GATT-Dienst konnte nicht hinzugefügt werden (%1$d)", "Échec de l’ajout du service GATT (%1$d)", "No se pudo añadir el servicio GATT (%1$d)"),
    "ble_err_adv_fail": ("Advertising failed (code %1$d)", "Advertising fehlgeschlagen (Code %1$d)", "Échec de l’annonce (code %1$d)", "Falló el anuncio (código %1$d)"),

    # --- BLE client states ---
    "bc_idle": ("idle", "inaktiv", "inactif", "inactivo"),
    "bc_bt_off": ("Bluetooth is off", "Bluetooth ist aus", "Bluetooth désactivé", "Bluetooth desactivado"),
    "bc_connecting": ("connecting to %1$s", "verbinde mit %1$s", "connexion à %1$s", "conectando con %1$s"),
    "bc_scanning": ("scanning for Current Time Service", "suche Current Time Service", "recherche du Current Time Service", "buscando Current Time Service"),
    "bc_scan_unavail": ("BLE scanning unavailable", "BLE-Suche nicht verfügbar", "Recherche BLE indisponible", "Búsqueda BLE no disponible"),
    "bc_scan_failed": ("scan failed (%1$d)", "Suche fehlgeschlagen (%1$d)", "échec de la recherche (%1$d)", "falló la búsqueda (%1$d)"),
    "bc_none_found": ("no CTS peripheral found", "kein CTS-Gerät gefunden", "aucun appareil CTS trouvé", "no se encontró ningún dispositivo CTS"),
    "bc_no_char": ("peer has no 0x2A2B", "Gerät hat kein 0x2A2B", "l’appareil n’a pas de 0x2A2B", "el dispositivo no tiene 0x2A2B"),
    "bc_read_failed": ("read failed (%1$d)", "Lesen fehlgeschlagen (%1$d)", "échec de lecture (%1$d)", "falló la lectura (%1$d)"),
    "bc_connected": ("connected", "verbunden", "connecté", "conectado"),
    "bc_disconnected": ("disconnected", "getrennt", "déconnecté", "desconectado"),
    "bc_no_service": ("peer has no Current Time Service", "Gerät bietet keinen Current Time Service", "l’appareil n’a pas de Current Time Service", "el dispositivo no tiene Current Time Service"),
}

import importlib.util
_spec = importlib.util.spec_from_file_location("zh_strings", os.path.join(os.path.dirname(os.path.abspath(__file__)), "zh_strings.py"))
_zh = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_zh)
ZH = _zh.ZH
_spec_t = importlib.util.spec_from_file_location("zht_strings", os.path.join(os.path.dirname(os.path.abspath(__file__)), "zht_strings.py"))
_zht = importlib.util.module_from_spec(_spec_t)
_spec_t.loader.exec_module(_zht)
ZHT = _zht.ZHT
LANGS = [("values", 0), ("values-de", 1), ("values-fr", 2), ("values-es", 3), ("values-zh", 4), ("values-b+zh+Hant", 5)]
PH = re.compile(r"%\d\$[-+#0 ,(]*\d*(?:\.\d+)?[a-zA-Z]")


def esc(s: str) -> str:
    s = s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    s = s.replace("\\", "\\\\").replace("'", "\\'").replace('"', '\\"')
    if s.startswith(" ") or s.endswith(" "):
        s = s  # whitespace is preserved inside <string>; kept as is
    return s


def main(res_dir: str) -> None:
    for key, vals in T.items():
        assert len(vals) == 4, key
        base = sorted(PH.findall(vals[0]))
        for lang, v in zip(("de", "fr", "es"), vals[1:]):
            assert sorted(PH.findall(v)) == base, f"placeholder mismatch in {key} ({lang}): {vals[0]!r} vs {v!r}"
    missing = [k for k in T if k not in NONTRANS and k not in ZH]
    extra = [k for k in ZH if k not in T]
    assert not missing, f"missing zh: {missing}"
    assert not extra, f"unknown zh keys: {extra}"
    for k, v in ZH.items():
        assert sorted(PH.findall(v)) == sorted(PH.findall(T[k][0])), f"placeholder mismatch in zh {k}: {T[k][0]!r} vs {v!r}"
    assert set(ZHT) == set(ZH), f"zh / zht key mismatch: {set(ZH) ^ set(ZHT)}"
    for k, v in ZHT.items():
        assert sorted(PH.findall(v)) == sorted(PH.findall(T[k][0])), f"placeholder mismatch in zht {k}: {T[k][0]!r} vs {v!r}"
    for d, idx in LANGS:
        path = os.path.join(res_dir, d)
        os.makedirs(path, exist_ok=True)
        with open(os.path.join(path, "strings.xml"), "w", encoding="utf-8") as f:
            f.write('<?xml version="1.0" encoding="utf-8"?>\n<resources>\n')
            for key, vals in T.items():
                extra = ' translatable="false"' if idx == 0 and key in NONTRANS else ""
                if idx != 0 and key in NONTRANS:
                    continue
                f.write(f'    <string name="{key}"{extra}>{esc(ZHT[key] if idx == 5 and key in ZHT else ZH[key] if idx == 4 and key in ZH else vals[min(idx, 3)])}</string>\n')
            f.write("</resources>\n")
    print(f"{len(T)} strings x {len(LANGS)} languages")


NONTRANS = {
    "app_name", "app_bar_title", "tile_iana", "tile_ble_tz", "src_ntp_cf", "src_ntp_google", "ble_title",
    "notif_1hz", "legend_ntp", "legend_gnss", "legend_ble", "algo_pll", "ble_cfg_title",
    "lang_en", "lang_de", "lang_fr", "lang_es", "lang_zh", "lang_zht",
}

if __name__ == "__main__":
    main(sys.argv[1])
