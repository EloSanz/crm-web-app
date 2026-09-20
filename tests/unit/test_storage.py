import io
from unittest.mock import patch

from fastapi.testclient import TestClient


def test_upload_material_image(client: TestClient):
    file_content = b"fake image bytes for test"
    file = io.BytesIO(file_content)

    with patch("backend.services.storage_service.storage_service.upload_image") as mock_upload:
        mock_upload.return_value = (
            "https://myawsbucketelito.s3.us-east-2.amazonaws.com/crm/materiales/mock123.jpg",
            "crm/materiales/mock123.jpg",
        )

        response = client.post(
            "/api/upload/material",
            files={"file": ("ladrillo.jpg", file, "image/jpeg")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "crm/materiales" in data["storage_key"]
        assert data["filename"] == "ladrillo.jpg"


def test_upload_invalid_extension(client: TestClient):
    file_content = b"executable code"
    file = io.BytesIO(file_content)

    response = client.post(
        "/api/upload/material",
        files={"file": ("virus.exe", file, "application/octet-stream")},
    )
    assert response.status_code == 400
    assert "Extensión no permitida" in response.json()["detail"]


def test_upload_empty_file(client: TestClient):
    empty_file = io.BytesIO(b"")

    response = client.post(
        "/api/upload/material",
        files={"file": ("empty.jpg", empty_file, "image/jpeg")},
    )
    assert response.status_code == 400
    assert "vacío" in response.json()["detail"]


def test_upload_remito_pdf(client: TestClient):
    pdf_content = b"%PDF-1.4 fake pdf"
    file = io.BytesIO(pdf_content)

    with patch("backend.services.storage_service.storage_service.upload_image") as mock_upload:
        mock_upload.return_value = (
            "https://myawsbucketelito.s3.us-east-2.amazonaws.com/crm/remitos/remito_104.pdf",
            "crm/remitos/remito_104.pdf",
        )

        response = client.post(
            "/api/upload/remito",
            files={"file": ("remito_104.pdf", file, "application/pdf")},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "crm/remitos" in data["storage_key"]
