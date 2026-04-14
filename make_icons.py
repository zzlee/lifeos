import struct
import zlib
import os

def make_png(width, height, color=(0, 0, 0, 255)):
    signature = b'\x89PNG\r\n\x1a\n'
    def chunk(type, data):
        return struct.pack('>I', len(data)) + type + data + struct.pack('>I', zlib.crc32(type + data) & 0xffffffff)
    IHDR = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0))
    raw_data = b''
    row = b'\x00' + bytes(color) * width
    for _ in range(height):
        raw_data += row
    IDAT = chunk(b'IDAT', zlib.compress(raw_data))
    IEND = chunk(b'IEND', b'')
    return signature + IHDR + IDAT + IEND

os.makedirs('public', exist_ok=True)
with open('public/icon-192.png', 'wb') as f:
    f.write(make_png(192, 192, (33, 150, 243, 255)))
with open('public/icon-512.png', 'wb') as f:
    f.write(make_png(512, 512, (33, 150, 243, 255)))
