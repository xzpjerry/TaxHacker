# FastAPI + Vue Foundation and Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish the FastAPI + Vue monorepo skeleton, turn on backend/frontend coverage gates above 95% from the start, and deliver the first end-to-end email/password auth slice with generated API contract types and protected frontend routing.

**Architecture:** Keep the existing Next.js app untouched during this phase and add `backend/` and `frontend/` as the new runtime. The backend exposes `/api/v1` from a FastAPI app factory backed by SQLite and SQLAlchemy, while the frontend is a Vite/Vue app that consumes backend OpenAPI types through `openapi-fetch`. Authentication uses cookie-backed sessions stored in SQLite so later feature plans can reuse the same identity boundary.

**Tech Stack:** FastAPI, Pydantic v2, SQLAlchemy 2.0, Alembic, SQLite, pytest, Vue 3, Vite, Vue Router, Pinia, TanStack Query for Vue, Vitest, openapi-typescript, openapi-fetch

---

## File Structure

### Backend

- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/router.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/health.py`
- Create: `backend/app/api/routes/auth.py`
- Create: `backend/app/core/__init__.py`
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/models/__init__.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/session.py`
- Create: `backend/app/repositories/__init__.py`
- Create: `backend/app/repositories/users.py`
- Create: `backend/app/repositories/sessions.py`
- Create: `backend/app/schemas/__init__.py`
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/services/__init__.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/backend.sqlite3`
- Create: `backend/scripts/write_openapi.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_health.py`
- Create: `backend/tests/auth/test_service.py`
- Create: `backend/tests/auth/test_routes.py`

### Frontend

- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/App.test.ts`
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/router/index.test.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/views/LoginView.vue`
- Create: `frontend/src/views/LoginView.test.ts`
- Create: `frontend/src/views/DashboardView.vue`
- Create: `frontend/src/features/auth/api.ts`
- Create: `frontend/src/features/auth/api.test.ts`
- Create: `frontend/src/features/auth/store.ts`
- Create: `frontend/src/features/auth/store.test.ts`
- Create: `frontend/src/generated/api-types.ts`

### Existing Files

- Modify: `.gitignore`

---

### Task 1: Scaffold The Backend Skeleton

**Files:**
- Modify: `.gitignore`
- Create: `backend/pyproject.toml`
- Create: `backend/app/__init__.py`
- Create: `backend/app/main.py`
- Create: `backend/app/api/__init__.py`
- Create: `backend/app/api/router.py`
- Create: `backend/app/api/routes/__init__.py`
- Create: `backend/app/api/routes/health.py`
- Create: `backend/tests/test_health.py`

- [ ] **Step 1: Add ignore rules for the new toolchains**

```gitignore
/backend/.venv
/backend/.pytest_cache
/backend/.ruff_cache
/backend/.mypy_cache
/frontend/node_modules
/frontend/coverage
/frontend/dist
```

- [ ] **Step 2: Add backend package metadata and the first failing test**

```toml
[project]
name = "taxhacker-backend"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115,<1",
  "uvicorn>=0.30,<1",
  "sqlalchemy>=2.0,<3",
  "alembic>=1.13,<2",
  "pydantic-settings>=2.4,<3",
]

[project.optional-dependencies]
dev = [
  "httpx>=0.27,<0.28",
  "pytest>=8,<9",
  "pytest-cov>=5,<6",
]

[tool.pytest.ini_options]
addopts = "--cov=app --cov-report=term-missing --cov-fail-under=95"
testpaths = ["tests"]
```

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_health_route_returns_ok() -> None:
    client = TestClient(create_app())

    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
```

- [ ] **Step 3: Run the backend smoke test to verify it fails**

Run: `cd backend && python3 -m venv .venv && .venv/bin/pip install -e ".[dev]" && .venv/bin/pytest tests/test_health.py -q`
Expected: FAIL with `ModuleNotFoundError` or `ImportError` because `app.main` does not exist yet.

