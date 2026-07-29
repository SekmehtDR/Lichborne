// electron-builder afterPack hook — macOS AD-HOC CODE SIGNING.
//
// WHY THIS EXISTS (ohbeanz, our first Mac tester, v0.18.0): the downloaded app
// refused to launch with
//
//     "Lichborne" is damaged and can't be opened. You should move it to the Trash.
//
// That is NOT the "unidentified developer" prompt every doc here promised, and
// it has NO "Open Anyway" button — it is what macOS says about a MISSING or
// BROKEN signature. Apple Silicon requires every executable to carry one; the
// kernel refuses an unsigned arm64 binary outright. Because we ship without an
// Apple Developer certificate (deliberate free-project decision, DESIGN §41),
// CI sets CSC_IDENTITY_AUTO_DISCOVERY=false and electron-builder skips signing
// altogether — which is exactly the state that produces this message.
//
// An AD-HOC signature ("-") is the most a project without a certificate can do,
// and it is what the kernel wants: it makes the binary loadable. It does NOT
// notarize anything, so a DOWNLOADED copy still carries com.apple.quarantine
// and Gatekeeper will still challenge it — the point is only that the challenge
// should now be the recoverable "cannot be verified → Open Anyway" one rather
// than the dead-end "damaged" one.
//
// UNVERIFIED: nobody here has a Mac, and CI can build but cannot exercise
// Gatekeeper's dialog, so whether this alone gets a downloaded build to the
// "Open Anyway" path is not proven — it needs a tester to confirm. What IS
// certain is that an unsigned arm64 app cannot run at all, so this is strictly
// necessary either way. See BUGS.md B238.
//
// WHEN A REAL CERTIFICATE LANDS: delete this hook. A Developer ID signature +
// notarization replaces it, and re-signing ad-hoc over a real signature would
// destroy it.

const { execFileSync } = require('child_process')
const path = require('path')

exports.default = async function afterPack(context) {
  // Log on EVERY platform, not just darwin. electron-builder calls afterPack for
  // Windows and Linux too, so this line is the proof that the hook RESOLVED and
  // ran at all — which is the failure mode that matters here: if the path in
  // package.json ever breaks, the Mac build goes quietly back to shipping an
  // unsigned app with no error anywhere. Absence of this line in a build log
  // means the hook did not run.
  console.log(`  • afterPack hook: platform=${context.electronPlatformName}`)
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  )

  // --force so this is idempotent: if electron-builder (or a future real
  // identity) already signed, we simply replace/refresh rather than fail.
  // --deep is discouraged by Apple for DISTRIBUTION signing, but it is the
  // pragmatic choice for ad-hoc: it covers the Electron Framework and the
  // helper apps, none of which we notarize.
  try {
    execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
      stdio: 'inherit',
    })
    console.log(`  • ad-hoc signed (no certificate)  ${appPath}`)
  } catch (err) {
    // FAIL THE BUILD. A silently-unsigned arm64 artifact is worse than no
    // artifact: it uploads cleanly, passes the release verify job's filename
    // check, and only fails in a tester's hands with a message that tells them
    // to throw it away.
    console.error('  ✗ ad-hoc codesign FAILED — refusing to ship an unsigned arm64 app')
    throw err
  }
}
