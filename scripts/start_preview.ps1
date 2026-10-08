# Local preview via ASCII junction (CJK path breaks file:// and some shells)
$ErrorActionPreference = 'Stop'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$Link = 'C:\TOS-local'
$Port = 8765
$Url = "http://127.0.0.1:$Port/prototype/index.html"

function Test-PortOpen([int]$P) {
  try {
    $c = New-Object System.Net.Sockets.TcpClient
    $iar = $c.BeginConnect('127.0.0.1', $P, $null, $null)
    $ok = $iar.AsyncWaitHandle.WaitOne(400)
    if ($ok -and $c.Connected) { $c.EndConnect($iar); $c.Close(); return $true }
    $c.Close()
  } catch {}
  return $false
}

function Ensure-Junction {
  if (Test-Path -LiteralPath $Link) {
    $item = Get-Item -LiteralPath $Link -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) {
      return
    }
    throw "C:\TOS-local exists but is not a junction. Remove it and retry."
  }
  $null = cmd /c "mklink /J `"$Link`" `"$Root`""
  if (-not (Test-Path -LiteralPath (Join-Path $Link 'prototype\index.html'))) {
    throw "Failed to create junction $Link -> $Root"
  }
}

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  Write-Host '[ERROR] python not found in PATH' -ForegroundColor Red
  if ($Host.Name -eq 'ConsoleHost') { pause }
  exit 1
}

Ensure-Junction

if (-not (Test-PortOpen $Port)) {
  Write-Host "[INFO] start http.server on $Port from $Link"
  Start-Process -FilePath 'python' `
    -ArgumentList @('-m', 'http.server', "$Port", '--bind', '127.0.0.1') `
    -WorkingDirectory $Link `
    -WindowStyle Minimized
  $ready = $false
  for ($i = 0; $i -lt 24; $i++) {
    Start-Sleep -Milliseconds 250
    if (Test-PortOpen $Port) { $ready = $true; break }
  }
  if (-not $ready) {
    Write-Host '[ERROR] server failed to start on port 8765' -ForegroundColor Red
    if ($Host.Name -eq 'ConsoleHost') { pause }
    exit 1
  }
} else {
  Write-Host "[INFO] server already running on $Port"
}

Write-Host "[INFO] open $Url"
Start-Process $Url
exit 0
