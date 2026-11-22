!include nsDialogs.nsh
!include LogicLib.nsh

!define KFC_RUN_PATH "Software\Microsoft\Windows\CurrentVersion\Run"
!define KFC_RUN_NAME "kr.kfcrobot.chat"

!ifndef BUILD_UNINSTALLER
Var KfcStartupChoice
Var KfcStartupCheckbox
Var KfcStartupPageSeen

!macro customPageAfterChangeDir
Page custom KfcStartupPage KfcStartupLeave

Function KfcStartupPage
  ${If} ${isUpdated}
  ${OrIf} $installMode != "CurrentUser"
    Abort
  ${EndIf}
  !insertmacro MUI_HEADER_TEXT "백그라운드 알림" "Windows에 로그인할 때 알림을 받을지 선택해 주세요."
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}
  ${NSD_CreateLabel} 0 5u 100% 30u "K.F.C. Chat은 창을 닫아도 시스템 트레이에서 새 메시지 알림을 받을 수 있습니다. Windows 로그인 직후부터 받으려면 아래 옵션을 켜 주세요."
  Pop $0
  ${NSD_CreateCheckbox} 0 41u 100% 13u "Windows에 로그인하면 K.F.C. Chat을 백그라운드에서 시작"
  Pop $KfcStartupCheckbox
  ${If} $KfcStartupPageSeen != "1"
    ReadRegStr $0 HKCU "${KFC_RUN_PATH}" "${KFC_RUN_NAME}"
    StrCpy $KfcStartupChoice ${BST_UNCHECKED}
    ${If} $0 != ""
      StrCpy $KfcStartupChoice ${BST_CHECKED}
    ${EndIf}
  ${EndIf}
  ${NSD_SetState} $KfcStartupCheckbox $KfcStartupChoice
  ${NSD_CreateLabel} 0 62u 100% 16u "앱 설정에서 이 옵션을 언제든 변경할 수 있습니다."
  Pop $0
  nsDialogs::Show
FunctionEnd

Function KfcStartupLeave
  ${NSD_GetState} $KfcStartupCheckbox $KfcStartupChoice
  StrCpy $KfcStartupPageSeen "1"
FunctionEnd
!macroend
!endif

!macro customInstall
  ${If} $KfcStartupPageSeen == "1"
  ${AndIf} $installMode == "CurrentUser"
    ${If} $KfcStartupChoice == ${BST_CHECKED}
      WriteRegStr HKCU "${KFC_RUN_PATH}" "${KFC_RUN_NAME}" '$\"$INSTDIR\${APP_EXECUTABLE_FILENAME}$\" --startup'
    ${Else}
      DeleteRegValue HKCU "${KFC_RUN_PATH}" "${KFC_RUN_NAME}"
    ${EndIf}
  ${EndIf}
!macroend

!macro customUnInstall
  ${IfNot} ${isUpdated}
    DeleteRegValue HKCU "${KFC_RUN_PATH}" "${KFC_RUN_NAME}"
  ${EndIf}
!macroend
