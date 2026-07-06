import json

def sanitize_html(text):
    """
    Pass-through function.
    In this project, XSS protection is handled automatically by the React frontend during rendering.
    We store the raw strings in the database to prevent double-escaping issues (like & becoming &amp;).
    """
    if text is None:
        return None
    if not isinstance(text, str):
        return text
    return str(text)

def sanitize_dict(data, fields_to_sanitize=None):
    """
    Sanitize specific fields in a dictionary.
    """
    if not data:
        return data
        
    sanitized = data.copy()
    
    # If no fields specified, sanitize all string values
    if fields_to_sanitize is None:
        for key, value in sanitized.items():
            if isinstance(value, str):
                sanitized[key] = sanitize_html(value)
    else:
        for field in fields_to_sanitize:
            if field in sanitized and isinstance(sanitized[field], str):
                sanitized[field] = sanitize_html(sanitized[field])
                
    return sanitized
