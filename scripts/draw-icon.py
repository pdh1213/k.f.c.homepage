"""Generate the K.F.C. Chat speech-bubble icon as PNG and Windows ICO."""
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parent.parent


def icon(size):
    pixels = bytearray()
    for y in range(size):
        for x in range(size):
            samples = [
                sample((x + (dx + 0.5) / 4) * 64 / size, (y + (dy + 0.5) / 4) * 64 / size)
                for dy in range(4) for dx in range(4)
            ]
            visible = [color for color in samples if color is not None]
            if visible:
                pixels.extend(sum(color[i] for color in visible) // len(visible) for i in range(3))
                pixels.append(len(visible) * 255 // len(samples))
            else:
                pixels.extend(bytes(4))
    return pixels


def rounded_rect(x, y, left, top, right, bottom, radius):
    px = max(left + radius, min(x, right - radius))
    py = max(top + radius, min(y, bottom - radius))
    return (x - px) ** 2 + (y - py) ** 2 <= radius ** 2


def sample(x, y):
    if not rounded_rect(x, y, 1, 1, 63, 63, 14):
        return None
    body = rounded_rect(x, y, 13, 15, 51, 44, 9)
    tail = 20 <= x <= 30 and 41 <= y <= 50 and y <= 50 - (x - 20)
    if body or tail:
        if any((x - cx) ** 2 + (y - 29) ** 2 <= 2.4 ** 2 for cx in (23, 32, 41)):
            return (56, 37, 29)
        return (251, 227, 211)
    return (169, 87, 61)


def chunk(name, data):
    return struct.pack(">I", len(data)) + name + data + struct.pack(">I", zlib.crc32(name + data))


def png(size, rgba):
    rows = b"".join(b"\0" + rgba[i:i + size * 4] for i in range(0, len(rgba), size * 4))
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(rows))
        + chunk(b"IEND", b"")
    )


def bitmap(size, rgba):
    data = bytearray()
    mask = bytearray()
    scan = ((size + 31) // 32) * 4
    for y in range(size - 1, -1, -1):
        row = bytearray(scan)
        for x in range(size):
            i = (y * size + x) * 4
            red, green, blue, alpha = rgba[i:i + 4]
            data.extend((blue, green, red, alpha))
            if alpha == 0:
                row[x // 8] |= 128 >> (x % 8)
        mask.extend(row)
    header = struct.pack("<IiiHHIIiiII", 40, size, size * 2, 1, 32, 0, len(data), 0, 0, 0, 0)
    return header + data + mask


def main():
    (ROOT / "public" / "icon.png").write_bytes(png(256, icon(256)))
    sizes = [16, 32, 48, 64]
    directory = bytearray(struct.pack("<HHH", 0, 1, len(sizes)))
    images = bytearray()
    for size in sizes:
        image = bitmap(size, icon(size))
        offset = 6 + 16 * len(sizes) + len(images)
        directory.extend(struct.pack("<BBBBHHII", size, size, 0, 0, 1, 32, len(image), offset))
        images.extend(image)
    (ROOT / "desktop" / "kfc.ico").write_bytes(directory + images)


if __name__ == "__main__":
    main()
