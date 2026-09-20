import logging
from typing import Any

from fastapi import APIRouter, File, HTTPException, UploadFile, status

from backend.services.storage_service import storage_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/upload", tags=["Almacenamiento S3 / Imágenes"])

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".pdf"}


async def _process_image_upload(file: UploadFile, prefix: str) -> dict[str, Any]:
    """Procesa y sube una imagen a AWS S3.

    Retorna diccionario con status, url pública, filename y storage_key.
    """
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Archivo requerido para la carga.",
        )

    ext = "." + file.filename.rsplit(".", 1)[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Extensión no permitida ({ext}). Formatos válidos: jpg, jpeg, png, webp, pdf.",
        )

    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El archivo enviado está vacío.",
        )

    content_type = file.content_type or "image/jpeg"

    try:
        public_url, storage_key = storage_service.upload_image(
            file_bytes=file_bytes,
            filename=file.filename,
            content_type=content_type,
            prefix=prefix,
        )
        return {
            "success": True,
            "image_url": public_url,
            "url": public_url,
            "storage_key": storage_key,
            "filename": file.filename,
            "content_type": content_type,
            "size_bytes": len(file_bytes),
        }
    except Exception as e:
        logger.error(f"Error procesando upload a S3: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al subir imagen a S3: {str(e)}",
        )


@router.post(
    "/material",
    summary="Subir foto de material del catálogo a S3",
)
async def upload_material_image(file: UploadFile = File(...)) -> dict[str, Any]:
    """Sube una foto de un material de construcción (bolsas de cemento, perfiles, etc.)."""
    return await _process_image_upload(file, prefix="crm/materiales")


@router.post(
    "/remito",
    summary="Subir foto de remito o comprobante de entrega en obra",
)
async def upload_delivery_receipt(file: UploadFile = File(...)) -> dict[str, Any]:
    """Sube una foto o PDF de un remito firmado por el capataz en la descarga de la obra."""
    return await _process_image_upload(file, prefix="crm/remitos")


@router.post(
    "/obra",
    summary="Subir foto de relevamiento o visita a obra",
)
async def upload_site_visit_image(file: UploadFile = File(...)) -> dict[str, Any]:
    """Sube una foto de una visita técnica o avance de obra vinculada a una oportunidad."""
    return await _process_image_upload(file, prefix="crm/obras")


@router.delete(
    "/{storage_key:path}",
    summary="Eliminar archivo o imagen de S3",
)
def delete_file_from_storage(storage_key: str) -> dict[str, Any]:
    """Elimina el archivo físico de S3 usando su storage_key."""
    success = storage_service.delete_image(storage_key)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"No se pudo eliminar el archivo {storage_key} de S3.",
        )
    return {"success": True, "message": f"Archivo {storage_key} eliminado de S3."}