- [ ] **Step 4: Implement the minimal FastAPI app factory and health route**

```python
from fastapi import FastAPI

from app.api.router import api_router


def create_app() -> FastAPI:
    app = FastAPI(title="TaxHacker API", version="0.1.0")
    app.include_router(api_router, prefix="/api/v1")
    return app


app = create_app()
```

```python
from fastapi import APIRouter

from app.api.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
```

```python
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
def healthcheck() -> dict[str, str]:
    return {"status": "ok"}
```

- [ ] **Step 5: Run the backend smoke test to verify it passes**

Run: `cd backend && .venv/bin/pytest tests/test_health.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .gitignore backend/pyproject.toml backend/app backend/tests/test_health.py
git commit -m "feat: scaffold FastAPI backend skeleton"
```

### Task 2: Add Database And Auth Service Primitives

**Files:**
- Create: `backend/app/core/config.py`
- Create: `backend/app/core/database.py`
- Create: `backend/app/core/security.py`
- Create: `backend/app/models/base.py`
- Create: `backend/app/models/user.py`
- Create: `backend/app/models/session.py`
- Create: `backend/app/repositories/users.py`
- Create: `backend/app/repositories/sessions.py`
- Create: `backend/app/services/auth.py`
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/auth/test_service.py`

- [ ] **Step 1: Write the failing auth service tests**

```python
from app.services.auth import AuthService


def test_register_user_hashes_password_and_creates_session(db_session) -> None:
    service = AuthService(db_session)

    auth_result = service.register(
        email="owner@example.com",
        password="secret123",
        display_name="Owner",
    )

    assert auth_result.user.email == "owner@example.com"
    assert auth_result.user.password_hash != "secret123"
    assert len(auth_result.session_token) > 20


def test_authenticate_rejects_wrong_password(db_session) -> None:
    service = AuthService(db_session)
    service.register(
        email="owner@example.com",
        password="secret123",
        display_name="Owner",
    )

    auth_result = service.authenticate(
        email="owner@example.com",
        password="wrong-password",
    )

    assert auth_result is None
```

```python
from collections.abc import Iterator
from pathlib import Path
import tempfile

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.models.base import Base


@pytest.fixture
def db_session() -> Iterator[Session]:
    with tempfile.TemporaryDirectory() as tmpdir:
        database_path = Path(tmpdir) / "test.sqlite3"
        engine = create_engine(
            f"sqlite:///{database_path}",
            connect_args={"check_same_thread": False},
        )
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(engine)
        session = TestingSessionLocal()
        try:
            yield session
        finally:
            session.close()
```

- [ ] **Step 2: Run the auth service tests to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/auth/test_service.py -q`
Expected: FAIL because the database models, security helpers, and auth service do not exist yet.

- [ ] **Step 3: Implement the database, model, repository, and security primitives**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="TAXHACKER_", env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./backend.sqlite3"
    session_cookie_name: str = "taxhacker_session"
    session_ttl_seconds: int = 60 * 60 * 24 * 7
```

```python
from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings

settings = Settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

```python
from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
```

```python
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    email: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    display_name: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
```

```python
from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class SessionRecord(Base):
    __tablename__ = "sessions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
```

```python
from hashlib import sha256
from secrets import token_urlsafe

from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def new_session_token() -> str:
    return token_urlsafe(32)


def hash_session_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()
```

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def create(self, *, email: str, password_hash: str, display_name: str) -> User:
        user = User(email=email, password_hash=password_hash, display_name=display_name)
        self.db.add(user)
        self.db.flush()
        return user
```

```python
from datetime import datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.session import SessionRecord


class SessionRepository:
    def __init__(self, db: Session) -> None:
        self.db = db

    def create(self, *, user_id: str, token_hash: str, ttl_seconds: int) -> SessionRecord:
        record = SessionRecord(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=datetime.utcnow() + timedelta(seconds=ttl_seconds),
        )
        self.db.add(record)
        self.db.flush()
        return record

    def get_by_token_hash(self, token_hash: str) -> SessionRecord | None:
        return self.db.scalar(select(SessionRecord).where(SessionRecord.token_hash == token_hash))

    def delete_by_token_hash(self, token_hash: str) -> None:
        self.db.execute(delete(SessionRecord).where(SessionRecord.token_hash == token_hash))
