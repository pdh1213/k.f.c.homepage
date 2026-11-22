$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Push-Location -LiteralPath $root
try {
    $compiler = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'
    New-Item -ItemType Directory -Force -Path 'outputs' | Out-Null
    $common = @('/nologo', '/target:winexe', '/platform:x64', '/codepage:65001',
        '/optimize+', '/win32manifest:desktop\kfc.manifest', '/win32icon:desktop\kfc.ico')
    & $compiler @common '/out:outputs\KfcChat.exe' '/r:System.Net.Http.dll' '/r:System.Web.Extensions.dll' 'desktop\ChatApi.cs' 'desktop\Program.cs'
    if ($LASTEXITCODE -ne 0) { throw 'K.F.C. Chat compilation failed.' }
    & $compiler @common '/out:outputs\KFC-Chat-Setup.exe' '/r:Microsoft.CSharp.dll' '/resource:outputs\KfcChat.exe,KfcChat.exe' 'desktop\Installer.cs'
    if ($LASTEXITCODE -ne 0) { throw 'Setup compilation failed.' }
    Copy-Item -LiteralPath 'outputs\KFC-Chat-Setup.exe' -Destination 'public/KFC-Chat-Setup.exe' -Force
    Get-FileHash -Algorithm SHA256 -LiteralPath 'public/KFC-Chat-Setup.exe'
}
finally { Pop-Location }
