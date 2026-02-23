import os
import uuid
from werkzeug.utils import secure_filename
from flask import current_app

class FileService:
    ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif'}

    @staticmethod
    def is_allowed_file(filename):
        return os.path.splitext(filename)[1].lower() in FileService.ALLOWED_EXTENSIONS

    @staticmethod
    def save_file(file_storage, folder):
        """
        Save a file to the specified folder within static/uploads.
        
        Args:
            file_storage: The FileStorage object from flask request.
            folder: The subfolder in static/uploads (e.g. 'tickets', 'notes').
            
        Returns:
            The relative URL to the saved file or None if failed.
        """
        if not file_storage:
            return None
            
        filename = secure_filename(file_storage.filename)
        if not filename:
            return None
            
        ext = os.path.splitext(filename)[1].lower()
        if not FileService.is_allowed_file(filename):
            return None
            
        new_filename = f"{uuid.uuid4()}{ext}"
        upload_dir = os.path.join(current_app.root_path, 'static', 'uploads', folder)
        
        if not os.path.exists(upload_dir):
            os.makedirs(upload_dir, exist_ok=True)
            
        image_path = os.path.join(upload_dir, new_filename)
        file_storage.save(image_path)
        
        return f"/static/uploads/{folder}/{new_filename}"