```

```python
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import hash_password, hash_session_token, new_session_token, verify_password
from app.models.user import User
from app.repositories.sessions import SessionRepository
from app.repositories.users import UserRepository


@dataclass
class AuthResult:
    user: User
    session_token: str


class AuthService:
    def __init__(self, db: Session, settings: Settings | None = None) -> None:
        self.db = db
        self.settings = settings or Settings()
        self.users = UserRepository(db)
        self.sessions = SessionRepository(db)

    def register(self, *, email: str, password: str, display_name: str) -> AuthResult:
        user = self.users.create(
            email=email,
            password_hash=hash_password(password),
            display_name=display_name,
        )
        session_token = new_session_token()
        self.sessions.create(
            user_id=user.id,
            token_hash=hash_session_token(session_token),
            ttl_seconds=self.settings.session_ttl_seconds,
        )
        self.db.commit()
        self.db.refresh(user)
        return AuthResult(user=user, session_token=session_token)

    def authenticate(self, *, email: str, password: str) -> AuthResult | None:
        user = self.users.get_by_email(email)
        if user is None or not verify_password(password, user.password_hash):
            return None
        session_token = new_session_token()
        self.sessions.create(
            user_id=user.id,
            token_hash=hash_session_token(session_token),
            ttl_seconds=self.settings.session_ttl_seconds,
        )
        self.db.commit()
        return AuthResult(user=user, session_token=session_token)
```

- [ ] **Step 4: Run the auth service tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/auth/test_service.py -q`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/core backend/app/models backend/app/repositories backend/app/services backend/tests/conftest.py backend/tests/auth/test_service.py
git commit -m "feat: add backend auth service primitives"
```

### Task 3: Add Backend Auth Routes

**Files:**
- Create: `backend/app/schemas/auth.py`
- Create: `backend/app/api/routes/auth.py`
- Modify: `backend/app/api/router.py`
- Modify: `backend/app/main.py`
- Create: `backend/tests/auth/test_routes.py`

- [ ] **Step 1: Write the failing route tests**

```python
from fastapi.testclient import TestClient

from app.main import create_app


def test_register_sets_session_cookie(client: TestClient) -> None:
    response = client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "secret123",
            "displayName": "Owner",
        },
    )

    assert response.status_code == 201
    assert response.cookies.get("taxhacker_session") is not None
    assert response.json()["email"] == "owner@example.com"


def test_login_and_logout_round_trip(client: TestClient) -> None:
    client.post(
        "/api/v1/auth/register",
        json={
            "email": "owner@example.com",
            "password": "secret123",
            "displayName": "Owner",
        },
    )

    login = client.post(
        "/api/v1/auth/login",
        json={"email": "owner@example.com", "password": "secret123"},
    )
    assert login.status_code == 200

    me = client.get("/api/v1/auth/me")
    assert me.status_code == 200
    assert me.json()["email"] == "owner@example.com"

    logout = client.post("/api/v1/auth/logout")
    assert logout.status_code == 204
```

```python
from collections.abc import Iterator
from pathlib import Path
import tempfile

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.database import get_db
from app.main import create_app
from app.models.base import Base


@pytest.fixture
def client() -> Iterator[TestClient]:
    with tempfile.TemporaryDirectory() as tmpdir:
        engine = create_engine(
            f"sqlite:///{Path(tmpdir) / 'routes.sqlite3'}",
            connect_args={"check_same_thread": False},
        )
        TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
        Base.metadata.create_all(engine)

        app = create_app()

        def override_db() -> Iterator[Session]:
            db = TestingSessionLocal()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_db

        with TestClient(app) as test_client:
            yield test_client
