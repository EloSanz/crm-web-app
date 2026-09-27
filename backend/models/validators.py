def validate_phone(value: str | None) -> str | None:
    """Máximo 10 dígitos (formato local, sin código de país): coincide con cómo
    contact_service normaliza teléfonos para detectar duplicados y con cómo
    whatsapp_service arma el número internacional al enviar mensajes."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    digits = "".join(ch for ch in value if ch.isdigit())
    if len(digits) > 10:
        raise ValueError("El teléfono debe tener máximo 10 dígitos")
    return value
