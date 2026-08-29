# Native production release

The existing `Native Release` workflow remains useful for unsigned device
testing. Production distribution uses the manual `Native Production Release`
workflow, which builds a release-signed Android APK/AAB and a release-signed
iOS IPA. It can optionally upload the IPA to TestFlight.

## Required GitHub configuration

Create a protected GitHub environment named `production`. Put the following
values in that environment's secrets; never commit them or place them in the
web `.env.local` file:

- Android: `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
- Apple signing: `IOS_CERTIFICATE_BASE64` (distribution `.p12`),
  `IOS_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`,
  `IOS_KEYCHAIN_PASSWORD`, and `APPLE_TEAM_ID`.
- Optional export override: `IOS_EXPORT_OPTIONS_PLIST_BASE64`.
- Optional TestFlight upload: `APP_STORE_CONNECT_KEY_ID`,
  `APP_STORE_CONNECT_ISSUER_ID`, and
  `APP_STORE_CONNECT_PRIVATE_KEY_BASE64`.

The same protected environment must also provide `E2E_USERNAME` and
`E2E_PASSWORD` for the authenticated Playwright regression suite. Add a
repository/environment variable named `TRACK_WEB_ORIGIN` containing the
production Pages origin (for example, `https://trackz.pages.dev`). The
production workflow requires that origin and verifies the live HTML, immutable
asset headers, and Brotli delivery before native artifacts can be published.

The environment should require review and restrict who can run the workflow.
The Android keystore alias, provisioning profile, bundle ID
(`com.track.lifting`), and signing certificate must belong to the same
production identities used in Google Play Console and App Store Connect.

## Run it

1. Bump `package.json` and add matching `release-notes/vX.Y.Z.md`.
2. Run the full local validation and review the diff before tagging. Local
   validation can skip authenticated browser coverage and live header checks;
   the production workflow cannot.
3. Push the commit and tag `vX.Y.Z`.
4. Open Actions → Native Production Release, enter the exact tag, and choose
   whether to upload to TestFlight.
5. Test the signed APK on a physical Android device and the IPA through
   TestFlight before wider distribution.

The workflow never logs secret values and only writes decoded keys into the
ephemeral runner filesystem. The runner is discarded after the job.

## Device acceptance matrix

At minimum, test one current Android phone, one smaller Android phone, one
recent iPhone, and one iPad-sized viewport. Verify sign-in, offline queue and
reconnect, notifications while the app is backgrounded, rest completion,
version/update prompts, safe-area layout, long workout scrolling, and the
notification center. A successful build is not a substitute for these device
checks.
