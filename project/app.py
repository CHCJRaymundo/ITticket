"""Main Flask application for the IT Ticketing System."""

import os
import sqlite3

from flask import (
    Flask,
    abort,
    g,
    jsonify,
    render_template,
    request,
    send_file,
)
from werkzeug.utils import secure_filename

from config import (
    ALLOWED_EXTENSIONS,
    DATABASE,
    MAX_CONTENT_LENGTH,
    SECRET_KEY,
    UPLOAD_FOLDER,
)
from database import (
    close_db,
    create_ticket,
    get_attachment,
    get_dashboard_data,
    get_db,
    get_ticket,
    get_tickets,
    init_db,
    update_ticket_status,
)

# ---------------------------------------------------------------------------
# App factory / config
# ---------------------------------------------------------------------------

app = Flask(__name__)
app.secret_key = SECRET_KEY
app.config['MAX_CONTENT_LENGTH'] = MAX_CONTENT_LENGTH
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER


# ---------------------------------------------------------------------------
# DB lifecycle
# ---------------------------------------------------------------------------

@app.before_request
def ensure_db():
    """Ensure the database is initialized before every request."""
    if not os.path.exists(DATABASE):
        init_db()
    g.db = get_db()


@app.teardown_appcontext
def cleanup_db(exception):
    """Close the DB connection after each request."""
    db = g.pop('db', None)
    if db is not None:
        close_db(db)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

ALLOWED_MIME_PREFIXES = {
    'image/',
    'application/pdf',
    'text/plain',
    'text/x-log',
    'application/zip',
}


def _allowed_file(filename, mimetype):
    """Check if a file is allowed based on extension and MIME type."""
    ext_ok = (
        '.' in filename
        and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )
    mime_ok = any(
        mimetype and mimetype.startswith(p) for p in ALLOWED_MIME_PREFIXES
    )
    return ext_ok and mime_ok


def _error(message, status=400):
    """Return a JSON error response."""
    response = jsonify({'success': False, 'error': message})
    response.status_code = status
    return response


# ---------------------------------------------------------------------------
# Page routes
# ---------------------------------------------------------------------------

@app.route('/')
def index():
    """Home: ticket submission form + user's ticket list."""
    return render_template('index.html', admin=False)


@app.route('/ticket/<int:id>')
def ticket_detail(id):
    """Detailed view of a single ticket (admin/IT view)."""
    return render_template('ticket_detail.html', ticket_id=id)


@app.route('/dashboard')
def dashboard():
    """Public team status dashboard."""
    return render_template('dashboard.html')


@app.route('/admin')
def admin():
    """Admin view showing ALL tickets."""
    return render_template('index.html', admin=True)


# ---------------------------------------------------------------------------
# API routes — Tickets
# ---------------------------------------------------------------------------

@app.route('/api/tickets', methods=['POST'])
def api_create_ticket():
    """Submit a new ticket with optional file attachments."""
    try:
        # --- Validate required text fields ---
        required_fields = [
            'title', 'description', 'priority', 'category',
            'requester_name', 'requester_email',
        ]
        data = {}
        for field in required_fields:
            value = request.form.get(field, '').strip()
            if not value:
                return _error(f"Missing required field: {field}")
            data[field] = value

        # Validate priority and category values
        if data['priority'] not in {'High', 'Medium', 'Low'}:
            return _error("Invalid priority. Must be High, Medium, or Low.")

        if data['category'] not in {'Hardware', 'Software', 'Network', 'Other'}:
            return _error(
                "Invalid category. Must be Hardware, Software, Network, or Other."
            )

        # --- Handle file uploads ---
        attachments = []
        uploaded_files = request.files.getlist('attachments')
        # Filter out empty file entries
        uploaded_files = [f for f in uploaded_files if f and f.filename]

        if len(uploaded_files) > 5:
            return _error("Maximum 5 attachments allowed.", 413)

        for file_storage in uploaded_files:
            filename = secure_filename(file_storage.filename)
            if not _allowed_file(filename, file_storage.content_type):
                return _error(
                    f"File type not allowed: {file_storage.filename}", 400
                )
            attachments.append(file_storage)

        # --- Create ticket ---
        ticket_id = create_ticket(data, attachments)
        return jsonify({'success': True, 'ticket_id': ticket_id}), 201

    except Exception as e:
        return _error(str(e), 500)


