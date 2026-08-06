import bleach

# Tags allowed in note content (system-generated status change notes use HTML)
NOTE_ALLOWED_TAGS = ['p', 'strong', 'br', 'em', 'ul', 'li', 'ol']
# Strip everything from plain user input
ALLOWED_TAGS_USER = set()


def sanitize_html(text, allowed_tags=None):
    """
    Sanitize user-provided text, stripping unsafe HTML.

    System-generated notes (status changes) pass allowed_tags=NOTE_ALLOWED_TAGS
    so formatting like <p><strong>Status changed from ...</strong></p> is preserved.

    User input (titles, descriptions, user-written notes) uses the default
    allowed_tags=None → all HTML is stripped.
    """
    if text is None:
        return None
    if not isinstance(text, str):
        return text
    import html
    cleaned = bleach.clean(text, tags=allowed_tags or ALLOWED_TAGS_USER, strip=True)
    return html.unescape(cleaned)


def sanitize_dict(data, fields_to_sanitize=None):
    """Sanitize specific fields in a dictionary."""
    if not data:
        return data

    sanitized = data.copy()

    if fields_to_sanitize is None:
        for key, value in sanitized.items():
            if isinstance(value, str):
                sanitized[key] = sanitize_html(value)
    else:
        for field in fields_to_sanitize:
            if field in sanitized and isinstance(sanitized[field], str):
                sanitized[field] = sanitize_html(sanitized[field])

    return sanitized
