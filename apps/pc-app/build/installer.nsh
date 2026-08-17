!macro customInit
  !insertmacro preserveQiuAIWorkOSDataBeforeUpgrade
!macroend

!macro customCheckAppRunning
  DetailPrint "Closing running ${PRODUCT_NAME}..."
  nsExec::ExecToLog `$SYSDIR\taskkill.exe /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Sleep 800
  nsExec::ExecToLog `$SYSDIR\taskkill.exe /F /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Sleep 1200
!macroend

!macro preserveQiuAIWorkOSDataBeforeUpgrade
  IfFileExists "$INSTDIR\data\*.*" 0 qiuaiWorkOSDataPreserveDone
    DetailPrint "Preserving QiuAI WorkOS user data before upgrade..."
    CreateDirectory "$APPDATA\QiuAI WorkOS"
    RMDir /r "$APPDATA\QiuAI WorkOS\install-data-backup"
    nsExec::ExecToLog `"$SYSDIR\xcopy.exe" "$INSTDIR\data" "$APPDATA\QiuAI WorkOS\install-data-backup" /E /I /Y /Q /H /K`
  qiuaiWorkOSDataPreserveDone:
!macroend
