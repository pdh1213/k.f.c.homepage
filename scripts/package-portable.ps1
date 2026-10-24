$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptRoot
$source = Join-Path $projectRoot 'release\win-unpacked'
$destination = Join-Path $projectRoot 'outputs\KFC-Club-Windows.zip'
$executable = Get-ChildItem -LiteralPath $source -Filter '*.exe' -File -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $executable) { throw 'Missing release\win-unpacked app build. Run npm run build:win first.' }
New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null
if (Test-Path -LiteralPath $destination) { Remove-Item -LiteralPath $destination -Force }
Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -CompressionLevel Fastest
Write-Output "Created portable Windows app: $destination"
