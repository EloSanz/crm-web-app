from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.config import settings
from backend.controllers import (
    auth_controller,
    company_controller,
    contact_controller,
    health_controller,
    opportunity_controller,
    product_controller,
    project_controller,
    upload_controller,
)

app = FastAPI(
    title=settings.APP_NAME,
    description="API REST del Sistema CRM para Gestión Comercial - UNLaM GADS II",
    version=settings.APP_VERSION,
)

# Configuración CORS para soportar frontend Next.js y orígenes locales
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        settings.FRONTEND_URL,
        "*",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_api_key_and_auth(request, call_next):
    """
    Control de seguridad estricto para el backend del CRM:
    1. Las peticiones OPTIONS (CORS preflight) pasan sin bloquear.
    2. Endpoints públicos (/health, /api/health, /docs, /openapi.json, /redoc) pasan libremente.
    3. Endpoint de login (/api/auth/login) requiere la X-API-Key del CRM para impedir accesos directos por curl no autorizados.
    4. Todos los demás endpoints (/api/companies, /api/opportunities, etc.) requieren tanto:
       - Header 'X-API-Key' válido (o parámetro query api_key).
       - Header 'Authorization' con token Bearer válido del usuario autenticado.
    """
    path = request.url.path

    # 1. CORS pre-flight
    if request.method == "OPTIONS":
        return await call_next(request)

    # 2. Rutas de salud y documentación del sistema
    public_paths = ["/health", "/api/health", "/docs", "/openapi.json", "/redoc"]
    if path in public_paths:
        return await call_next(request)

    # 3. Validación de API Key
    api_key_header = request.headers.get("x-api-key") or request.query_params.get("api_key")
    expected_api_key = settings.CRM_API_KEY

    if not api_key_header or api_key_header != expected_api_key:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=403,
            content={
                "detail": "Acceso denegado: API Key no provista o inválida. Las consultas al backend requieren una clave autorizada por UI."
            },
        )

    # 4. Login solo requiere API Key para autenticarse
    if path == "/api/auth/login":
        return await call_next(request)

    # 5. Resto de las rutas requieren token de usuario autenticado
    auth_header = request.headers.get("authorization")
    if not auth_header:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=401,
            content={"detail": "Acceso no autorizado: Se requiere token de sesión Bearer del usuario."},
        )

    try:
        from backend.controllers.auth_controller import decode_simple_token

        decode_simple_token(auth_header)
    except Exception:
        from fastapi.responses import JSONResponse

        return JSONResponse(
            status_code=401,
            content={"detail": "Sesión inválida o expirada. Inicie sesión nuevamente."},
        )

    return await call_next(request)


# Registro de Controladores
app.include_router(health_controller.router)
app.include_router(auth_controller.router)
app.include_router(company_controller.router)
app.include_router(contact_controller.router)
app.include_router(project_controller.router)
app.include_router(product_controller.router)
app.include_router(opportunity_controller.router)
app.include_router(opportunity_controller.stages_router)
app.include_router(upload_controller.router)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
