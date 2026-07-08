"""Database layer for the IT Ticketing System.

All SQLite operations with parameterized queries.
Datetime stored as ISO 8601 strings.
"""

import os
import sqlite3
import uuid
from datetime import datetime

from config import BASE_DIR, DATABASE, STAFF_MEMBERS, UPLOAD_FOLDER

# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    priority TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pending',
    requester_name TEXT NOT NULL,
    requester_email TEXT NOT NULL,
    assigned_to TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    uploaded_at TEXT NOT NULL,
    FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS staff_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    email TEXT NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1,
    avatar_color TEXT NOT NULL
);
"""

# ---------------------------------------------------------------------------
# Connection helpers
# ---------------------------------------------------------------------------


def get_db():
    """Return a SQLite connection with row factory set to sqlite3.Row."""
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def close_db(conn):
    """Close a database connection safely."""
    if conn:
        conn.close()


# ---------------------------------------------------------------------------
# Initialization
# ---------------------------------------------------------------------------


def init_db():
    """Create all tables if they don't exist and seed staff members."""
    # Ensure upload folder exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    conn = get_db()
    try:
        with conn:
            conn.executescript(SCHEMA_SQL)

            # Seed staff members if table is empty
            cursor = conn.execute(
                "SELECT COUNT(*) AS count FROM staff_members"
            )
            row = cursor.fetchone()
            if row and row['count'] == 0:
                for member in STAFF_MEMBERS:
                    conn.execute(
                        """
                        INSERT INTO staff_members
                            (name, role, email, is_available, avatar_color)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                        (
                            member['name'],
                            member['role'],
                            member['email'],
                            1,
                            member['avatar_color'],
                        ),
                    )
    finally:
        close_db(conn)


# ---------------------------------------------------------------------------
# Ticket operations
# ---------------------------------------------------------------------------


def create_ticket(data, attachments):
    """Insert a new ticket with optional attachments.

    *data* is a dict with keys:
        title, description, priority, category,
        requester_name, requester_email
    *attachments* is a list of werkzeug FileStorage objects (may be empty).

    Returns the new ticket id (int).
    """
    now = datetime.utcnow().isoformat()

    conn = get_db()
    try:
        with conn:
            cursor = conn.execute(
                """
                INSERT INTO tickets
                    (title, description, priority, category, status,
                     requester_name, requester_email, assigned_to,
                     created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    data['title'],
                    data['description'],
                    data['priority'],
                    data['category'],
                    'Pending',
                    data['requester_name'],
                    data['requester_email'],
                    None,
                    now,
                    now,
                ),
            )
            ticket_id = cursor.lastrowid

            # Persist attachments
            for file_storage in attachments:
                original_name = file_storage.filename
                ext = original_name.rsplit('.', 1)[1].lower() \
                    if '.' in original_name else ''
                stored_name = f"{uuid.uuid4().hex}.{ext}" \
                    if ext else uuid.uuid4().hex
                file_path = os.path.join(UPLOAD_FOLDER, stored_name)
                file_storage.save(file_path)
                file_size = os.path.getsize(file_path)
                mime_type = file_storage.content_type or 'application/octet-stream'

                conn.execute(
                    """
                    INSERT INTO attachments
                        (ticket_id, filename, stored_filename, file_path,
                         file_size, mime_type, uploaded_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        ticket_id,
                        original_name,
                        stored_name,
                        file_path,
                        file_size,
                        mime_type,
                        now,
                    ),
                )
        return ticket_id
    finally:
        close_db(conn)


def _ticket_row_to_dict(row):
    """Convert a tickets row to a plain dict."""
    return {
        'id': row['id'],
        'title': row['title'],
        'description': row['description'],
        'priority': row['priority'],
        'category': row['category'],
        'status': row['status'],
        'requester_name': row['requester_name'],
        'requester_email': row['requester_email'],
        'assigned_to': row['assigned_to'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


def get_tickets(email=None, admin=False):
    """Get tickets filtered by email or all (admin).

    Returns a list of dicts ordered by created_at DESC.
    """
    conn = get_db()
    try:
        if admin:
            cursor = conn.execute(
                "SELECT * FROM tickets ORDER BY created_at DESC"
            )
        elif email:
            cursor = conn.execute(
                "SELECT * FROM tickets WHERE requester_email = ?"
                " ORDER BY created_at DESC",
                (email,),
            )
        else:
            cursor = conn.execute(
                "SELECT * FROM tickets ORDER BY created_at DESC"
            )
        rows = cursor.fetchall()
        return [_ticket_row_to_dict(row) for row in rows]
    finally:
        close_db(conn)


def get_ticket(ticket_id):
    """Get a single ticket with its attachments.

    Returns a dict with the ticket fields + an 'attachments' key,
    or None if not found.
    """
    conn = get_db()
    try:
        # Ticket
        cursor = conn.execute(
            "SELECT * FROM tickets WHERE id = ?", (ticket_id,)
        )
        row = cursor.fetchone()
        if not row:
            return None

        ticket = _ticket_row_to_dict(row)

        # Attachments
        cursor = conn.execute(
            """
            SELECT id, filename, file_size, uploaded_at
            FROM attachments
            WHERE ticket_id = ?
            ORDER BY uploaded_at
            """,
            (ticket_id,),
        )
        att_rows = cursor.fetchall()
        ticket['attachments'] = [
            {
                'id': r['id'],
                'filename': r['filename'],
                'file_size': r['file_size'],
                'uploaded_at': r['uploaded_at'],
            }
            for r in att_rows
        ]

        return ticket
    finally:
        close_db(conn)


def update_ticket_status(ticket_id, status, assigned_to=None):
    """Update ticket status and optionally assignment.

    Returns True if a row was updated, False otherwise.
    """
    now = datetime.utcnow().isoformat()
    conn = get_db()
    try:
        with conn:
            if assigned_to is not None:
                cursor = conn.execute(
                    """
                    UPDATE tickets
                    SET status = ?, assigned_to = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, assigned_to, now, ticket_id),
                )
            else:
                cursor = conn.execute(
                    """
                    UPDATE tickets
                    SET status = ?, updated_at = ?
                    WHERE id = ?
                    """,
                    (status, now, ticket_id),
                )
            return cursor.rowcount > 0
    finally:
        close_db(conn)


