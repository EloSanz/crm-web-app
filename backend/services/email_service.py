import html as htmllib
import logging
import mimetypes
import re
import smtplib
import ssl
from dataclasses import dataclass, field
from email.message import EmailMessage
from email.utils import formatdate, make_msgid, parseaddr
from html.parser import HTMLParser
from urllib.parse import urlparse

import httpx

from backend.config import settings
from backend.models.activity import ActivityAttachment

logger = logging.getLogger("crm.services.email")

RESEND_URL = "https://api.resend.com/emails"
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024
PROVIDERS = {"log", "resend", "smtp"}

# ---------------------------------------------------------------------------
# Saneamiento del HTML (lista blanca, sin dependencias)
# ---------------------------------------------------------------------------

ALLOWED_TAGS = {
    "a",
    "b",
    "blockquote",
    "br",
    "caption",
    "code",
    "col",
    "colgroup",
    "div",
    "em",
    "h1",
    "h2",
    "h3",
    "h4",
    "hr",
    "i",
    "li",
    "ol",
    "p",
    "pre",
    "s",
    "small",
    "span",
    "strike",
    "strong",
    "sub",
    "sup",
    "table",
    "tbody",
    "td",
    "tfoot",
    "th",
    "thead",
    "tr",
    "u",
    "ul",
}
# Se descartan con todo su contenido.
DROP_CONTENT_TAGS = {
    "applet",
    "embed",
    "frame",
    "frameset",
    "head",
    "iframe",
    "math",
    "noscript",
    "object",
    "script",
    "select",
    "style",
    "svg",
    "template",
    "textarea",
    "title",
}
VOID_TAGS = {"br", "hr", "col", "img", "input", "meta", "link", "source", "wbr", "area", "base", "param", "track"}
CELL_ATTRS = {"colspan", "rowspan", "align", "valign", "width"}
ALLOWED_ATTRS: dict[str, set[str]] = {
    "a": {"href", "title", "target"},
    "td": CELL_ATTRS,
    "th": CELL_ATTRS,
    "table": {"width", "cellpadding", "cellspacing", "border", "align", "role"},
    "col": {"width", "span"},
    "ol": {"start"},
}
GLOBAL_ATTRS = {"style"}
SAFE_URL_SCHEMES = {"http", "https", "mailto", "tel"}
_UNSAFE_STYLE = re.compile(r"expression|javascript:|vbscript:|url\(|behavior|@import|-moz-binding", re.IGNORECASE)
_CONTROL_CHARS = re.compile(r"[\x00-\x20\x7f]+")

# Estilos en línea para clientes de correo que ignoran las hojas de estilo.
EMAIL_TAG_STYLES = {
    "p": "margin:0 0 12px 0;",
    "a": "color:#16212B;text-decoration:underline;",
    "ul": "margin:0 0 12px 0;padding-left:24px;",
    "ol": "margin:0 0 12px 0;padding-left:24px;",
    "li": "margin:0 0 4px 0;",
    "h1": "margin:0 0 12px 0;font-size:22px;line-height:1.2;",
    "h2": "margin:0 0 12px 0;font-size:19px;line-height:1.25;",
    "h3": "margin:0 0 10px 0;font-size:17px;line-height:1.3;",
    "blockquote": "margin:0 0 12px 0;padding-left:12px;border-left:3px solid #dce1df;color:#5a666f;",
    "table": "border-collapse:collapse;",
}


def _safe_url(value: str) -> str | None:
    compact = _CONTROL_CHARS.sub("", value or "")
    if not compact:
        return None
    if compact.startswith(("#", "/")):
        return None
    scheme = compact.split(":", 1)[0].lower() if ":" in compact else ""
    if scheme not in SAFE_URL_SCHEMES:
        return None
    return value.strip()


