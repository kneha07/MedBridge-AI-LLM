"""Demo sign-in with two roles. On by default with two public demo accounts.

MEDBRIDGE_USERS="alice:reviewer:2468,bob:staff:1357"   (name:role:pin, comma separated; replaces the demo accounts)
MEDBRIDGE_AUTH=off                                      (turn sign-in off, e.g. for local scripts)
MEDBRIDGE_SECRET=<long random string>                   (signs tokens; a random one is made per process if unset)

Accounts are the demo/env accounts above plus people who sign up (stored in the database with a salted scrypt
hash; sign-up always creates "staff", and only a reviewer can promote someone).

Roles: "staff" can submit requests, read them and use the chat; "reviewer" can also approve or reject.
This is a prototype control, not production authentication: PINs are read from the environment, there is no
password hashing, rate limiting or token revocation, and it must not protect real patient data.
"""
import base64
import hashlib
import hmac
import json
import os
import re
import secrets
import time
from dataclasses import dataclass
from datetime import datetime, timezone

from fastapi import Header, HTTPException

import db

ROLES = ("staff", "reviewer")
TOKEN_TTL_SECONDS = 8 * 3600
_FALLBACK_SECRET = secrets.token_hex(32)
DEMO_USERS = "alice:reviewer:2468,bob:staff:1357"  # public demo accounts, shown on the sign-in screen


@dataclass(frozen=True)
class User:
    name: str          # the login: an email for people who signed up, a short name for the demo accounts
    role: str
    display: str = ""  # what the UI shows (the full name); falls back to `name`

    @property
    def label(self) -> str:
        """For the audit trail: the full name plus the login, so two people with the same name stay distinguishable."""
        return f"{self.display} ({self.name})" if self.display and self.display != self.name else self.name


def using_demo_accounts() -> bool:
    return os.environ.get("MEDBRIDGE_USERS") is None and os.environ.get("MEDBRIDGE_AUTH", "").lower() != "off"


def _users() -> dict[str, tuple[str, str]]:
    """name -> (role, pin), parsed from the environment on each call so tests can change it."""
    if os.environ.get("MEDBRIDGE_AUTH", "").lower() == "off":
        return {}
    out = {}
    raw = DEMO_USERS if os.environ.get("MEDBRIDGE_USERS") is None else os.environ["MEDBRIDGE_USERS"]
    for item in filter(None, raw.split(",")):
        name, role, pin = (part.strip() for part in item.split(":", 2))
        if role not in ROLES:
            raise ValueError(f"MEDBRIDGE_USERS: unknown role {role!r} for {name!r} (use one of {ROLES})")
        out[name] = (role, pin)
    return out


FULL_NAME_RE = re.compile(r"^[^\W\d_][\w .'’-]{1,59}$", re.UNICODE)  # starts with a letter, 2 to 60 characters
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
MIN_PASSWORD = 8
MAX_FAILURES, LOCKOUT_SECONDS = 5, 300
_failures: dict[str, tuple[int, float]] = {}  # lower-case name -> (consecutive failures, locked until)


def _hash(password: str, salt: bytes) -> bytes:
    return hashlib.scrypt(password.encode(), salt=salt, n=2**14, r=8, p=1, dklen=32)


def register(full_name: str, email: str, password: str, organization: str = "") -> str:
    """Create a staff account (login = email) and return a signed token. Raises HTTPException with a plain-language reason."""
    full_name, email, organization = full_name.strip(), email.strip().lower(), organization.strip()
    if not FULL_NAME_RE.match(full_name):
        raise HTTPException(400, "Enter your full name (2 to 60 characters, starting with a letter)")
    if len(email) > 120 or not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter a valid email address")
    if len(organization) > 80:
        raise HTTPException(400, "Organization must be 80 characters or fewer")
    if len(password) < MIN_PASSWORD:
        raise HTTPException(400, f"Password must be at least {MIN_PASSWORD} characters")
    salt = secrets.token_bytes(16)
    if not db.create_user(email, "staff", salt, _hash(password, salt), datetime.now(timezone.utc).isoformat(), full_name, organization):
        raise HTTPException(409, "An account with that email already exists. Try signing in.")
    return login(email, password)


def _role_of(name: str) -> str | None:
    env = _users().get(name)
    if env:
        return env[0]
    row = db.get_user(name)
    return row["role"] if row and row["name"] == name else None


def enabled() -> bool:
    return bool(_users())


def _secret() -> bytes:
    return (os.environ.get("MEDBRIDGE_SECRET") or _FALLBACK_SECRET).encode()


def _sign(payload: bytes) -> str:
    return hmac.new(_secret(), payload, hashlib.sha256).hexdigest()


def _issue(name: str, role: str) -> str:
    body = base64.urlsafe_b64encode(json.dumps({"u": name, "r": role, "exp": int(time.time()) + TOKEN_TTL_SECONDS}).encode())
    return f"{body.decode()}.{_sign(body)}"


def login(name: str, secret: str) -> str | None:
    """Return a signed token, or None if the name/password (PIN for the demo accounts) pair is wrong.
    After MAX_FAILURES wrong tries in a row the name is locked for LOCKOUT_SECONDS (even for the right password)."""
    key = name.lower()
    fails, until = _failures.get(key, (0, 0.0))
    if until > time.time():
        raise HTTPException(429, "Too many wrong attempts. Wait a few minutes and try again.")
    env = _users().get(name)
    row = None if env else db.get_user(name)
    if env:
        expected, role = env[1].encode(), env[0]
        ok = hmac.compare_digest(expected, secret.encode())
    elif row:
        role = row["role"]
        ok = hmac.compare_digest(_hash(secret, row["salt"]), row["hash"])
    else:  # unknown name: do comparable work so timing does not reveal which names exist
        _hash(secret, b"\0" * 16)
        role, ok = None, False
    if not ok:
        _failures[key] = (fails + 1, time.time() + LOCKOUT_SECONDS if fails + 1 >= MAX_FAILURES else 0.0)
        return None
    _failures.pop(key, None)
    return _issue(row["name"] if row else name, role)


def verify(token: str) -> User | None:
    try:
        body, sig = token.rsplit(".", 1)
        if not hmac.compare_digest(sig, _sign(body.encode())):
            return None
        data = json.loads(base64.urlsafe_b64decode(body.encode()))
        # The user must still exist with the same role, so removing or demoting someone takes effect at once.
        if data["exp"] < time.time() or _role_of(data["u"]) != data["r"]:
            return None
        row = None if data["u"] in _users() else db.get_user(data["u"])
        return User(data["u"], data["r"], row["display"] if row else data["u"])
    except Exception:
        return None


def current_user(authorization: str | None = Header(default=None)) -> User | None:
    """FastAPI dependency: None when sign-in is off, otherwise the signed-in user or a 401."""
    if not enabled():
        return None
    user = verify(authorization.removeprefix("Bearer ").strip()) if authorization else None
    if user is None:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


def require_reviewer(user: User | None) -> None:
    if user is not None and user.role != "reviewer":
        raise HTTPException(status_code=403, detail="This needs a reviewer account")
