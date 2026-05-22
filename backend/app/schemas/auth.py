from pydantic import BaseModel, ConfigDict, EmailStr, Field


class SignupRequest(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    # 로그인은 기존 계정 호환을 위해 길이 제한을 강제하지 않습니다.
    # 비밀번호 정책은 회원가입/변경 시점에서 검증합니다.
    password: str = Field(min_length=1, max_length=128)


class AuthPayload(BaseModel):
    user_id: int
    username: str
    token: str
    tier: str
    role: str = "user"
    is_admin: bool = False


class AuthResponse(BaseModel):
    success: bool
    message: str
    data: AuthPayload


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: EmailStr
    tier: str
    role: str = "user"
    is_admin: bool = False
    coins: int
    injury_type: str | None = None
    skill_level: str
    profile_image: str | None = None


class UserProfileResponse(BaseModel):
    success: bool
    message: str
    data: UserRead


class UserUpdateRequest(BaseModel):
    username: str | None = Field(default=None, min_length=3, max_length=50)
    injury_type: str | None = Field(default=None, max_length=100)
    skill_level: str | None = Field(default=None, pattern="^(beginner|intermediate|advanced)$")
    profile_image: str | None = Field(default=None, max_length=255)
