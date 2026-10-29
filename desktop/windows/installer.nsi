; Per-user installer: no administrator rights (UAC) required.
; Built by build.sh with: makensis -DVERSION=x.y.z -DVI_VERSION=x.y.z.0 -DPAYLOAD=<dir> -DOUTFILE=<file> installer.nsi

Unicode true
SetCompressor /SOLID lzma

!include "MUI2.nsh"
!include "LogicLib.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"

!ifndef VERSION | VI_VERSION | PAYLOAD | OUTFILE
  !error "VERSION, VI_VERSION, PAYLOAD e OUTFILE são obrigatórios (use build.sh)"
!endif

!define APP_NAME "DBClient"
!define APP_EXE "DBClient.exe"
!define SERVER_EXE "dbclient-server.exe"
!define UNINSTALL_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_NAME}"
!define WEBVIEW2_GUID "{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}"
!define WEBVIEW2_DOWNLOAD "https://go.microsoft.com/fwlink/p/?LinkId=2124703"

Name "${APP_NAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "${UNINSTALL_KEY}" "InstallLocation"
RequestExecutionLevel user
ManifestDPIAware true
BrandingText "${APP_NAME} ${VERSION}"

!define MUI_ICON "${PAYLOAD}\DBClient.ico"
!define MUI_UNICON "${PAYLOAD}\DBClient.ico"
!define MUI_ABORTWARNING
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Abrir o ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "PortugueseBR"

VIProductVersion "${VI_VERSION}"
VIAddVersionKey /LANG=${LANG_PORTUGUESEBR} "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=${LANG_PORTUGUESEBR} "ProductVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_PORTUGUESEBR} "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=${LANG_PORTUGUESEBR} "FileDescription" "Instalador do ${APP_NAME}"
VIAddVersionKey /LANG=${LANG_PORTUGUESEBR} "LegalCopyright" "© Leonardo Barbosa"

; Closing the shell also kills the server, which runs inside the shell's kill-on-close Job Object.
!macro CloseRunningApp
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM ${APP_EXE}'
  Pop $0
  nsExec::Exec '"$SYSDIR\taskkill.exe" /F /IM ${SERVER_EXE}'
  Pop $0
  Sleep 500
!macroend

Function .onInit
  ${IfNot} ${RunningX64}
    MessageBox MB_ICONSTOP "O ${APP_NAME} requer o Windows 64 bits."
    Abort
  ${EndIf}
FunctionEnd

Function WarnIfWebView2Missing
  ReadRegStr $0 HKLM "SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    ReadRegStr $0 HKCU "Software\Microsoft\EdgeUpdate\Clients\${WEBVIEW2_GUID}" "pv"
  ${EndIf}
  ${If} $0 == ""
  ${OrIf} $0 == "0.0.0.0"
    MessageBox MB_YESNO|MB_ICONEXCLAMATION "O ${APP_NAME} precisa do Microsoft Edge WebView2 Runtime, que não foi encontrado.$\r$\n$\r$\nDeseja abrir a página de download?" /SD IDNO IDNO +2
    ExecShell "open" "${WEBVIEW2_DOWNLOAD}"
  ${EndIf}
FunctionEnd

Section "Install"
  !insertmacro CloseRunningApp

  SetOutPath "$INSTDIR"
  File "${PAYLOAD}\${APP_EXE}"
  File "${PAYLOAD}\${SERVER_EXE}"
  File "${PAYLOAD}\DBClient.ico"
  RMDir /r "$INSTDIR\postgres"
  File /r "${PAYLOAD}\postgres"
  WriteUninstaller "$INSTDIR\Uninstall.exe"

  CreateShortCut "$SMPROGRAMS\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\DBClient.ico"
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\DBClient.ico"

  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "Publisher" "Leonardo Barbosa"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "DisplayIcon" "$INSTDIR\DBClient.ico"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINSTALL_KEY}" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "${UNINSTALL_KEY}" "QuietUninstallString" '"$INSTDIR\Uninstall.exe" /S'
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "EstimatedSize" "$0"
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINSTALL_KEY}" "NoRepair" 1

  Call WarnIfWebView2Missing

  ; In-app updates run the installer silently with /RELAUNCH, so the app reopens on the new version.
  ${GetParameters} $0
  ClearErrors
  ${GetOptions} $0 "/RELAUNCH" $1
  ${IfNot} ${Errors}
    Exec '"$INSTDIR\${APP_EXE}"'
  ${EndIf}
SectionEnd

Section "Uninstall"
  !insertmacro CloseRunningApp

  Delete "$INSTDIR\${APP_EXE}"
  Delete "$INSTDIR\${SERVER_EXE}"
  Delete "$INSTDIR\DBClient.ico"
  RMDir /r "$INSTDIR\postgres"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"

  Delete "$SMPROGRAMS\${APP_NAME}.lnk"
  Delete "$DESKTOP\${APP_NAME}.lnk"
  DeleteRegKey HKCU "${UNINSTALL_KEY}"

  ; User data (SQLite, encryption key, logs) is kept unless the user explicitly asks to remove it.
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "Remover também os dados do ${APP_NAME} (conexões, histórico e chave de criptografia)?$\r$\n$\r$\nEssa ação não pode ser desfeita." /SD IDNO IDNO +2
  RMDir /r "$LOCALAPPDATA\${APP_NAME}"
SectionEnd
