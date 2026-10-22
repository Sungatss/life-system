"""Print a new VAPID key pair for server environment variables. Run once."""

import base64

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import Encoding, PublicFormat


def encode(data):
    return base64.urlsafe_b64encode(data).decode().rstrip('=')


key = ec.generate_private_key(ec.SECP256R1())
private = key.private_numbers().private_value.to_bytes(32, 'big')
public = key.public_key().public_bytes(
    encoding=Encoding.X962,
    format=PublicFormat.UncompressedPoint,
)
print('VAPID_PRIVATE_KEY=' + encode(private))
print('VAPID_PUBLIC_KEY=' + encode(public))
print('VAPID_SUBJECT=https://github.com/Sungatss/life-system')