```

- [ ] **Step 2: Run the route tests to verify they fail**

Run: `cd backend && .venv/bin/pytest tests/auth/test_routes.py -q`
Expected: FAIL with `404 Not Found` because the auth routes are not registered yet.

- [ ] **Step 3: Implement auth schemas and cookie-backed routes**

```python
from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    display_name: str = Field(alias="displayName", min_length=1)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)


class UserResponse(BaseModel):
    id: str
    email: EmailStr
    display_name: str = Field(alias="displayName")

    @classmethod
    def from_model(cls, user) -> "UserResponse":
        return cls.model_validate(
            {
                "id": user.id,
                "email": user.email,
                "displayName": user.display_name,
            }
        )
```

```python
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_db
from app.core.security import hash_session_token
from app.repositories.sessions import SessionRepository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> UserResponse:
    auth = AuthService(db)
    result = auth.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    settings = Settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=result.session_token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
    )
    return UserResponse.from_model(result.user)


@router.post("/login", response_model=UserResponse)
def login(payload: LoginRequest, response: Response, db: Session = Depends(get_db)) -> UserResponse:
    auth = AuthService(db)
    result = auth.authenticate(email=payload.email, password=payload.password)
    if result is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    settings = Settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=result.session_token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
    )
    return UserResponse.from_model(result.user)


```

```python
from fastapi import APIRouter

from app.api.routes.auth import router as auth_router
from app.api.routes.health import router as health_router

api_router = APIRouter()
api_router.include_router(health_router, tags=["health"])
api_router.include_router(auth_router, tags=["auth"])
```

- [ ] **Step 4: Finish the `me` and `logout` route behavior before rerunning**

```python
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.database import get_db
from app.core.security import hash_session_token
from app.repositories.sessions import SessionRepository
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest, RegisterRequest, UserResponse
from app.services.auth import AuthService

router = APIRouter(prefix="/auth")


def _require_user(request: Request, db: Session) -> UserResponse:
    settings = Settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    session_record = SessionRepository(db).get_by_token_hash(hash_session_token(raw_token))
    if session_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = db.get(UserRepository(db).model, session_record.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return UserResponse.from_model(user)


@router.get("/me", response_model=UserResponse)
def me(request: Request, db: Session = Depends(get_db)) -> UserResponse:
    return _require_user(request, db)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)) -> Response:
    settings = Settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token:
        SessionRepository(db).delete_by_token_hash(hash_session_token(raw_token))
        db.commit()
    response.delete_cookie(settings.session_cookie_name)
    return response
```

```python
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    model = User

    def __init__(self, db: Session) -> None:
        self.db = db

    def get_by_email(self, email: str) -> User | None:
        return self.db.scalar(select(User).where(User.email == email))

    def get_by_id(self, user_id: str) -> User | None:
        return self.db.get(User, user_id)
