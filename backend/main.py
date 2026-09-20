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

# Registro de Controladores
app.include_router(health_controller.router)
app.include_router(auth_controller.router)
app.include_router(company_controller.router)
app.include_router(contact_controller.router)
app.include_router(product_controller.router)
app.include_router(opportunity_controller.router)
app.include_router(opportunity_controller.stages_router)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
