!macro customCheckAppRunning
  DetailPrint "Closing running ${PRODUCT_NAME}..."
  nsExec::ExecToLog `$SYSDIR\taskkill.exe /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Sleep 800
  nsExec::ExecToLog `$SYSDIR\taskkill.exe /F /IM "${APP_EXECUTABLE_FILENAME}" /T`
  Sleep 1200
!macroend
