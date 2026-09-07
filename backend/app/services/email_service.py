import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


class EmailService:
    """Service for sending transactional emails via company SMTP."""

    @staticmethod
    def _get_config():
        """Read mail config from Flask app config."""
        from flask import current_app
        return {
            'server':       current_app.config.get('MAIL_SERVER', 'mail.ani.co.id'),
            'port':         current_app.config.get('MAIL_PORT', 587),
            'username':     current_app.config.get('MAIL_USERNAME', ''),
            'password':     current_app.config.get('MAIL_PASSWORD', ''),
            'from':         current_app.config.get('MAIL_FROM', 'IT Support <it-support@ani.co.id>'),
            'use_tls':      current_app.config.get('MAIL_USE_TLS', True),
            'frontend_url': current_app.config.get('FRONTEND_URL', 'http://localhost:5173'),
        }

    @staticmethod
    def send_ticket_confirmation(ticket):
        """
        Kirim email konfirmasi ke submitter setelah tiket berhasil dibuat.
        Nama penerima diambil dari ticket.submitter_name (diisi user di form submit ticket).
        Email hanya dikirim jika submitter_email tersedia.
        """
        if not ticket.submitter_email:
            logger.debug(f"[Email] Ticket {ticket.ticket_code}: no submitter_email, skip.")
            return

        try:
            cfg = EmailService._get_config()
            tracking_url = f"{cfg['frontend_url']}/ticket/{ticket.ticket_code}"

            subject = f"[{ticket.ticket_code}] Tiket IT Anda Berhasil Diterima"

            # --- Plain text fallback ---
            text_body = (
                f"Halo {ticket.submitter_name},\n\n"
                f"Tiket Anda telah berhasil dibuat dengan detail berikut:\n\n"
                f"  Kode Tiket : {ticket.ticket_code}\n"
                f"  Judul      : {ticket.title}\n"
                f"  Prioritas  : {ticket.priority.capitalize()}\n"
                f"  Status     : {ticket.status}\n\n"
                f"Gunakan kode tiket di atas untuk melacak status tiket Anda.\n"
                f"Link tracking: {tracking_url}\n\n"
                f"Tim IT Support akan segera menindaklanjuti laporan Anda.\n\n"
                f"Terima kasih,\n"
                f"— IT Support Aero Nusantara Indonesia\n"
            )

            # --- HTML body ---
            html_body = f"""<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Konfirmasi Tiket IT</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f9;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f9;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#1e40af;padding:28px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;">
                IT Support &mdash; ANI
              </h1>
              <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">
                Sistem Manajemen Tiket Internal
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;">
                Halo <strong>{ticket.submitter_name}</strong>,
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.6;">
                Tiket Anda telah berhasil diterima oleh tim IT Support.
                Tim kami akan segera menindaklanjuti laporan Anda.
              </p>

              <!-- Ticket Code Badge -->
              <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;
                          padding:16px 20px;margin-bottom:24px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;
                           text-transform:uppercase;letter-spacing:0.05em;">Kode Tiket Anda</p>
                <p style="margin:0;font-size:28px;font-weight:700;color:#1e40af;
                           letter-spacing:0.1em;">{ticket.ticket_code}</p>
              </div>

              <!-- Detail Table -->
              <table width="100%" cellpadding="0" cellspacing="0"
                     style="border-collapse:collapse;margin-bottom:24px;">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;
                              font-size:13px;color:#6b7280;width:35%;">Judul</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;
                              font-size:13px;color:#111827;font-weight:500;">{ticket.title}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;
                              font-size:13px;color:#6b7280;">Prioritas</td>
                  <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;
                              font-size:13px;color:#111827;">{ticket.priority.capitalize()}</td>
                </tr>
                <tr>
                  <td style="padding:10px 0;font-size:13px;color:#6b7280;">Status</td>
                  <td style="padding:10px 0;font-size:13px;color:#111827;">{ticket.status}</td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="{tracking_url}"
                   style="display:inline-block;background:#1e40af;color:#ffffff;
                           text-decoration:none;padding:12px 28px;border-radius:6px;
                           font-size:14px;font-weight:600;">
                  Lacak Status Tiket &rarr;
                </a>
              </div>

              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Atau salin link berikut ke browser:<br>
                <a href="{tracking_url}" style="color:#3b82f6;">{tracking_url}</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:16px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
                Email ini dikirim otomatis oleh sistem IT Helpdesk &mdash; ANI.<br>
                Harap tidak membalas email ini.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""

            # --- Build MIME message ---
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From']    = cfg['from']
            msg['To']      = ticket.submitter_email

            msg.attach(MIMEText(text_body, 'plain', 'utf-8'))
            msg.attach(MIMEText(html_body, 'html', 'utf-8'))

            # --- Send via SMTP ---
            if cfg['use_tls']:
                server = smtplib.SMTP(cfg['server'], cfg['port'], timeout=10)
                server.ehlo()
                server.starttls()
                server.ehlo()
            else:
                # SSL (port 465)
                server = smtplib.SMTP_SSL(cfg['server'], cfg['port'], timeout=10)

            if cfg['username'] and cfg['password']:
                server.login(cfg['username'], cfg['password'])

            server.sendmail(cfg['from'], ticket.submitter_email, msg.as_string())
            server.quit()

            logger.info(
                f"[Email] Konfirmasi tiket {ticket.ticket_code} "
                f"terkirim ke {ticket.submitter_email}"
            )

        except Exception as e:
            # Non-blocking: email gagal tidak menggagalkan pembuatan tiket
            logger.error(
                f"[Email] Gagal kirim konfirmasi tiket {ticket.ticket_code}: {e}"
            )
