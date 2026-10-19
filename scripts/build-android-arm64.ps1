$ErrorActionPreference = "Stop"
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$nativeLibrary = Join-Path $projectRoot "src-tauri\target\aarch64-linux-android\debug\libyeonsik_note_lib.so"
$jniLibrary = Join-Path $projectRoot "src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\libyeonsik_note_lib.so"
$buildLog = Join-Path $projectRoot "src-tauri\target\android-arm64-build.log"

Push-Location $projectRoot
try {
    # The CLI compiles Rust with Tauri's embedded production frontend first.
    # Windows PowerShell 5 treats native stderr as ErrorRecord; decide success
    # from the process exit code, not Tauri's informational stderr output.
    $ErrorActionPreference = "Continue"
    & node node_modules/@tauri-apps/cli/tauri.js android build --debug --target aarch64 --apk --ci *> $buildLog
    $tauriExit = $LASTEXITCODE
    $ErrorActionPreference = "Stop"
    if ($tauriExit -eq 0) {
        Get-Content -LiteralPath $buildLog -Tail 20
        return
    }
    $log = Get-Content -LiteralPath $buildLog -Raw
    $log = [regex]::Replace($log, [char]27 + '\[[0-9;]*m', '')
    if ($log -notmatch "Creation symbolic link is not allowed for this system" -or
        $log -notmatch "Finished .* profile") {
        throw "Android compilation failed. Inspect $buildLog"
    }
    if (-not (Test-Path -LiteralPath $nativeLibrary)) { throw "Compiled native library is missing." }
    # Rust may reuse an unchanged artifact; the successful compile in this run
    # is the freshness proof. Never bypass compilation for a different failure.
    New-Item -ItemType Directory -Path (Split-Path $jniLibrary) -Force | Out-Null
    Copy-Item -LiteralPath $nativeLibrary -Destination $jniLibrary -Force
    if ((Get-FileHash -LiteralPath $nativeLibrary).Hash -ne (Get-FileHash -LiteralPath $jniLibrary).Hash) {
        throw "Native library copy verification failed."
    }
    Push-Location (Join-Path $projectRoot "src-tauri\gen\android")
    try {
        & .\gradlew.bat :app:assembleArm64Debug -x :app:rustBuildArm64Debug --console=plain
        if ($LASTEXITCODE -ne 0) { throw "Android APK packaging failed." }
    } finally { Pop-Location }
    $apk = Join-Path $projectRoot "src-tauri\gen\android\app\build\outputs\apk\arm64\debug\app-arm64-debug.apk"
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive = [System.IO.Compression.ZipFile]::OpenRead($apk)
    try {
        $entry = $archive.GetEntry("lib/arm64-v8a/libyeonsik_note_lib.so")
        if ($null -eq $entry) { throw "APK is missing its native library." }
        $stream = $entry.Open()
        $sha = [System.Security.Cryptography.SHA256]::Create()
        try { $packagedHash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace("-", "") }
        finally { $stream.Dispose(); $sha.Dispose() }
        if ($packagedHash -ne (Get-FileHash -LiteralPath $nativeLibrary).Hash) { throw "APK contains a different native library." }
    } finally { $archive.Dispose() }
    Write-Output "Android ARM64 debug APK: $apk"
} finally { Pop-Location }
