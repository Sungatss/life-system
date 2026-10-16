"""Generate server-side login settings without putting the password in shell history."""

import getpass
import secrets
from app.auth import make_password_hash

password = getpass.getpass("Choose a Lock In password (12+ characters): ")
confirm = getpass.getpass("Repeat password: ")
if password != confirm:
    raise SystemExit("Passwords did not match")
try:
    password_hash = make_password_hash(password)
except ValueError as error:
    raise SystemExit(str(error)) from error
print("Copy these two lines into the project .env file (never commit it):")
print(f"LOCK_IN_PASSWORD_HASH='{password_hash}'")
print(f"LOCK_IN_SESSION_SECRET='{secrets.token_urlsafe(48)}'")
