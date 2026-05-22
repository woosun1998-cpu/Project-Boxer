from passlib.context import CryptContext


pwd_context = CryptContext(
    schemes=["pbkdf2_sha256", "bcrypt"],
    deprecated="auto",
)


class PasswordValidationError(ValueError):
    """Raised when a password is invalid for password hashing."""


def validate_password_bytes(password: str) -> None:
    byte_length = len(password.encode("utf-8"))
    if byte_length > 1024:
        raise PasswordValidationError(
            "Password is too long for secure hashing. Please use 1024 UTF-8 bytes or fewer."
        )


def hash_password(password: str) -> str:
    validate_password_bytes(password)
    try:
        return pwd_context.hash(password)
    except ValueError as exc:
        message = str(exc)
        if "72 bytes" in message or "1024 UTF-8 bytes" in message:
            raise PasswordValidationError(
                "Password is too long for secure hashing. Please use 1024 UTF-8 bytes or fewer."
            ) from exc
        raise


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        validate_password_bytes(plain_password)
        return pwd_context.verify(plain_password, hashed_password)
    except (PasswordValidationError, ValueError):
        return False
