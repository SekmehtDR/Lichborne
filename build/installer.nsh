; Lichborne NSIS pre-install hook — v0.6.4 profile rescue.
;
; Why this exists:
; Pre-v0.6.4 builds wrote profile YAMLs to `<install-dir>\profiles\`. On every
; upgrade, electron-builder's NSIS template runs the PREVIOUS version's
; uninstaller before extracting the new build, which `RMDir /r` the install
; directory — taking the profiles with it. Users reported losing all character
; profiles on the 0.6.2 → 0.6.3 upgrade.
;
; v0.6.4 fixed the storage path to `%APPDATA%\Lichborne\profiles\` (userData),
; but the runtime migration in src/main/profiles.ts can only help users whose
; legacy directory still exists when the app boots — which it won't if the
; NSIS uninstaller has already wiped it.
;
; This hook plugs that gap: `customInit` runs in `.onInit` BEFORE the previous
; version's uninstaller is invoked. We copy `$INSTDIR\profiles\*.yaml` (and
; `*.bak`) into `$APPDATA\Lichborne\profiles\` first. The runtime side will
; then find them in the new location on first boot.
;
; Conditions for migration:
;   1. Legacy directory exists AND contains at least one .yaml
;   2. userData destination does NOT already contain .yaml files
;      (so we never clobber profiles created by a fresh v0.6.4+ install)
;
; If both hold, copy YAMLs + backups. Otherwise no-op. Safe to run on every
; install — re-runs are harmless once the new location has content.

!macro customInit
  ${If} ${FileExists} "$INSTDIR\profiles\*.yaml"
    ; CreateDirectory is recursive — creates `$APPDATA\Lichborne\` first if
    ; needed, then `\profiles\`. Safe to call when the destination already
    ; exists (no-op). NSIS does not require the parent dir to exist.
    CreateDirectory "$APPDATA\Lichborne\profiles"
    ${IfNot} ${FileExists} "$APPDATA\Lichborne\profiles\*.yaml"
      DetailPrint "Rescuing legacy profiles into %APPDATA%\Lichborne\profiles..."
      CopyFiles /SILENT "$INSTDIR\profiles\*.yaml" "$APPDATA\Lichborne\profiles"
      ; Guard the .bak pattern separately — CopyFiles errors when the source
      ; pattern matches nothing. .yaml is the gating condition above, but a
      ; legacy install might have YAMLs without any backups yet.
      ${If} ${FileExists} "$INSTDIR\profiles\*.bak"
        CopyFiles /SILENT "$INSTDIR\profiles\*.bak" "$APPDATA\Lichborne\profiles"
      ${EndIf}
    ${EndIf}
  ${EndIf}
!macroend
