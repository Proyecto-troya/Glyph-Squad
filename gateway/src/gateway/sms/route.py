"""``POST /api/sms``. Same token as the WebSocket, sent as ``X-Gateway-Token``."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status

from gateway.security.auth import token_matches
from gateway.sms.models import SmsRequest, SmsResponse
from gateway.sms.service import SmsService


def require_token(request: Request, x_gateway_token: str | None = Header(default=None)) -> None:
    """Runs before body validation, so unauthenticated callers only ever see 401.

    Enforced only with GATEWAY_SMS_REQUIRE_TOKEN=true; the plan's service and the app's
    client (`requestSentence`) exchange no token.
    """
    settings = request.app.state.runtime.settings
    if settings.sms_require_token and not token_matches(x_gateway_token, settings.token):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing or invalid gateway token")


router = APIRouter(dependencies=[Depends(require_token)])


def service_of(request: Request) -> SmsService:
    service = getattr(request.app.state, "sms_service", None)
    if service is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "sms endpoint is disabled")
    assert isinstance(service, SmsService)
    return service


@router.post("/api/sms", response_model=SmsResponse)
async def compose_sms(body: SmsRequest, request: Request) -> SmsResponse:
    return await service_of(request).compose(body)