class _Sanitizer(HTMLParser):
    def __init__(self, email_styles: bool = False):
        super().__init__(convert_charrefs=True)
        self.out: list[str] = []
        self.open_tags: list[str] = []
        self.skip_depth = 0
        self.email_styles = email_styles

    def _attrs(self, tag: str, attrs: list[tuple[str, str | None]]) -> str:
        allowed = ALLOWED_ATTRS.get(tag, set()) | GLOBAL_ATTRS
        parts: list[str] = []
        has_style = False
        target_blank = False
        for raw_name, raw_value in attrs:
            name = (raw_name or "").lower()
            value = raw_value or ""
            if name not in allowed or name.startswith("on"):
                continue
            if name == "href":
                safe = _safe_url(value)
                if not safe:
                    continue
                value = safe
            elif name == "style":
                if _UNSAFE_STYLE.search(re.sub(r"\s+|/\*.*?\*/", "", value)):
                    continue
                value = value.strip()
                if not value:
                    continue
                has_style = True
            elif name == "target":
                if value != "_blank":
                    continue
                target_blank = True
            parts.append(f'{name}="{htmllib.escape(value, quote=True)}"')
        if target_blank:
            parts.append('rel="noopener noreferrer"')
        if self.email_styles and not has_style and tag in EMAIL_TAG_STYLES:
            parts.append(f'style="{EMAIL_TAG_STYLES[tag]}"')
        return (" " + " ".join(parts)) if parts else ""

    def handle_starttag(self, tag, attrs):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            if tag not in VOID_TAGS:
                self.skip_depth += 1
            return
        if self.skip_depth or tag not in ALLOWED_TAGS:
            return
        self.out.append(f"<{tag}{self._attrs(tag, attrs)}>")
        if tag not in VOID_TAGS:
            self.open_tags.append(tag)

    def handle_startendtag(self, tag, attrs):
        tag = tag.lower()
        if self.skip_depth or tag not in ALLOWED_TAGS:
            return
        if tag in VOID_TAGS:
            self.out.append(f"<{tag}{self._attrs(tag, attrs)}>")
        else:
            self.out.append(f"<{tag}{self._attrs(tag, attrs)}></{tag}>")

    def handle_endtag(self, tag):
        tag = tag.lower()
        if tag in DROP_CONTENT_TAGS:
            if self.skip_depth:
                self.skip_depth -= 1
            return
        if self.skip_depth or tag not in ALLOWED_TAGS or tag in VOID_TAGS or tag not in self.open_tags:
            return
        while self.open_tags:
            current = self.open_tags.pop()
            self.out.append(f"</{current}>")
            if current == tag:
                break

    def handle_data(self, data):
        if not self.skip_depth:
            self.out.append(htmllib.escape(data, quote=False))

    def result(self) -> str:
        self.close()
        while self.open_tags:
            self.out.append(f"</{self.open_tags.pop()}>")
        return "".join(self.out).strip()


def sanitize_html(raw: str | None, email_styles: bool = False) -> str:
    """Deja sólo etiquetas de formato seguras: sin scripts, estilos embebidos, iframes, on* ni javascript:."""
    parser = _Sanitizer(email_styles=email_styles)
    parser.feed(raw or "")
    return parser.result()


# ---------------------------------------------------------------------------
# Versión en texto plano
# ---------------------------------------------------------------------------

_BLOCK_TAGS = {"p", "div", "h1", "h2", "h3", "h4", "blockquote", "pre", "table", "tr", "ul", "ol", "hr", "caption"}


