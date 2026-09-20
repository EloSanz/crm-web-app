import logging
import uuid
from typing import Any

import boto3
from botocore.exceptions import ClientError, NoCredentialsError

from backend.config import settings

logger = logging.getLogger(__name__)


class StorageService:
    """Servicio de almacenamiento de archivos e imágenes en AWS S3 para el CRM Corralón."""

    def __init__(self) -> None:
        self._s3_client: Any = None
        self.bucket_name = settings.AWS_BUCKET_NAME or "myawsbucketelito"
        self.region = settings.AWS_REGION or "us-east-2"

    @property
    def client(self) -> Any:
        if self._s3_client is None:
            kwargs: dict[str, Any] = {
                "region_name": self.region,
            }
            if settings.AWS_ACCESS_KEY_ID and settings.AWS_SECRET_ACCESS_KEY:
                kwargs["aws_access_key_id"] = settings.AWS_ACCESS_KEY_ID
                kwargs["aws_secret_access_key"] = settings.AWS_SECRET_ACCESS_KEY

            self._s3_client = boto3.client("s3", **kwargs)
        return self._s3_client

    def upload_image(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "image/jpeg",
        prefix: str = "crm/materiales",
    ) -> tuple[str, str]:
        """Sube una imagen al bucket de S3 con acceso público.

        Prefixes sugeridos:
        - `crm/materiales`: Fotos de materiales y productos del catálogo.
        - `crm/remitos`: Comprobantes de entrega y remitos firmados en obra.
        - `crm/obras`: Fotos de visitas a obra y relevamiento técnico.

        Retorna (url_publica, storage_key).
        """
        ext = filename.split(".")[-1].lower() if "." in filename else "jpg"
        if ext not in ["jpg", "jpeg", "png", "webp", "pdf"]:
            ext = "jpg"

        unique_id = uuid.uuid4().hex[:12]
        storage_key = f"{prefix}/{unique_id}.{ext}"

        try:
            self.client.put_object(
                Bucket=self.bucket_name,
                Key=storage_key,
                Body=file_bytes,
                ContentType=content_type,
                CacheControl="public, max-age=31536000, immutable",
            )
        except NoCredentialsError:
            logger.warning("Credenciales de AWS no configuradas. Usando URL mock de simulación local.")
            mock_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{storage_key}"
            return mock_url, storage_key
        except ClientError as e:
            error_msg = e.response.get("Error", {}).get("Message", str(e))
            logger.error(f"Error de AWS S3 al subir {storage_key}: {error_msg}")
            raise RuntimeError(f"Error de AWS S3: {error_msg}")

        if settings.AWS_S3_CUSTOM_DOMAIN:
            public_url = f"https://{settings.AWS_S3_CUSTOM_DOMAIN}/{storage_key}"
        else:
            public_url = f"https://{self.bucket_name}.s3.{self.region}.amazonaws.com/{storage_key}"

        return public_url, storage_key

    def delete_image(self, storage_key: str) -> bool:
        """Elimina un objeto del bucket S3."""
        try:
            self.client.delete_object(Bucket=self.bucket_name, Key=storage_key)
            return True
        except ClientError as e:
            logger.error(f"Error eliminando {storage_key} de S3: {e}")
            return False


storage_service = StorageService()
