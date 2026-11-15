$ErrorActionPreference = 'Stop'
$msi = Get-ChildItem 'src-tauri/target/release/bundle/msi/*.msi' | Select-Object -First 1
if (!$msi) { throw 'MSI artifact is missing' }
$logs = Join-Path $env:RUNNER_TEMP 'breedlog-installer-acceptance'
New-Item -ItemType Directory -Force $logs | Out-Null

function Invoke-Msi([string]$operation, [string]$extra, [string]$logName) {
  $arguments = "$operation `"$($msi.FullName)`" /qn /norestart $extra /L*v `"$(Join-Path $logs $logName)`""
  $process = Start-Process msiexec.exe -ArgumentList $arguments -Wait -PassThru
  if ($process.ExitCode -notin @(0, 3010)) { throw "MSI $operation failed: $($process.ExitCode)" }
}

$installed = $false
try {
  Invoke-Msi '/i' '' 'install.log'
  $installed = $true
  $roots = @("$env:ProgramFiles\BreedLog", "$env:LOCALAPPDATA\BreedLog")
  # Cargo's package/binary name is breedlog-desktop; productName is the folder.
  $exe = Get-ChildItem $roots -Filter 'breedlog-desktop.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if (!$exe) { throw 'Installed BreedLog executable was not found' }
  $signature = Get-AuthenticodeSignature $exe.FullName
  Write-Host "Installed executable Authenticode status: $($signature.Status)"
  # A process/window check on the Windows runner, not authenticated UI/device acceptance.
  $app = Start-Process $exe.FullName -PassThru
  Start-Sleep -Seconds 8
  $app.Refresh()
  if ($app.HasExited) { throw "Installed app exited early: $($app.ExitCode)" }
  Write-Host "Installed application started; process $($app.Id)"
  Stop-Process -Id $app.Id -Force
  Invoke-Msi '/i' 'REINSTALL=ALL REINSTALLMODE=vomus' 'reinstall.log'
  if (!(Test-Path $exe.FullName)) { throw 'Reinstall removed the application' }
  Write-Host 'MSI install, application process launch and same-version reinstall passed. Older-version upgrade and trusted signing are separate gates.'
} catch {
  # Keep the actionable reason available through the Checks API when a runner
  # log/archive download is unavailable to the build environment.
  Write-Host "::error::$($_.Exception.Message)"
  throw
} finally {
  if ($installed) { Invoke-Msi '/x' '' 'uninstall.log' }
}