```

```python
def _require_user(request: Request, db: Session) -> UserResponse:
    settings = Settings()
    raw_token = request.cookies.get(settings.session_cookie_name)
    if raw_token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    session_record = SessionRepository(db).get_by_token_hash(hash_session_token(raw_token))
    if session_record is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    user = UserRepository(db).get_by_id(session_record.user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    return UserResponse.from_model(user)
```

- [ ] **Step 5: Run the route tests to verify they pass**

Run: `cd backend && .venv/bin/pytest tests/auth/test_routes.py -q`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/api/routes/auth.py backend/app/api/router.py backend/app/schemas/auth.py backend/app/repositories/users.py backend/tests/auth/test_routes.py
git commit -m "feat: add backend auth routes"
```

### Task 4: Scaffold The Vue Frontend And Router Guard

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/tsconfig.json`
- Create: `frontend/tsconfig.node.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/index.html`
- Create: `frontend/src/main.ts`
- Create: `frontend/src/App.vue`
- Create: `frontend/src/App.test.ts`
- Create: `frontend/src/router/index.ts`
- Create: `frontend/src/router/index.test.ts`
- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/views/LoginView.vue`
- Create: `frontend/src/views/LoginView.test.ts`
- Create: `frontend/src/views/DashboardView.vue`

- [ ] **Step 1: Add the frontend package and a failing router guard test**

```json
{
  "name": "taxhacker-frontend",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/vue-query": "^5.59.0",
    "pinia": "^2.3.0",
    "vue": "^3.5.13",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/vue": "^8.1.0",
    "@types/node": "^22.10.0",
    "@vitejs/plugin-vue": "^5.2.1",
    "@vitest/coverage-v8": "^2.1.5",
    "jsdom": "^26.0.0",
    "typescript": "^5.7.2",
    "vite": "^6.0.1",
    "vitest": "^2.1.5"
  }
}
```

```ts
import { describe, expect, it } from "vitest"

import { buildRouter } from "./index"

describe("router", () => {
  it("redirects guests away from dashboard", async () => {
    const router = buildRouter(() => false, true)

    await router.push("/dashboard")
    await router.isReady()

    expect(router.currentRoute.value.fullPath).toBe("/login")
  })
})
```

```ts
import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      thresholds: {
        lines: 95,
        functions: 95,
        statements: 95,
        branches: 90
      }
    }
  }
})
```

- [ ] **Step 2: Install the frontend dependencies and verify the router test fails**

Run: `cd frontend && npm install && npm test -- --run src/router/index.test.ts`
Expected: FAIL because the router factory has not been implemented yet.

- [ ] **Step 3: Implement the minimal Vue bootstrap, views, and route guard**

```ts
import { createApp } from "vue"

import App from "./App.vue"
import { router } from "./router"

createApp(App).use(router).mount("#app")
```

```vue
<template>
  <router-view />
</template>
```

```ts
import { createPinia } from "pinia"
import { createMemoryHistory, createRouter, createWebHistory } from "vue-router"

import DashboardView from "../views/DashboardView.vue"
import LoginView from "../views/LoginView.vue"

export const pinia = createPinia()

const routes = [
  { path: "/login", component: LoginView },
  { path: "/dashboard", component: DashboardView, meta: { requiresAuth: true } },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
]

export function buildRouter(isAuthenticated: () => boolean, memory = false) {
  const router = createRouter({
    history: memory ? createMemoryHistory() : createWebHistory(),
    routes,
  })

  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !isAuthenticated()) {
      return "/login"
    }
    if (to.path === "/login" && isAuthenticated()) {
      return "/dashboard"
    }
    return true
  })

  return router
}

export const router = buildRouter(() => false)
```

```vue
<template>
  <main>
    <h1>Login</h1>
  </main>
</template>
```

```vue
<template>
  <main>
    <h1>Dashboard</h1>
  </main>
</template>
```

- [ ] **Step 4: Run the router guard test to verify it passes**

Run: `cd frontend && npm test -- --run src/router/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/tsconfig.json frontend/tsconfig.node.json frontend/vite.config.ts frontend/index.html frontend/src
git commit -m "feat: scaffold Vue frontend shell"
```

### Task 5: Generate The Contract Client And Finish The Frontend Auth Slice

**Files:**
- Create: `backend/scripts/write_openapi.py`
- Modify: `frontend/package.json`
- Create: `frontend/src/generated/api-types.ts`
- Create: `frontend/src/features/auth/api.ts`
- Create: `frontend/src/features/auth/api.test.ts`
- Create: `frontend/src/features/auth/store.ts`
- Create: `frontend/src/features/auth/store.test.ts`
- Modify: `frontend/src/router/index.ts`
- Modify: `frontend/src/views/LoginView.vue`
- Modify: `frontend/src/App.vue`
- Modify: `frontend/src/App.test.ts`
- Modify: `frontend/src/views/LoginView.test.ts`
- Modify: `frontend/src/main.ts`

- [ ] **Step 1: Write the failing auth API, store, and login view tests**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"

vi.mock("./api", () => ({
  authApi: {
    login: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    }),
    me: vi.fn().mockResolvedValue({
      id: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}))

import { authApi } from "./api"
import { useAuthStore } from "./store"

describe("auth store", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("stores the current user after login", async () => {
    const store = useAuthStore()

    await store.login({
      email: "owner@example.com",
      password: "secret123",
    })

    expect(store.currentUser?.email).toBe("owner@example.com")
    expect(store.isAuthenticated).toBe(true)
  })
})
```

```ts
import { describe, expect, it, vi } from "vitest"

const post = vi.fn()
const get = vi.fn()

vi.mock("openapi-fetch", () => ({
  default: () => ({
    POST: post,
    GET: get,
  }),
}))

import { authApi } from "./api"

describe("auth api", () => {
  it("returns the typed user payload from login", async () => {
    post.mockResolvedValue({
      data: { id: "user-1", email: "owner@example.com", displayName: "Owner" },
      error: undefined,
    })

    const result = await authApi.login({
      email: "owner@example.com",
      password: "secret123",
    })

    expect(result.email).toBe("owner@example.com")
  })
})
```

```ts
import { fireEvent, render, screen } from "@testing-library/vue"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { createPinia, setActivePinia } from "pinia"
import { createMemoryHistory, createRouter } from "vue-router"

import LoginView from "../../views/LoginView.vue"
import { useAuthStore } from "./store"

describe("login view", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("submits credentials and navigates to the dashboard", async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/login", component: LoginView },
        { path: "/dashboard", component: { template: "<h1>Dashboard</h1>" } },
      ],
    })
    await router.push("/login")
    await router.isReady()

    const store = useAuthStore()
    const loginSpy = vi.spyOn(store, "login").mockResolvedValue()

    render(LoginView, {
      global: {
        plugins: [pinia, router],
      },
    })

    await fireEvent.update(screen.getByLabelText("Email"), "owner@example.com")
    await fireEvent.update(screen.getByLabelText("Password"), "secret123")
    await fireEvent.click(screen.getByRole("button", { name: "Sign in" }))

    expect(loginSpy).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "secret123",
    })
    expect(router.currentRoute.value.fullPath).toBe("/dashboard")
  })
})
```

- [ ] **Step 2: Add the OpenAPI export script and frontend generation command**

```python
import json
from pathlib import Path

