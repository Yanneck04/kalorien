# Kalorien & Gewicht – Anleitung

## Was du brauchst

- Ein kostenloses **GitHub-Konto** (github.com) **oder** ein kostenloses **Netlify-Konto** (netlify.com). Damit stellst du die App online.
- Für die Foto-Erkennung: einen **Anthropic-API-Schlüssel** (siehe unten). Ohne Schlüssel funktioniert alles andere trotzdem.

## App online stellen – Weg A: Netlify Drop (am einfachsten)

1. Im Browser **app.netlify.com/drop** öffnen.
2. Den ganzen Ordner **kalorien-app** in das Feld auf der Seite ziehen.
3. Ein kostenloses Konto anlegen, wenn Netlify danach fragt. Sonst wird die Seite nach kurzer Zeit wieder gelöscht.
4. Den angezeigten Link notieren (z. B. `https://irgendwas-123.netlify.app`).
5. Wenn du willst, kannst du die Seite umbenennen: **Site configuration → Change site name**.

## Weg B: GitHub Pages

1. Auf github.com ein neues Repository anlegen (**New**), Sichtbarkeit **Public**, Name z. B. `kalorien`.
2. Im Repository **Add file → Upload files** klicken und alle Dateien **aus dem Ordner** kalorien-app hineinziehen (auch den Ordner `icons`). Unten **Commit changes** klicken.
3. **Settings → Pages**: bei „Branch“ **main** und **/ (root)** wählen, **Save** klicken.
4. Nach 1–2 Minuten ist die App erreichbar unter `https://NAME.github.io/REPO/` (NAME = dein GitHub-Name, REPO = Name des Repositorys).

## Auf dem iPhone installieren

1. Den Link in **Safari** öffnen (nicht Chrome, nicht die Claude-App).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. **„Zum Home-Bildschirm“** wählen und **„Hinzufügen“** tippen.
4. Die App ab jetzt immer über das neue Icon auf dem Home-Bildschirm starten.

## Am PC

- Den Link in **Chrome** oder **Edge** öffnen.
- Rechts in der Adressleiste auf das **Installieren-Symbol** klicken – dann läuft die App wie ein eigenes Programm.
- Alternativ einfach als Lesezeichen speichern.

## Foto-Erkennung einrichten

1. **console.anthropic.com** öffnen und ein Konto anlegen bzw. anmelden.
2. Unter **Billing** Guthaben aufladen (z. B. 5 $).
3. Unter **API Keys** auf **Create Key** klicken und den Schlüssel kopieren (er wird nur einmal angezeigt).
4. In der App auf das **Zahnrad** tippen → **„Foto-Erkennung“** → Schlüssel einfügen → **Speichern**.

**Kosten:** grob wenige Cent pro Foto. Verwendet wird das Modell Claude Opus 5.5 (4 $ pro Million Eingabe-Token, 20 $ pro Million Ausgabe-Token).

**Sicherheit:**
- Der Schlüssel wird nur auf deinem eigenen Gerät gespeichert.
- Gib den Schlüssel niemals weiter.
- Setze in der Console unter **Limits** ein monatliches Ausgabelimit.
- Wenn das Gerät verloren geht oder der Schlüssel bekannt wird: Schlüssel in der Console unter **API Keys** löschen.

## Daten zwischen Handy und PC

Jedes Gerät speichert seine eigenen Daten – sie werden **nicht** automatisch abgeglichen.
Zum Übertragen: **Zahnrad → Daten sichern → Export** auf dem einen Gerät, die Datei auf das andere Gerät bringen und dort **Import** wählen.

- **iPhone:** Nach „Export“ öffnet sich das Teilen-Menü. Dort **„In Dateien sichern“** wählen (oder die Datei z. B. per Mail an dich selbst schicken). Beim Import die Datei in der Dateien-App auswählen.
- **PC:** Die Datei landet im Download-Ordner.
- Beim **Import** fragt die App noch einmal nach („Daten ersetzen“). Alle Daten auf diesem Gerät werden dann durch die Sicherung ersetzt.

## Updates

1. Die neuen Dateien erneut hochladen (Netlify: Ordner wieder auf die Drop-Seite der Site ziehen unter **Deploys**; GitHub: wieder **Upload files**).
2. Die App einmal komplett schließen und neu öffnen – dann ist die neue Version da.

## Wenn etwas nicht geht

- **Foto-Button öffnet keine Kamera:** iPhone-**Einstellungen → Safari → Kamera** → „Erlauben“ bzw. „Fragen“ einstellen.
- **„API-Schlüssel ungültig“:** Schlüssel neu kopieren und einfügen (ohne Leerzeichen davor/danach) oder in der Console einen neuen erstellen.
- **„Dein Anthropic-Guthaben reicht nicht“** oder **„Guthaben-Limit erreicht“:** In der Console unter **Billing** Guthaben nachladen bzw. unter **Limits** das Limit prüfen.
- **„Foto-Erkennung braucht Internet“ / „Keine Verbindung“:** Die Foto-Erkennung funktioniert nur online. Alles andere geht auch offline.
- **Daten sind weg:** iOS löscht die Daten von Web-Apps, die längere Zeit nicht geöffnet wurden. Deshalb regelmäßig über **Zahnrad → Daten sichern → Export** eine Sicherung machen.
