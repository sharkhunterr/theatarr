"""Email notification service for Theatarr."""

import base64
import logging
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from pathlib import Path

import aiosmtplib
from sqlalchemy import select

from theatarr.database import async_session_maker
from theatarr.models.settings import Settings

logger = logging.getLogger(__name__)

# Base64-encoded icon for email embedding (40x40 clapperboard)
_ICON_PATH = Path(__file__).resolve().parents[4] / "assets" / "branding" / "icon-email-40.png"
try:
    ICON_B64 = base64.b64encode(_ICON_PATH.read_bytes()).decode()
except Exception:
    ICON_B64 = ""

# ============================================================================
# SMTP config helpers
# ============================================================================

SMTP_SETTINGS_KEYS = {
    "email.enabled": False,
    "email.smtp_host": "",
    "email.smtp_port": 587,
    "email.smtp_username": "",
    "email.smtp_password": "",
    "email.smtp_from_email": "",
    "email.smtp_from_name": "Theatarr",
    "email.smtp_security": "starttls",  # "starttls", "ssl", "none"
}


async def _get_smtp_config() -> dict | None:
    """Load SMTP configuration from DB settings. Returns None if disabled or incomplete."""
    async with async_session_maker() as db:
        result = await db.execute(
            select(Settings).where(Settings.key.startswith("email."))
        )
        rows = {s.key: s.value for s in result.scalars().all()}

    config = {}
    for key, default in SMTP_SETTINGS_KEYS.items():
        config[key] = rows.get(key, default)

    # Backward compat: migrate old boolean email.smtp_use_tls → email.smtp_security
    if "email.smtp_security" not in rows and "email.smtp_use_tls" in rows:
        config["email.smtp_security"] = "starttls" if rows["email.smtp_use_tls"] else "none"

    if not config.get("email.enabled"):
        return None
    if not config.get("email.smtp_host"):
        return None
    if not config.get("email.smtp_from_email"):
        return None

    return config


# ============================================================================
# Core send
# ============================================================================


def _smtp_send_kwargs(config: dict) -> dict:
    """Build aiosmtplib.send kwargs from config."""
    port = int(config["email.smtp_port"])
    security = config.get("email.smtp_security", "starttls")

    kwargs: dict = {
        "hostname": config["email.smtp_host"],
        "port": port,
        "username": config["email.smtp_username"] or None,
        "password": config["email.smtp_password"] or None,
    }
    if security == "ssl":
        kwargs["use_tls"] = True   # connect with implicit TLS (port 465)
    elif security == "starttls":
        kwargs["start_tls"] = True  # upgrade to TLS after connect (port 587)
    # "none" → no encryption
    return kwargs


async def send_email(to_email: str, subject: str, html_body: str) -> bool:
    """Send an email via SMTP. Never raises — logs warnings on failure."""
    try:
        config = await _get_smtp_config()
        if not config:
            logger.debug("Email not sent (SMTP not configured or disabled)")
            return False

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{config['email.smtp_from_name']} <{config['email.smtp_from_email']}>"
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.attach(MIMEText(html_body, "html", "utf-8"))

        await aiosmtplib.send(msg, **_smtp_send_kwargs(config))
        logger.info(f"Email sent to {to_email}: {subject}")
        return True
    except Exception:
        logger.warning(f"Failed to send email to {to_email}: {subject}", exc_info=True)
        return False


async def send_test_email(to_email: str) -> dict:
    """Send a test email. Returns {success, error} — waits for result."""
    try:
        config = await _get_smtp_config()
        if not config:
            return {"success": False, "error": "SMTP non configure ou desactive"}

        # Load banner for the test email
        banner_b64 = ""
        banner_path = Path(__file__).resolve().parents[4] / "assets" / "branding" / "banner-wide.png"
        try:
            banner_b64 = base64.b64encode(banner_path.read_bytes()).decode()
        except Exception:
            pass

        banner_html = ""
        if banner_b64:
            banner_html = f"""
                <div style="text-align:center;margin:0 -32px 24px -32px;">
                    <img src="data:image/png;base64,{banner_b64}"
                         width="560" alt="Theatarr Banner"
                         style="display:block;width:100%;max-width:560px;height:auto;border-radius:8px;" />
                </div>
            """

        html = _build_email_html(
            title="Email de test",
            content_html=f"""
                {banner_html}
                <p>Bravo ! Si vous lisez ceci, la configuration email de <strong>Theatarr</strong>
                est fonctionnelle.</p>
                <div style="margin:24px 0;padding:16px;background:{BG_COLOR};border-radius:8px;border:1px solid {BORDER_COLOR};">
                    <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:{ACCENT_COLOR};">
                        Types de notifications disponibles :
                    </p>
                    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;font-size:13px;color:{TEXT_COLOR};">
                        <tr><td style="padding:4px 0;">Invitation a une seance</td></tr>
                        <tr><td style="padding:4px 0;">Demarrage de seance</td></tr>
                        <tr><td style="padding:4px 0;">Invitation a un vote</td></tr>
                        <tr><td style="padding:4px 0;">Resultats du vote</td></tr>
                        <tr><td style="padding:4px 0;">Invitation a un quiz</td></tr>
                        <tr><td style="padding:4px 0;">Resultats du quiz</td></tr>
                    </table>
                </div>
                <p style="color:{MUTED_COLOR};font-size:13px;">
                    Ce message a ete envoye depuis l'interface d'administration.
                    Chaque utilisateur peut configurer ses preferences de notification
                    depuis son profil.
                </p>
            """,
            action_url=await _get_frontend_url() + "/portal/profile",
            action_label="Configurer mes notifications",
        )

        msg = MIMEMultipart("alternative")
        msg["From"] = f"{config['email.smtp_from_name']} <{config['email.smtp_from_email']}>"
        msg["To"] = to_email
        msg["Subject"] = "Theatarr — Email de test"
        msg.attach(MIMEText(html, "html", "utf-8"))

        await aiosmtplib.send(msg, **_smtp_send_kwargs(config))
        return {"success": True, "error": None}
    except Exception as exc:
        logger.warning(f"Test email failed: {exc}", exc_info=True)
        return {"success": False, "error": str(exc)}


