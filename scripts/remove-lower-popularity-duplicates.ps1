param(
  [string]$CsvPath = "songs.csv",
  [string]$ReportPath = "duplicate-removal-report.csv",
  [string]$TitleField = "title",
  [string]$ArtistField = "artist",
  [string]$PopularityField = "popularity_score"
)

$ErrorActionPreference = "Stop"

function Normalize-DuplicateValue {
  param([AllowNull()][string]$Value)

  $text = if ($null -eq $Value) { "" } else { [string]$Value }
  $text = $text.ToLowerInvariant().Normalize([Text.NormalizationForm]::FormD)
  $text = [Text.RegularExpressions.Regex]::Replace($text, "\p{Mn}", "")
  $text = [Text.RegularExpressions.Regex]::Replace($text, "[^a-z0-9&]+", " ")
  $text = [Text.RegularExpressions.Regex]::Replace($text, "\s+", " ")
  return $text.Trim()
}

function Get-PopularityValue {
  param([AllowNull()][string]$Value)

  $raw = if ($null -eq $Value) { "" } else { [string]$Value }
  $clean = $raw.Replace(",", "").Trim()
  $score = 0.0

  if ([double]::TryParse($clean, [Globalization.NumberStyles]::Float, [Globalization.CultureInfo]::InvariantCulture, [ref]$score)) {
    return $score
  }

  return 0
}

if (-not (Test-Path -LiteralPath $CsvPath)) {
  throw "CSV file not found: $CsvPath"
}

$rows = @(Import-Csv -LiteralPath $CsvPath)
if ($rows.Count -eq 0) {
  throw "CSV has no data rows: $CsvPath"
}

$fieldNames = @($rows[0].PSObject.Properties.Name)
$missingFields = @($TitleField, $ArtistField, $PopularityField) | Where-Object { $fieldNames -notcontains $_ }
if ($missingFields.Count -gt 0) {
  throw "CSV is missing required columns: $($missingFields -join ', ')"
}

$bestByKey = @{}
$removed = New-Object System.Collections.Generic.List[object]

for ($index = 0; $index -lt $rows.Count; $index++) {
  $row = $rows[$index]
  $titleKey = Normalize-DuplicateValue $row.$TitleField
  $artistKey = Normalize-DuplicateValue $row.$ArtistField

  if ([string]::IsNullOrWhiteSpace($titleKey) -or [string]::IsNullOrWhiteSpace($artistKey)) {
    continue
  }

  $key = "$titleKey::$artistKey"
  $score = Get-PopularityValue $row.$PopularityField

  if (-not $bestByKey.ContainsKey($key)) {
    $bestByKey[$key] = [PSCustomObject]@{
      Index = $index
      Score = $score
      Row = $row
    }
    continue
  }

  $current = $bestByKey[$key]
  if ($score -gt $current.Score) {
    $removed.Add([PSCustomObject]@{
      Row = $current.Row
      RemovedReason = "lower popularity duplicate"
      DuplicateKey = $key
      KeptPopularity = $score
    })
    $bestByKey[$key] = [PSCustomObject]@{
      Index = $index
      Score = $score
      Row = $row
    }
    continue
  }

  $removedReason = if ($score -eq $current.Score) { "tied popularity duplicate" } else { "lower popularity duplicate" }
  $removed.Add([PSCustomObject]@{
    Row = $row
    RemovedReason = $removedReason
    DuplicateKey = $key
    KeptPopularity = $current.Score
  })
}

$keptIndexes = New-Object 'System.Collections.Generic.HashSet[int]'
foreach ($entry in $bestByKey.Values) {
  [void]$keptIndexes.Add([int]$entry.Index)
}

$deduped = New-Object System.Collections.Generic.List[object]
for ($index = 0; $index -lt $rows.Count; $index++) {
  $row = $rows[$index]
  $titleKey = Normalize-DuplicateValue $row.$TitleField
  $artistKey = Normalize-DuplicateValue $row.$ArtistField
  $hasKey = -not [string]::IsNullOrWhiteSpace($titleKey) -and -not [string]::IsNullOrWhiteSpace($artistKey)

  if ((-not $hasKey) -or $keptIndexes.Contains($index)) {
    $deduped.Add($row)
  }
}

$deduped | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8

$reportRows = foreach ($item in $removed) {
  $properties = [ordered]@{}
  foreach ($fieldName in $fieldNames) {
    $properties[$fieldName] = $item.Row.$fieldName
  }
  $properties["removed_reason"] = $item.RemovedReason
  $properties["duplicate_key"] = $item.DuplicateKey
  $properties["kept_popularity"] = $item.KeptPopularity
  [PSCustomObject]$properties
}

$reportRows | Export-Csv -LiteralPath $ReportPath -NoTypeInformation -Encoding UTF8

Write-Host "Read $($rows.Count) rows"
Write-Host "Removed $($removed.Count) duplicate rows"
Write-Host "Wrote $($deduped.Count) rows to $CsvPath"
Write-Host "Wrote removal report to $ReportPath"