from app.main import create_app


output_path = Path(__file__).resolve().parents[2] / "frontend" / "openapi.json"
output_path.write_text(json.dumps(create_app().openapi(), indent=2), encoding="utf-8")
```

```json
{
  "scripts": {
    "generate:client": "../backend/.venv/bin/python ../backend/scripts/write_openapi.py && openapi-typescript ./openapi.json -o ./src/generated/api-types.ts"
  },
  "dependencies": {
    "openapi-fetch": "^0.10.6"
  },
  "devDependencies": {
    "openapi-typescript": "^7.5.0"
  }
}
```

- [ ] **Step 3: Implement the typed auth API wrapper and Pinia store**

```ts
import createClient from "openapi-fetch"

import type { paths } from "../../generated/api-types"

const client = createClient<paths>({
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:8000/api/v1",
  credentials: "include",
})

export const authApi = {
  async login(payload: { email: string; password: string }) {
    const { data, error } = await client.POST("/auth/login", { body: payload })
    if (error) throw new Error("Login failed")
    return data
  },
  async me() {
    const { data, error } = await client.GET("/auth/me")
    if (error) throw new Error("Not authenticated")
    return data
  },
  async logout() {
    const { error } = await client.POST("/auth/logout")
    if (error) throw new Error("Logout failed")
  },
}
```

```ts
import { defineStore } from "pinia"

import { authApi } from "./api"

type LoginPayload = {
  email: string
  password: string
}

