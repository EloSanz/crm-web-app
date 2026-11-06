import re


def _strip_mobile_prefix(national: str) -> str:
    """Saca el 15 de celular: 11 15 2233-4455 (12 dígitos) → 1122334455."""
    if len(national) == 12:
        for area_len in (2, 3, 4):
            if national[area_len : area_len + 2] == "15":
                return national[:area_len] + national[area_len + 2 :]
    return national


def local_phone_digits(value: str) -> str:
    """Teléfono argentino en formato local (característica + número, sin 0 ni 15).

    Acepta lo que ya está cargado con código de país: +54 9 11 4843-9238 → 1148439238.
    Así los contactos viejos se pueden seguir editando sin que el teléfono quede inválido.
    """
    digits = re.sub(r"\D", "", value)
    if len(digits) <= 10:
        return digits
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("54") and len(digits) > 10:
        digits = digits[2:]
        if digits.startswith("9") and len(digits) == 11:
            digits = digits[1:]
    digits = digits.lstrip("0")
    return _strip_mobile_prefix(digits)


def validate_phone(value: str | None) -> str | None:
    """Máximo 10 dígitos en formato local (sin código de país): coincide con cómo
    contact_service normaliza teléfonos para detectar duplicados y con cómo
    whatsapp_service arma el número internacional al enviar mensajes.
    Se valida sobre los dígitos en formato local y se guarda tal como se escribió."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    digits = local_phone_digits(value)
    if not digits:
        return None
    if len(digits) > 10:
        raise ValueError("El teléfono debe tener máximo 10 dígitos (característica y número, sin 0 ni 15)")
    return value


def validate_document_number(value: str | None) -> str | None:
    """DNI argentino: 7 u 8 dígitos (los DNI más viejos tienen 7). Se guarda tal como se escribió."""
    if value is None:
        return None
    value = value.strip()
    if not value:
        return None
    digits = re.sub(r"\D", "", value)
    if len(digits) not in (7, 8):
        raise ValueError("El DNI debe tener 7 u 8 dígitos")
    return value