# ============================================================================
# HTML template
# ============================================================================

ACCENT_COLOR = "#e05d4d"   # Theatarr-500 red
ACCENT_LIGHT = "#ed8778"   # Theatarr-400
ACCENT_DARK = "#cc4030"    # Theatarr-600
BG_COLOR = "#0f0f0f"       # dark-bg
CARD_COLOR = "#1a1a1a"     # dark-surface
TEXT_COLOR = "#e5e5e5"     # dark-text
MUTED_COLOR = "#9ca3af"    # lighter muted for email readability
BORDER_COLOR = "#2a2a2a"   # dark-border


def _build_email_html(
    title: str,
    content_html: str,
    action_url: str | None = None,
    action_label: str | None = None,
) -> str:
    """Build a styled HTML email matching the Theatarr dark theme."""
    button_html = ""
    if action_url and action_label:
        button_html = f"""
        <div style="text-align:center;margin:28px 0 8px;">
            <a href="{action_url}"
               style="display:inline-block;padding:12px 32px;background:{ACCENT_COLOR};
                      color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;
                      font-size:15px;">
                {action_label}
            </a>
        </div>
        """

    return f"""<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:{BG_COLOR};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="background:{BG_COLOR};padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0"
             style="max-width:560px;width:100%;">
        <!-- Accent top bar -->
        <tr><td style="height:3px;background:linear-gradient(90deg,{ACCENT_LIGHT},{ACCENT_DARK});border-radius:3px 3px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
        <!-- Header with logo -->
        <tr><td style="padding:28px 0 20px;text-align:center;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
            <tr>
              <td style="vertical-align:middle;">
                {f'<img src="data:image/png;base64,{ICON_B64}" width="40" height="40" alt="Theatarr" style="display:block;border:0;border-radius:8px;" />' if ICON_B64 else f'<div style="width:40px;height:40px;background:{ACCENT_COLOR};border-radius:8px;text-align:center;line-height:40px;"><span style="font-size:18px;font-weight:800;color:#fff;">T</span></div>'}
              </td>
              <td style="padding-left:12px;vertical-align:middle;">
                <span style="font-size:26px;font-weight:700;color:{TEXT_COLOR};letter-spacing:-0.5px;">Theatarr</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Card -->
        <tr><td style="background:{CARD_COLOR};border:1px solid {BORDER_COLOR};border-radius:12px;padding:32px;">
          <h1 style="margin:0 0 20px;font-size:20px;font-weight:600;color:{TEXT_COLOR};">
            {title}
          </h1>
          <div style="color:{TEXT_COLOR};font-size:15px;line-height:1.6;">
            {content_html}
          </div>
          {button_html}
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:24px 0 0;text-align:center;">
          <p style="margin:0;font-size:12px;color:{MUTED_COLOR};">
            Vous recevez cet email car vous avez un compte Theatarr.<br>
            Vous pouvez modifier vos preferences de notification dans votre profil.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ============================================================================
# Frontend URL helper
# ============================================================================

async def _get_frontend_url() -> str:
    """Get the frontend URL from settings."""
    from theatarr.models.settings import get_frontend_url as _gfu
    async with async_session_maker() as db:
        return await _gfu(db)


# ============================================================================
# Notification functions (6 types)
# ============================================================================


def _format_datetime(dt: datetime | None) -> str:
    """Format a datetime for display in French."""
    if not dt:
        return ""
    return dt.strftime("%d/%m/%Y à %Hh%M")


async def notify_session_invitation(
    user: object,
    session_name: str,
    session_id: str,
    scheduled_at: datetime | None,
) -> None:
    """Notify user of a session invitation."""
    if not getattr(user, "wants_email", lambda _: False)("session_invitation"):
        return

    frontend_url = await _get_frontend_url()
    date_str = _format_datetime(scheduled_at)
    date_line = f"<p><strong>Date :</strong> {date_str}</p>" if date_str else ""

    html = _build_email_html(
        title="Invitation à une séance",
        content_html=f"""
            <p>Vous êtes invité(e) à la séance <strong>{session_name}</strong>.</p>
            {date_line}
            <p>Rendez-vous sur le portail pour accepter ou décliner l'invitation.</p>
        """,
        action_url=f"{frontend_url}/portal/sessions/{session_id}",
        action_label="Voir la séance",
    )
    await send_email(user.email, f"Theatarr — Invitation : {session_name}", html)


async def notify_session_started(
    user: object,
    session_name: str,
    movie_title: str | None,
) -> None:
    """Notify user that a session has started."""
    if not getattr(user, "wants_email", lambda _: False)("session_started"):
        return

    movie_line = f"<p>Film : <strong>{movie_title}</strong></p>" if movie_title else ""

    html = _build_email_html(
        title="La séance commence !",
        content_html=f"""
            <p>La séance <strong>{session_name}</strong> vient de démarrer.</p>
            {movie_line}
            <p>Installez-vous confortablement et profitez du spectacle !</p>
        """,
    )
    await send_email(user.email, f"Theatarr — {session_name} commence !", html)


async def notify_vote_invitation(
    user: object,
    vote_name: str,
    vote_id: str,
    closes_at: datetime | None,
) -> None:
    """Notify user of a vote invitation."""
    if not getattr(user, "wants_email", lambda _: False)("vote_invitation"):
        return

    frontend_url = await _get_frontend_url()
    date_str = _format_datetime(closes_at)
    deadline_line = f"<p><strong>Date limite :</strong> {date_str}</p>" if date_str else ""

    html = _build_email_html(
        title="Votez pour le prochain film",
        content_html=f"""
            <p>Un vote est ouvert : <strong>{vote_name}</strong></p>
            {deadline_line}
            <p>Choisissez le film que vous souhaitez voir !</p>
        """,
        action_url=f"{frontend_url}/portal/votes/{vote_id}",
        action_label="Voter maintenant",
    )
    await send_email(user.email, f"Theatarr — Vote : {vote_name}", html)


async def notify_vote_closed(
    user: object,
    vote_name: str,
    winner_title: str | None,
) -> None:
    """Notify user of vote results."""
    if not getattr(user, "wants_email", lambda _: False)("vote_closed"):
        return

    winner_line = (
        f"<p>Le film gagnant est : <strong>{winner_title}</strong> 🎉</p>"
        if winner_title
        else "<p>Le vote est terminé. Consultez les résultats sur le portail.</p>"
    )

    html = _build_email_html(
        title="Résultats du vote",
        content_html=f"""
            <p>Le vote <strong>{vote_name}</strong> est maintenant clôturé.</p>
            {winner_line}
        """,
    )
    await send_email(user.email, f"Theatarr — Résultats : {vote_name}", html)


async def notify_quiz_invitation(
    user: object,
    quiz_name: str,
    quiz_id: str,
) -> None:
    """Notify user of a quiz invitation."""
    if not getattr(user, "wants_email", lambda _: False)("quiz_invitation"):
        return

    frontend_url = await _get_frontend_url()

    html = _build_email_html(
        title="Quiz en approche !",
        content_html=f"""
            <p>Vous êtes invité(e) au quiz <strong>{quiz_name}</strong>.</p>
            <p>Préparez-vous à tester vos connaissances !</p>
        """,
        action_url=f"{frontend_url}/portal/quiz/{quiz_id}",
        action_label="Rejoindre le quiz",
    )
    await send_email(user.email, f"Theatarr — Quiz : {quiz_name}", html)


async def notify_quiz_completed(
    user: object,
    quiz_name: str,
    quiz_id: str,
) -> None:
    """Notify user of quiz results."""
    if not getattr(user, "wants_email", lambda _: False)("quiz_completed"):
        return

    frontend_url = await _get_frontend_url()

    html = _build_email_html(
        title="Résultats du quiz",
        content_html=f"""
            <p>Le quiz <strong>{quiz_name}</strong> est terminé.</p>
            <p>Consultez le classement et vos résultats !</p>
        """,
        action_url=f"{frontend_url}/portal/quiz/{quiz_id}",
        action_label="Voir les résultats",
    )
    await send_email(user.email, f"Theatarr — Résultats quiz : {quiz_name}", html)