export const useAuthStore = defineStore("auth", {
  state: () => ({
    currentUser: null as null | { id: string; email: string; displayName: string },
    isBootstrapping: false,
  }),
  getters: {
    isAuthenticated: (state) => state.currentUser !== null,
  },
  actions: {
    async bootstrap() {
      this.isBootstrapping = true
      try {
        this.currentUser = await authApi.me()
      } catch {
        this.currentUser = null
      } finally {
        this.isBootstrapping = false
      }
    },
    async login(payload: LoginPayload) {
      this.currentUser = await authApi.login(payload)
    },
    async logout() {
      await authApi.logout()
      this.currentUser = null
    },
  },
})
```

- [ ] **Step 4: Wire the store into the router and login view**

```ts
import { createPinia } from "pinia"
import { createMemoryHistory, createRouter, createWebHistory } from "vue-router"

import { useAuthStore } from "../features/auth/store"
import DashboardView from "../views/DashboardView.vue"
import LoginView from "../views/LoginView.vue"

export const pinia = createPinia()

const routes = [
  { path: "/login", component: LoginView },
  { path: "/dashboard", component: DashboardView, meta: { requiresAuth: true } },
  { path: "/:pathMatch(.*)*", redirect: "/dashboard" },
]

const defaultIsAuthenticated = () => useAuthStore(pinia).isAuthenticated

export function buildRouter(isAuthenticated: () => boolean = defaultIsAuthenticated, memory = false) {
  const router = createRouter({
    history: memory ? createMemoryHistory() : createWebHistory(),
    routes,
  })

  router.beforeEach((to) => {
    if (to.meta.requiresAuth && !isAuthenticated()) {
      return "/login"
    }
    if (to.path === "/login" && isAuthenticated()) {
      return "/dashboard"
    }
    return true
  })

  return router
}

export const router = buildRouter()
```

```ts
import { createApp } from "vue"

import App from "./App.vue"
import { pinia, router } from "./router"

createApp(App).use(pinia).use(router).mount("#app")
```

```vue
<script setup lang="ts">
import { reactive } from "vue"
import { useRouter } from "vue-router"

import { useAuthStore } from "../features/auth/store"

const authStore = useAuthStore()
const router = useRouter()
const form = reactive({ email: "", password: "" })

async function submit() {
  await authStore.login(form)
  await router.push("/dashboard")
}
</script>

<template>
  <main>
    <h1>Login</h1>
    <form @submit.prevent="submit">
      <label>
        Email
        <input v-model="form.email" type="email" />
      </label>
      <label>
        Password
        <input v-model="form.password" type="password" />
      </label>
      <button type="submit">Sign in</button>
    </form>
  </main>
</template>
```

```vue
<template>
  <router-view />
</template>
```

```ts
import { render, screen } from "@testing-library/vue"
import { beforeEach, describe, expect, it } from "vitest"
import { createPinia, setActivePinia } from "pinia"

import App from "./App.vue"
import { buildRouter } from "./router"
import { useAuthStore } from "./features/auth/store"

describe("app shell", () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it("renders the dashboard for authenticated users", async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const store = useAuthStore()
    store.currentUser = {
      id: "user-1",
      email: "owner@example.com",
      displayName: "Owner",
    }

    const router = buildRouter(() => true, true)
    await router.push("/dashboard")
    await router.isReady()

    render(App, {
      global: {
        plugins: [pinia, router],
      },
    })

    expect(screen.getByRole("heading", { name: "Dashboard" })).toBeInTheDocument()
  })
})
```

- [ ] **Step 5: Generate the client and run the frontend auth tests**

Run: `cd frontend && npm install && npm run generate:client && npm test -- --run src/features/auth/api.test.ts src/features/auth/store.test.ts src/views/LoginView.test.ts src/App.test.ts src/router/index.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/write_openapi.py frontend/package.json frontend/openapi.json frontend/src/generated/api-types.ts frontend/src/features/auth frontend/src/router/index.ts frontend/src/views/LoginView.vue frontend/src/main.ts
git commit -m "feat: add frontend auth flow with generated API types"
```

### Task 6: Verify The Foundation Slice End To End

**Files:**
- Modify: `backend/tests/auth/test_routes.py`
- Modify: `frontend/src/features/auth/store.test.ts`
- Modify: `frontend/src/features/auth/api.test.ts`
- Modify: `frontend/src/App.test.ts`

- [ ] **Step 1: Add one backend coverage test for duplicate registration rejection**

```python
def test_register_rejects_duplicate_email(client: TestClient) -> None:
    payload = {
        "email": "owner@example.com",
        "password": "secret123",
        "displayName": "Owner",
    }

    first = client.post("/api/v1/auth/register", json=payload)
    second = client.post("/api/v1/auth/register", json=payload)

    assert first.status_code == 201
    assert second.status_code == 409
