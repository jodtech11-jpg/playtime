# Create first Git commit without git CLI (writes objects manually)
$ErrorActionPreference = "Stop"
$repoRoot = "c:\Users\murug\Documents\Playtime\Playtime"
$gitDir = Join-Path $repoRoot ".git"
$objectsDir = Join-Path $gitDir "objects"

function Get-SHA1($bytes) {
    $sha = [System.Security.Cryptography.SHA1]::Create()
    $hash = $sha.ComputeHash($bytes)
    $sha.Dispose()
    return [BitConverter]::ToString($hash).Replace("-","").ToLower()
}

function Compress-Zlib($bytes) {
    # Adler32 of input
    $a = 1; $b = 0
    foreach ($byte in $bytes) { $a = ($a + $byte) % 65521; $b = ($b + $a) % 65521 }
    $adler = ($b -shl 16) -bor $a
    $deflated = [System.IO.MemoryStream]::new()
    $deflate = [System.IO.Compression.DeflateStream]::new($deflated, [System.IO.Compression.CompressionMode]::Compress)
    $deflate.Write($bytes, 0, $bytes.Length)
    $deflate.Close()
    $deflatedBytes = $deflated.ToArray()
    $out = [System.IO.MemoryStream]::new()
    $out.WriteByte(0x78); $out.WriteByte(0x9C)
    $out.Write($deflatedBytes, 0, $deflatedBytes.Length)
    $out.WriteByte([byte](($adler -shr 24) -band 0xFF))
    $out.WriteByte([byte](($adler -shr 16) -band 0xFF))
    $out.WriteByte([byte](($adler -shr 8) -band 0xFF))
    $out.WriteByte([byte]($adler -band 0xFF))
    return $out.ToArray()
}

function New-GitBlob($content) {
    $enc = [System.Text.Encoding]::UTF8
    $raw = $enc.GetBytes($content)
    $header = $enc.GetBytes("blob " + $raw.Length + "`0")
    $full = New-Object byte[] ($header.Length + $raw.Length)
    [Array]::Copy($header, 0, $full, 0, $header.Length)
    [Array]::Copy($raw, 0, $full, $header.Length, $raw.Length)
    $sha = Get-SHA1 $full
    $compressed = Compress-Zlib $full
    $objDir = Join-Path $objectsDir $sha.Substring(0,2)
    $objPath = Join-Path $objDir $sha.Substring(2)
    if (-not (Test-Path $objDir)) { New-Item -ItemType Directory -Path $objDir -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($objPath, $compressed)
    return $sha
}

function New-GitTree($entries) {
    $list = [System.Collections.ArrayList]::new()
    foreach ($e in $entries) {
        $modeName = [System.Text.Encoding]::UTF8.GetBytes($e.mode + " " + $e.name + "`0")
        $hashBytes = New-Object byte[] 20
        $hex = $e.sha
        for ($i = 0; $i -lt 20; $i++) { $hashBytes[$i] = [Convert]::ToByte($hex.Substring($i*2,2), 16) }
        $entry = New-Object byte[] ($modeName.Length + 20)
        [Array]::Copy($modeName, 0, $entry, 0, $modeName.Length)
        [Array]::Copy($hashBytes, 0, $entry, $modeName.Length, 20)
        [void]$list.Add($entry)
    }
    $totalLen = ($list | ForEach-Object { $_.Length } | Measure-Object -Sum).Sum
    $merged = New-Object byte[] $totalLen
    $off = 0
    foreach ($b in $list) { [Array]::Copy($b, 0, $merged, $off, $b.Length); $off += $b.Length }
    $header = [System.Text.Encoding]::UTF8.GetBytes("tree " + $merged.Length + "`0")
    $full = New-Object byte[] ($header.Length + $merged.Length)
    [Array]::Copy($header, 0, $full, 0, $header.Length)
    [Array]::Copy($merged, 0, $full, $header.Length, $merged.Length)
    $sha = Get-SHA1 $full
    $compressed = Compress-Zlib $full
    $objDir = Join-Path $objectsDir $sha.Substring(0,2)
    $objPath = Join-Path $objDir $sha.Substring(2)
    if (-not (Test-Path $objDir)) { New-Item -ItemType Directory -Path $objDir -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($objPath, $compressed)
    return $sha
}

function New-GitCommit($treeSha, $message) {
    $name = "Cursor User"
    $email = "cursor@local"
    $ts = [int][double]::Parse((Get-Date -UFormat %s))
    $tz = "+0000"
    $body = "tree $treeSha`nauthor $name <$email> $ts $tz`ncommitter $name <$email> $ts $tz`n`n$message`n"
    $raw = [System.Text.Encoding]::UTF8.GetBytes($body)
    $header = [System.Text.Encoding]::UTF8.GetBytes("commit " + $raw.Length + "`0")
    $full = New-Object byte[] ($header.Length + $raw.Length)
    [Array]::Copy($header, 0, $full, 0, $header.Length)
    [Array]::Copy($raw, 0, $full, $header.Length, $raw.Length)
    $sha = Get-SHA1 $full
    $compressed = Compress-Zlib $full
    $objDir = Join-Path $objectsDir $sha.Substring(0,2)
    $objPath = Join-Path $objDir $sha.Substring(2)
    if (-not (Test-Path $objDir)) { New-Item -ItemType Directory -Path $objDir -Force | Out-Null }
    [System.IO.File]::WriteAllBytes($objPath, $compressed)
    return $sha
}

Set-Location $repoRoot
$files = @(
    @{ name = ".gitignore"; path = ".gitignore" },
    @{ name = "README.md"; path = "README.md" },
    @{ name = "connect-github.ps1"; path = "connect-github.ps1" },
    @{ name = "make-first-commit.ps1"; path = "make-first-commit.ps1" }
)
$blobs = @()
foreach ($f in $files) {
    $content = [System.IO.File]::ReadAllText((Join-Path $repoRoot $f.path), [System.Text.Encoding]::UTF8)
    $sha = New-GitBlob $content
    $blobs += @{ mode = "100644"; name = $f.name; sha = $sha }
}
$blobs = $blobs | Sort-Object { $_.name }
$treeSha = New-GitTree $blobs
$commitSha = New-GitCommit $treeSha "Initial commit"
$headPath = Join-Path $gitDir "refs\heads\main"
$headDir = Split-Path $headPath
if (-not (Test-Path $headDir)) { New-Item -ItemType Directory -Path $headDir -Force | Out-Null }
Set-Content -Path $headPath -Value $commitSha -NoNewline
Write-Host "First commit created: $commitSha" -ForegroundColor Green
Write-Host "Branch main now points to this commit."