# ---------------------------------------------------------------------------
# Dashboard data
# ---------------------------------------------------------------------------


def get_dashboard_data():
    """Return staff availability + current tickets + stats.

    Returns a dict:
        {
            'staff': [
                {
                    'name', 'role', 'is_available', 'avatar_color',
                    'current_tickets': [...]
                }, ...
            ],
            'stats': {
                'total_tickets', 'open_tickets', 'in_progress_tickets',
                'resolved_tickets', 'avg_resolution_hours'
            }
        }
    """
    conn = get_db()
    try:
        # --- Staff list ---
        cursor = conn.execute(
            "SELECT name, role, is_available, avatar_color"
            " FROM staff_members ORDER BY name"
        )
        staff_rows = cursor.fetchall()
        staff_list = [
            {
                'name': r['name'],
                'role': r['role'],
                'is_available': bool(r['is_available']),
                'avatar_color': r['avatar_color'],
                'current_tickets': [],
            }
            for r in staff_rows
        ]

        # Build name -> staff dict for quick lookup
        staff_by_name = {s['name']: s for s in staff_list}

        # --- Current (non-resolved) tickets assigned to staff ---
        cursor = conn.execute(
            """
            SELECT id, title, assigned_to, status
            FROM tickets
            WHERE status != 'Resolved' AND assigned_to IS NOT NULL
            ORDER BY updated_at DESC
            """
        )
        ticket_rows = cursor.fetchall()
        for t in ticket_rows:
            name = t['assigned_to']
            if name in staff_by_name:
                staff_by_name[name]['current_tickets'].append(
                    {
                        'id': t['id'],
                        'title': t['title'],
                        'status': t['status'],
                    }
                )

        # --- Stats ---
        cursor = conn.execute("SELECT COUNT(*) AS c FROM tickets")
        total_tickets = cursor.fetchone()['c']

        cursor = conn.execute(
            "SELECT COUNT(*) AS c FROM tickets WHERE status = 'Pending'"
        )
        open_tickets = cursor.fetchone()['c']

        cursor = conn.execute(
            "SELECT COUNT(*) AS c FROM tickets WHERE status = 'In Progress'"
        )
        in_progress_tickets = cursor.fetchone()['c']

        cursor = conn.execute(
            "SELECT COUNT(*) AS c FROM tickets WHERE status = 'Resolved'"
        )
        resolved_tickets = cursor.fetchone()['c']

        # Average resolution time (hours) for resolved tickets
        cursor = conn.execute(
            """
            SELECT created_at, updated_at FROM tickets
            WHERE status = 'Resolved'
            """
        )
        resolved_rows = cursor.fetchall()
        avg_resolution_hours = 0.0
        if resolved_rows:
            total_hours = 0.0
            for r in resolved_rows:
                created = datetime.fromisoformat(r['created_at'])
                updated = datetime.fromisoformat(r['updated_at'])
                delta = updated - created
                total_hours += delta.total_seconds() / 3600.0
            avg_resolution_hours = round(
                total_hours / len(resolved_rows), 1
            )

        stats = {
            'total_tickets': total_tickets,
            'open_tickets': open_tickets,
            'in_progress_tickets': in_progress_tickets,
            'resolved_tickets': resolved_tickets,
            'avg_resolution_hours': avg_resolution_hours,
        }

        return {'staff': staff_list, 'stats': stats}
    finally:
        close_db(conn)


# ---------------------------------------------------------------------------
# Attachment helpers
# ---------------------------------------------------------------------------


def get_attachment(attachment_id):
    """Get attachment metadata for download.

    Returns a dict with:
        id, filename (original), stored_filename, file_path,
        file_size, mime_type, uploaded_at, ticket_id
    or None if not found.
    """
    conn = get_db()
    try:
        cursor = conn.execute(
            """
            SELECT id, ticket_id, filename, stored_filename,
                   file_path, file_size, mime_type, uploaded_at
            FROM attachments
            WHERE id = ?
            """,
            (attachment_id,),
        )
        row = cursor.fetchone()
        if not row:
            return None
        return {
            'id': row['id'],
            'ticket_id': row['ticket_id'],
            'filename': row['filename'],
            'stored_filename': row['stored_filename'],
            'file_path': row['file_path'],
            'file_size': row['file_size'],
            'mime_type': row['mime_type'],
            'uploaded_at': row['uploaded_at'],
        }
    finally:
        close_db(conn)