```

- [ ] **Step 2: Add frontend coverage tests for logout and unauthenticated app rendering**

```ts
it("clears the current user on logout", async () => {
  const store = useAuthStore()

  await store.login({
    email: "owner@example.com",
    password: "secret123",
  })
  await store.logout()

  expect(store.currentUser).toBeNull()
  expect(store.isAuthenticated).toBe(false)
})
```

```ts
it("clears auth state when bootstrap cannot load a session", async () => {
  vi.mocked(authApi.me).mockRejectedValueOnce(new Error("Not authenticated"))

  const store = useAuthStore()
  await store.bootstrap()

  expect(store.currentUser).toBeNull()
  expect(store.isBootstrapping).toBe(false)
})
```

```ts
it("throws when login returns an API error", async () => {
  post.mockResolvedValueOnce({
    data: undefined,
    error: { detail: "Invalid credentials" },
  })

  await expect(
    authApi.login({
      email: "owner@example.com",
      password: "wrong-password",
    })
  ).rejects.toThrow("Login failed")
})
```

```ts
it("returns the current user from me", async () => {
  get.mockResolvedValueOnce({
    data: { id: "user-1", email: "owner@example.com", displayName: "Owner" },
    error: undefined,
  })

  await expect(authApi.me()).resolves.toMatchObject({
    email: "owner@example.com",
  })
})

it("resolves cleanly on logout", async () => {
  post.mockResolvedValueOnce({
    data: undefined,
    error: undefined,
  })

  await expect(authApi.logout()).resolves.toBeUndefined()
})
```

```ts
it("renders the login page for guests", async () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = buildRouter(() => false, true)
  await router.push("/dashboard")
  await router.isReady()

  render(App, {
    global: {
      plugins: [pinia, router],
    },
  })

  expect(screen.getByRole("heading", { name: "Login" })).toBeInTheDocument()
})
```

- [ ] **Step 3: Implement the duplicate-email guard before rerunning**

```python
from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.repositories.users import UserRepository


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(payload: RegisterRequest, response: Response, db: Session = Depends(get_db)) -> UserResponse:
    if UserRepository(db).get_by_email(payload.email) is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    auth = AuthService(db)
    result = auth.register(
        email=payload.email,
        password=payload.password,
        display_name=payload.display_name,
    )
    settings = Settings()
    response.set_cookie(
        key=settings.session_cookie_name,
        value=result.session_token,
        httponly=True,
        samesite="lax",
        max_age=settings.session_ttl_seconds,
    )
    return UserResponse.from_model(result.user)
```

- [ ] **Step 4: Run the full backend and frontend foundation suites**

Run: `cd backend && .venv/bin/pytest -q`
Expected: PASS with coverage at or above 95%

Run: `cd frontend && npm test`
Expected: PASS with line coverage at or above 95%

- [ ] **Step 5: Commit**

```bash
git add backend/tests/auth/test_routes.py frontend/src/features/auth/store.test.ts backend/app/api/routes/auth.py
git commit -m "test: harden foundation auth coverage"
```

## Follow-On Plan Split

Create the next execution plans only after this foundation slice is green:

1. `2026-04-05-fastapi-vue-documents-and-analysis.md`
2. `2026-04-05-fastapi-vue-transactions.md`
3. `2026-04-05-fastapi-vue-settings-dashboard-csv-and-cutover.md`