class _TextExtractor(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self.lists: list[list] = []  # [tipo, contador]
        self.href_stack: list[str | None] = []
        self.link_text: list[str] = []
        self.cell_index = 0
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag in DROP_CONTENT_TAGS:
            self.skip_depth += 1
            return
        if tag in _BLOCK_TAGS:
            self.parts.append("\n")
        if tag in ("ul", "ol"):
            self.lists.append([tag, 0])
        elif tag == "li":
            if self.lists and self.lists[-1][0] == "ol":
                self.lists[-1][1] += 1
                self.parts.append(f"\n{self.lists[-1][1]}. ")
            else:
                self.parts.append("\n• ")
        elif tag == "br":
            self.parts.append("\n")
        elif tag == "tr":
            self.cell_index = 0
        elif tag in ("td", "th"):
            if self.cell_index:
                self.parts.append(" | ")
            self.cell_index += 1
        elif tag == "a":
            self.href_stack.append(dict(attrs).get("href"))
            self.link_text = []

    def handle_endtag(self, tag):
        if tag in DROP_CONTENT_TAGS:
            self.skip_depth = max(0, self.skip_depth - 1)
            return
        if tag in ("ul", "ol") and self.lists:
            self.lists.pop()
        if tag == "a" and self.href_stack:
            href = self.href_stack.pop()
            text = "".join(self.link_text).strip()
            if href and href.startswith(("http://", "https://")) and href != text:
                self.parts.append(f" ({href})")
        if tag in _BLOCK_TAGS and tag != "tr":
            self.parts.append("\n")

    def handle_data(self, data):
        if self.skip_depth:
            return
        text = re.sub(r"\s+", " ", data)
        if self.href_stack:
            self.link_text.append(text)
        self.parts.append(text)

    def result(self) -> str:
        self.close()
        lines = [line.strip() for line in "".join(self.parts).split("\n")]
        text = "\n".join(lines)
        return re.sub(r"\n{3,}", "\n\n", text).strip()


def html_to_text(html: str | None) -> str:
    parser = _TextExtractor()
    parser.feed(html or "")
    return parser.result()


# ---------------------------------------------------------------------------
# Plantilla de marca (tablas y estilos en línea, apta para clientes de correo)
# ---------------------------------------------------------------------------


def render_email_template(body_html: str, subject: str) -> str:
    brand = htmllib.escape((settings.EMAIL_BRAND_NAME or "Corralap").upper())
    title = htmllib.escape(subject or "")
    font = "Montserrat,Arial,Helvetica,sans-serif"
    return (
        '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">'
        '<meta name="viewport" content="width=device-width,initial-scale=1">'
        f"<title>{title}</title></head>"
        '<body style="margin:0;padding:0;background-color:#eceeed;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="background-color:#eceeed;"><tr><td align="center" style="padding:24px 12px;">'
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" '
        'style="max-width:640px;background-color:#ffffff;border-radius:12px;">'
        '<tr><td style="height:6px;line-height:6px;font-size:0;background-color:#FFC20E;'
        'border-radius:12px 12px 0 0;">&nbsp;</td></tr>'
        f'<tr><td style="padding:22px 28px 4px 28px;font-family:{font};font-size:17px;font-weight:800;'
        f'letter-spacing:3px;color:#16212B;">{brand}</td></tr>'
        f'<tr><td style="padding:14px 28px 28px 28px;font-family:{font};font-size:15px;line-height:1.6;'
        f'color:#16212B;">{body_html}</td></tr>'
        "</table></td></tr></table></body></html>"
    )


# ---------------------------------------------------------------------------
# Envío
# ---------------------------------------------------------------------------


@dataclass
class EmailResult:
    status: str  # "enviado" | "simulado"
    provider: str
    provider_message_id: str | None = None
    warnings: list[str] = field(default_factory=list)


class EmailSendError(Exception):
    def __init__(self, message: str, provider: str):
        super().__init__(message)
        self.message = message
        self.provider = provider


def provider_name() -> str:
    name = (settings.EMAIL_PROVIDER or "log").strip().lower()
    return name if name in PROVIDERS else "log"


def _storage_hosts() -> set[str]:
    bucket, region = settings.AWS_BUCKET_NAME, settings.AWS_REGION
    hosts = {f"{bucket}.s3.{region}.amazonaws.com", f"{bucket}.s3.amazonaws.com"}
    if settings.AWS_S3_CUSTOM_DOMAIN:
        hosts.add(settings.AWS_S3_CUSTOM_DOMAIN.strip().lower())
    return {h.lower() for h in hosts}


def is_trusted_attachment_url(url: str) -> bool:
    """Sólo se adjuntan archivos subidos al almacenamiento del CRM (evita pedir URLs internas)."""
    try:
        parsed = urlparse(url)
    except ValueError:
        return False
    return parsed.scheme == "https" and (parsed.hostname or "").lower() in _storage_hosts()


def _download(url: str) -> bytes | None:
    if not is_trusted_attachment_url(url):
        return None
    try:
        with httpx.stream("GET", url, timeout=15, follow_redirects=False) as res:
            if res.status_code != 200:
                return None
            buf = bytearray()
            for chunk in res.iter_bytes():
                buf.extend(chunk)
                if len(buf) > MAX_ATTACHMENT_BYTES:
                    return None
            return bytes(buf)
    except httpx.HTTPError as e:
        logger.warning(f"No se pudo descargar el adjunto {url}: {e}")
        return None


def _send_resend(
    to: list[str], cc: list[str], subject: str, html: str, text: str, attachments: list[ActivityAttachment]
) -> EmailResult:
    if not settings.RESEND_API_KEY:
        raise EmailSendError("Falta configurar RESEND_API_KEY para enviar correos.", "resend")
    warnings: list[str] = []
    files = []
    for a in attachments:
        if is_trusted_attachment_url(a.url):
            files.append({"filename": a.name, "path": a.url})
        else:
            warnings.append(f"No se pudo adjuntar {a.name}")
    payload: dict = {"from": settings.EMAIL_FROM, "to": to, "subject": subject, "html": html, "text": text}
    if cc:
        payload["cc"] = cc
    if settings.EMAIL_REPLY_TO:
        payload["reply_to"] = settings.EMAIL_REPLY_TO
    if files:
        payload["attachments"] = files
    try:
        res = httpx.post(
            RESEND_URL,
            json=payload,
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            timeout=20,
        )
    except httpx.HTTPError as e:
        logger.warning(f"Resend no respondió: {e}")
        raise EmailSendError("No pudimos conectarnos con el proveedor de correo. Probá de nuevo.", "resend")
    try:
        data = res.json()
    except ValueError:
        data = {}
    if res.status_code >= 400:
        detail = (data.get("message") if isinstance(data, dict) else None) or res.text[:200]
        if res.status_code in (401, 403):
            msg = f"El proveedor de correo rechazó la clave o el remitente ({detail})."
        elif res.status_code == 429:
            msg = "Se alcanzó el límite de envíos del proveedor de correo. Probá en unos minutos."
        else:
            msg = f"El proveedor de correo rechazó el envío: {detail}"
        raise EmailSendError(msg, "resend")
    return EmailResult(status="enviado", provider="resend", provider_message_id=data.get("id"), warnings=warnings)


def _send_smtp(
    to: list[str], cc: list[str], subject: str, html: str, text: str, attachments: list[ActivityAttachment]
) -> EmailResult:
    if not settings.SMTP_HOST:
        raise EmailSendError("Falta configurar SMTP_HOST para enviar correos.", "smtp")
    sender = settings.EMAIL_FROM or settings.SMTP_USER
    msg = EmailMessage()
    msg["From"] = sender
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    msg["Subject"] = subject
    if settings.EMAIL_REPLY_TO:
        msg["Reply-To"] = settings.EMAIL_REPLY_TO
    msg["Date"] = formatdate(localtime=True)
    domain = parseaddr(sender)[1].rpartition("@")[2] or None
    message_id = make_msgid(domain=domain)
    msg["Message-ID"] = message_id
    msg.set_content(text or " ")
    msg.add_alternative(html, subtype="html")

    warnings: list[str] = []
    for a in attachments:
        data = _download(a.url)
        if data is None:
            warnings.append(f"No se pudo adjuntar {a.name}")
            continue
        ctype = a.content_type or mimetypes.guess_type(a.name)[0] or "application/octet-stream"
        maintype, _, subtype = ctype.partition("/")
        msg.add_attachment(data, maintype=maintype, subtype=subtype or "octet-stream", filename=a.name)

    context = ssl.create_default_context()
    server: smtplib.SMTP | None = None
    try:
        if settings.SMTP_PORT == 465:
            server = smtplib.SMTP_SSL(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20, context=context)
        else:
            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=20)
            server.ehlo()
            if server.has_extn("starttls"):
                server.starttls(context=context)
                server.ehlo()
        if settings.SMTP_USER:
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
        server.send_message(msg, to_addrs=[*to, *cc])
    except smtplib.SMTPAuthenticationError:
        raise EmailSendError("El servidor de correo rechazó el usuario o la contraseña (SMTP).", "smtp")
    except (smtplib.SMTPException, OSError) as e:
        logger.warning(f"Fallo SMTP: {e}")
        raise EmailSendError(f"No se pudo enviar el correo por SMTP: {e}", "smtp")
    finally:
        if server is not None:
            try:
                server.quit()
            except Exception:
                pass
    return EmailResult(status="enviado", provider="smtp", provider_message_id=message_id, warnings=warnings)


def send_email(
    *,
    to: list[str],
    cc: list[str],
    subject: str,
    html: str,
    text: str,
    attachments: list[ActivityAttachment],
) -> EmailResult:
    """Envía el correo con el proveedor configurado. Con `log` no sale nada: queda como simulado."""
    provider = provider_name()
    if provider == "resend":
        return _send_resend(to, cc, subject, html, text, attachments)
    if provider == "smtp":
        return _send_smtp(to, cc, subject, html, text, attachments)
    logger.info(f"EMAIL_PROVIDER=log: correo simulado a {', '.join(to)} ({subject})")
    return EmailResult(status="simulado", provider="log")
