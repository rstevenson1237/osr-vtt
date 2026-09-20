# OSR VTT — local build

This is a self-contained release of OSR VTT's **local mode**: one referee, one campaign
file, no server. There is no Firebase project behind this build, no account, no network
requirement and no second player — local mode is not an offline cache of the hosted app,
it is a different backend for the same app (a `.vttcamp` file on your disk instead of a
database).

## Running it

1. Unzip this release.
2. Double-click the launcher for your platform (`osr-vtt-local` on macOS/Linux,
   `osr-vtt-local.exe` on Windows). It starts a local web server and opens your browser
   to it — nothing is sent over the network.
3. Keep the launcher's window open while you play. Closing it stops the app.

If your OS warns that the launcher is from an unidentified developer (macOS Gatekeeper)
or an unrecognized app (Windows SmartScreen), that is because it isn't code-signed —
there is no publisher identity behind this project to sign with. Choose "Open anyway" /
"Run anyway" if you trust the release you downloaded.

## Saving your campaign

- **Chrome, Edge, and other Chromium-based browsers** can write directly back to your
  `.vttcamp` file: pick or create it once, and every change autosaves from then on. The
  in-session status pill tells you when a save is in flight.
- **Firefox, Safari, and any other browser** cannot write to a file on disk from a web
  page, so saving is manual: press **Save** in the session and keep the file your browser
  downloads. The lobby and the status pill both say so before you start — if you don't see
  "Unsaved — press Save" anywhere, you're on the autosaving path.

Either way, **the `.vttcamp` file is the entire campaign** and backing it up is your job —
copy it, put it in whatever sync or version-control tool you like. This build has no
knowledge of where you keep it and no opinion on how often you back it up.

## Assets

Tokens, backgrounds, and handouts you add by **uploading a file** are bundled into the
`.vttcamp` archive itself and work with no network at all. Anything you add **by URL**
still needs the internet to load, exactly as it would in a browser tab pointed at that
URL — this build doesn't fetch or cache those images for you.

## Which build is this?

The app shows its version (the git tag this release was built from) in the local lobby.
Quote it in any bug report — it's the only way anyone else can tell which build you're
running.
