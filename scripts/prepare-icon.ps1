$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Drawing
$project=Split-Path -Parent $PSScriptRoot
$source=[Drawing.Bitmap]::FromFile((Join-Path $project 'public\kfc-logo.png'))
$mark=$source.Clone([Drawing.Rectangle]::new(190,185,710,710),[Drawing.Imaging.PixelFormat]::Format32bppArgb)
for($y=0;$y -lt $mark.Height;$y++){for($x=0;$x -lt $mark.Width;$x++){
  $color=$mark.GetPixel($x,$y)
  $alpha=255-[Math]::Min(255,[int](($color.R+$color.G+$color.B)/3))
  $mark.SetPixel($x,$y,[Drawing.Color]::FromArgb($alpha,255,255,255))
}}
$images=@()
foreach($size in @(16,24,32,48,64,128,256)){
  $bitmap=[Drawing.Bitmap]::new($size,$size,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g=[Drawing.Graphics]::FromImage($bitmap)
  $g.Clear([Drawing.Color]::FromArgb(255,24,35,58))
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $padding=[int]($size*.07)
  $g.DrawImage($mark,[Drawing.Rectangle]::new($padding,$padding,$size-2*$padding,$size-2*$padding))
  $stream=[IO.MemoryStream]::new()
  $bitmap.Save($stream,[Drawing.Imaging.ImageFormat]::Png)
  $images+=,@{Size=$size;Bytes=$stream.ToArray()}
  $stream.Dispose();$g.Dispose();$bitmap.Dispose()
}
$file=[IO.File]::Create((Join-Path $project 'electron\kfc-icon.ico'))
$writer=[IO.BinaryWriter]::new($file)
$writer.Write([UInt16]0);$writer.Write([UInt16]1);$writer.Write([UInt16]$images.Count)
$offset=6+16*$images.Count
foreach($item in $images){
 $dimension=if($item.Size -eq 256){0}else{$item.Size}
 $writer.Write([Byte]$dimension);$writer.Write([Byte]$dimension);$writer.Write([Byte]0);$writer.Write([Byte]0)
 $writer.Write([UInt16]1);$writer.Write([UInt16]32);$writer.Write([UInt32]$item.Bytes.Length);$writer.Write([UInt32]$offset)
 $offset+=$item.Bytes.Length
}
foreach($item in $images){$writer.Write([Byte[]]$item.Bytes)}
$writer.Dispose();$file.Dispose();$mark.Dispose();$source.Dispose()
