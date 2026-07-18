@echo off
setlocal

set "REPO_ROOT=%~dp0.."
pushd "%REPO_ROOT%" >nul

set "NPM_CONFIG_CACHE=%CD%\.local\npm-cache"
set "NPM_CONFIG_LOGS_DIR=%CD%\.local\npm-logs"
set "NPM_CONFIG_UPDATE_NOTIFIER=false"
set "NPM_CONFIG_FUND=false"
set "NPM_CONFIG_AUDIT=false"

npm %*
set "EXIT_CODE=%ERRORLEVEL%"

popd >nul
exit /b %EXIT_CODE%
