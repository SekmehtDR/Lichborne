; Lichborne NSIS pre-install hook — v0.6.4 profile rescue.
;
; Why this exists:
; Pre-v0.6.4 builds wrote profile YAMLs to `<install-dir>\profiles\`. On every
; upgrade, electron-builder's NSIS template runs the PREVIOUS version's
; uninstaller, which `RMDir /r` the install directory — taking the profiles
; with it. v0.6.4 fixed the storage path to `app.getPath('userData')\profiles\`
; (= `%APPDATA%\lichborne\profiles\` on Windows), but the runtime migration in
; src/main/profiles.ts can only help users whose legacy directory still exists
; when the app boots — which it won't if the uninstaller has already wiped it.
;
; This hook plugs that gap. CRITICAL DETAILS:
;
; 1. `preInit` (NOT `customInit`). electron-builder's `customInit` macro is
;    inserted AFTER the previous version's uninstaller runs — by which point
;    `$INSTDIR\profiles\` is already gone. `preInit` runs in `.onInit` BEFORE
;    the uninstaller is invoked, giving us a chance to rescue files first.
;
; 2. `$INSTDIR` is NOT set at preInit time — that happens later, when
;    `findExistingInstallLocation` reads the registry. We do the registry
;    lookup ourselves to find the previous install directory. The install
;    location is stored at `Software\${UNINSTALL_APP_KEY}` (per-user installs)
;    by electron-builder; the empty-name value is the install path string.
;
; 3. Destination is `$APPDATA\lichborne\profiles\` (LOWERCASE). Electron's
;    `app.getName()` returns the package.json `name` field ("lichborne"),
;    not the `build.productName` field. Capitalizing here would create a
;    folder Electron never looks in. (Windows file systems are case-
;    insensitive in practice but the displayed case still matters for
;    explorers / shell.openPath.)
;
; Migration conditions:
;   a) Previous install location read from registry exists AND has YAMLs
;   b) userData destination does NOT already contain YAMLs (idempotent)
; If both hold, copy YAMLs + backups. CreateDirectory is recursive — creates
; `$APPDATA\lichborne\` too if missing. Each CopyFiles is gated by FileExists
; for that pattern since NSIS errors when source pattern matches nothing.

!macro preInit
  ; Read the previous install location from the registry. UNINSTALL_APP_KEY is
  ; defined by electron-builder's installer template; falls through silently
  ; if not present (no previous install).
  Var /GLOBAL LICHBORNE_LEGACY_DIR
  StrCpy $LICHBORNE_LEGACY_DIR ""
  ReadRegStr $LICHBORNE_LEGACY_DIR HKCU "Software\${UNINSTALL_APP_KEY}" ""
  ${If} $LICHBORNE_LEGACY_DIR == ""
    ReadRegStr $LICHBORNE_LEGACY_DIR HKLM "Software\${UNINSTALL_APP_KEY}" ""
  ${EndIf}
  ${If} $LICHBORNE_LEGACY_DIR != ""
    ${If} ${FileExists} "$LICHBORNE_LEGACY_DIR\profiles\*.yaml"
      ; CreateDirectory is recursive — creates `$APPDATA\lichborne\` first if
      ; needed, then `\profiles\`. Safe to call when the destination already
      ; exists (no-op).
      CreateDirectory "$APPDATA\lichborne\profiles"
      ${IfNot} ${FileExists} "$APPDATA\lichborne\profiles\*.yaml"
        DetailPrint "Rescuing legacy profiles from $LICHBORNE_LEGACY_DIR\profiles\ to %APPDATA%\lichborne\profiles\..."
        CopyFiles /SILENT "$LICHBORNE_LEGACY_DIR\profiles\*.yaml" "$APPDATA\lichborne\profiles"
        ${If} ${FileExists} "$LICHBORNE_LEGACY_DIR\profiles\*.bak"
          CopyFiles /SILENT "$LICHBORNE_LEGACY_DIR\profiles\*.bak" "$APPDATA\lichborne\profiles"
        ${EndIf}
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
