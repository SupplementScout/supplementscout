param(
  [Parameter(Mandatory = $true)][string]$InputPath,
  [Parameter(Mandatory = $true)][string]$TextOutputPath,
  [Parameter(Mandatory = $true)][string]$MetadataOutputPath
)

$ErrorActionPreference = "Stop"

function Assert-PathInsideTmp([string]$Value, [bool]$MustExist) {
  $repositoryRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
  $tmpRoot = [System.IO.Path]::GetFullPath((Join-Path $repositoryRoot "tmp"))
  $fullPath = [System.IO.Path]::GetFullPath($Value)
  $prefix = $tmpRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $fullPath.StartsWith($prefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "OCR path must remain inside repository tmp"
  }
  if ($MustExist -and -not [System.IO.File]::Exists($fullPath)) {
    throw "OCR input file does not exist"
  }
  if (-not $MustExist) {
    if ([System.IO.File]::Exists($fullPath)) { throw "OCR output already exists" }
    $parent = [System.IO.Path]::GetDirectoryName($fullPath)
    if (-not [System.IO.Directory]::Exists($parent)) { throw "OCR output directory does not exist" }
  }
  return $fullPath
}

function Await-WinRt($Operation, [Type]$ResultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq "AsTask" -and $_.IsGenericMethod -and
    $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1"
  } | Select-Object -First 1
  if (-not $method) { throw "Windows Runtime AsTask adapter is unavailable" }
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.GetAwaiter().GetResult()
}

$inputFile = Assert-PathInsideTmp $InputPath $true
$textFile = Assert-PathInsideTmp $TextOutputPath $false
$metadataFile = Assert-PathInsideTmp $MetadataOutputPath $false

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType = WindowsRuntime]
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]

$storageFile = Await-WinRt ([Windows.Storage.StorageFile]::GetFileFromPathAsync($inputFile)) ([Windows.Storage.StorageFile])
$stream = Await-WinRt ($storageFile.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
$decoder = Await-WinRt ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Await-WinRt ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])

$language = [Windows.Globalization.Language]::new("en-GB")
$engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage($language)
if (-not $engine) { throw "Windows Media OCR en-GB engine is unavailable" }
$result = Await-WinRt ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])

$lineRows = @()
foreach ($line in $result.Lines) {
  $wordRows = @()
  foreach ($word in $line.Words) {
    $rect = $word.BoundingRect
    $wordRows += [ordered]@{
      text = $word.Text
      x = [double]$rect.X
      y = [double]$rect.Y
      width = [double]$rect.Width
      height = [double]$rect.Height
    }
  }
  $lineRows += [ordered]@{ text = $line.Text; words = $wordRows }
}

$metadata = [ordered]@{
  schema_version = 1
  engine = "Windows.Media.Ocr"
  engine_version = "Windows-$([System.Environment]::OSVersion.Version)"
  language = "en-GB"
  image_width = [int]$bitmap.PixelWidth
  image_height = [int]$bitmap.PixelHeight
  line_count = $lineRows.Count
  confidence_available = $false
  lines = $lineRows
}

$utf8 = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllText($textFile, (($lineRows | ForEach-Object { $_.text }) -join [System.Environment]::NewLine), $utf8)
[System.IO.File]::WriteAllText($metadataFile, ($metadata | ConvertTo-Json -Depth 8), $utf8)

if ($bitmap -and $bitmap.PSObject.Methods.Name -contains "Close") { $bitmap.Close() }
if ($stream -and $stream.PSObject.Methods.Name -contains "Dispose") { $stream.Dispose() }