@app.route('/api/tickets', methods=['GET'])
def api_get_tickets():
    """Get tickets filtered by email or return all (admin)."""
    try:
        email = request.args.get('email', '').strip()
        admin_flag = request.args.get('admin', '0') == '1'

        if admin_flag:
            tickets = get_tickets(admin=True)
        elif email:
            tickets = get_tickets(email=email)
        else:
            tickets = get_tickets()

        return jsonify({'success': True, 'tickets': tickets})

    except Exception as e:
        return _error(str(e), 500)


@app.route('/api/ticket/<int:id>', methods=['GET'])
def api_get_ticket(id):
    """Get single ticket details with nested attachments."""
    try:
        ticket = get_ticket(id)
        if not ticket:
            return _error("Ticket not found.", 404)
        return jsonify({'success': True, 'ticket': ticket})

    except Exception as e:
        return _error(str(e), 500)


@app.route('/api/ticket/<int:id>/status', methods=['PUT'])
def api_update_status(id):
    """Update ticket status and/or assignment."""
    try:
        body = request.get_json(silent=True) or {}
        status = body.get('status', '').strip()

        if not status:
            return _error("Missing 'status' field.")

        if status not in {'Pending', 'In Progress', 'Resolved'}:
            return _error(
                "Invalid status. Must be Pending, In Progress, or Resolved."
            )

        assigned_to = body.get('assigned_to')
        if assigned_to is not None:
            assigned_to = assigned_to.strip() or None

        updated = update_ticket_status(id, status, assigned_to)
        if not updated:
            return _error("Ticket not found.", 404)

        return jsonify({'success': True})

    except Exception as e:
        return _error(str(e), 500)


# ---------------------------------------------------------------------------
# API routes — Attachments
# ---------------------------------------------------------------------------

@app.route('/api/attachments/<int:id>', methods=['GET'])
def api_download_attachment(id):
    """Serve an attachment download with the original filename."""
    try:
        attachment = get_attachment(id)
        if not attachment:
            return _error("Attachment not found.", 404)

        if not os.path.exists(attachment['file_path']):
            return _error("File not found on disk.", 404)

        return send_file(
            attachment['file_path'],
            mimetype=attachment['mime_type'],
            as_attachment=True,
            download_name=attachment['filename'],
        )

    except Exception as e:
        return _error(str(e), 500)


# ---------------------------------------------------------------------------
# API routes — Dashboard
# ---------------------------------------------------------------------------

@app.route('/api/dashboard', methods=['GET'])
def api_dashboard():
    """Return staff list + stats for the dashboard."""
    try:
        data = get_dashboard_data()
        return jsonify({'success': True, **data})

    except Exception as e:
        return _error(str(e), 500)


# ---------------------------------------------------------------------------
# CORS-friendly headers (development-friendly)
# ---------------------------------------------------------------------------

@app.after_request
def add_cors_headers(response):
    """Add CORS headers for development flexibility."""
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = (
        'GET, POST, PUT, DELETE, OPTIONS'
    )
    response.headers['Access-Control-Allow-Headers'] = (
        'Content-Type, Authorization'
    )
    return response


# ---------------------------------------------------------------------------
# Error handlers
# ---------------------------------------------------------------------------

@app.errorhandler(413)
def handle_request_entity_too_large(error):
    return _error("File too large. Maximum allowed is 16MB.", 413)


@app.errorhandler(404)
def handle_not_found(error):
    if request.path.startswith('/api/'):
        return _error("Not found.", 404)
    return render_template('index.html'), 404


@app.errorhandler(500)
def handle_internal_error(error):
    return _error("Internal server error.", 500)


# ---------------------------------------------------------------------------
# Main entrypoint
# ---------------------------------------------------------------------------

if __name__ == '__main__':
    init_db()
    app.run(debug=True, host='0.0.0.0', port=5000)
