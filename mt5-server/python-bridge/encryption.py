"""
Encryption - Handles credential encryption/decryption for MT5 connections.
"""

import json
import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def generate_key() -> str:
    """Generate a new Fernet encryption key."""
    return Fernet.generate_key().decode()


def derive_key(password: str, salt: bytes | None = None) -> tuple[bytes, bytes]:
    """Derive a Fernet key from a password using PBKDF2."""
    if salt is None:
        salt = os.urandom(16)
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
    return key, salt


def encrypt_credentials(server: str, login: int, password: str, key: str) -> str:
    """Encrypt MT5 credentials into a single encrypted string."""
    f = Fernet(key.encode() if isinstance(key, str) else key)
    payload = json.dumps({
        "server": server,
        "login": login,
        "password": password,
    })
    return f.encrypt(payload.encode()).decode()


def decrypt_credentials(encrypted: str, key: str) -> dict:
    """Decrypt credentials back to a dictionary."""
    f = Fernet(key.encode() if isinstance(key, str) else key)
    decrypted = f.decrypt(encrypted.encode())
    return json.loads(decrypted)


def encrypt_token(data: dict, key: str) -> str:
    """Encrypt arbitrary data as a token."""
    f = Fernet(key.encode() if isinstance(key, str) else key)
    return f.encrypt(json.dumps(data).encode()).decode()


def decrypt_token(token: str, key: str) -> dict:
    """Decrypt a token back to data."""
    f = Fernet(key.encode() if isinstance(key, str) else key)
    return json.loads(f.decrypt(token.encode()))
