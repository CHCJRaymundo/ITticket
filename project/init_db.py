#!/usr/bin/env python3
"""Standalone script to initialize the IT Ticketing System database.

Run this script manually to set up the database and seed staff members:

    python init_db.py

This creates:
    - tickets.db   (SQLite database with all tables)
    - uploads/     (directory for file attachments)
"""

from database import init_db

if __name__ == '__main__':
    print("Initializing IT Ticketing System database...")
    init_db()
    print("Done! Database ready at tickets.db")
