# iPhone IPA builds from Windows

The `Build Track device IPA` workflow creates an `iphoneos` IPA in GitHub Actions. It is separate from `build-ios.yml`, which builds an iOS Simulator app.

## Download the IPA

1. Open the repository's **Actions** tab.
2. Select **Build Track device IPA** and open a successful run.
3. At the bottom of the run summary, download **Track-ios-device-ipa**.
4. Extract `Track.ipa` from the downloaded artifact.

The workflow intentionally does not store Apple signing certificates or passwords. The artifact is unsigned and must be signed for the target iPhone by Sideloadly, AltStore, Xcode, or an Apple Developer signing workflow before iOS will install it.

## Free personal testing

Sideloadly or AltStore can sign the IPA with a personal Apple account for testing. Apple personal-team builds need to be refreshed periodically; they are not App Store releases.

## Longer-lived distribution

For Ad Hoc or TestFlight distribution, use an Apple Developer team, a registered device/provisioning profile, and signing secrets stored in GitHub Actions Secrets. Never commit certificates, private keys, provisioning profiles, or Apple passwords to this repository.
