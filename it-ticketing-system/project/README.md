# IT Ticketing System

A complete internal IT ticketing system built with Python Flask and SQLite. Designed for local deployment on your own server with zero cloud dependencies.

## Features

- **Ticket Submission** — Internal users submit tickets via a web form with title, description, priority (High/Medium/Low), category (Hardware/Software/Network/Other), and file attachments
- **My Tickets** — Users can view all their submitted tickets and their current status (Pending / In Progress / Resolved)
- **Team Status Dashboard** — Publicly visible page showing which IT team members are available, who is busy, and what tickets each person is actively working on. Auto-refreshes every 30 seconds
- **File Attachments** — Users can upload screenshots, log files, PDFs, and ZIP files. IT staff can download attachments from any ticket
- **Admin Panel** — IT staff can view all tickets, update status, assign tickets to team members, and see ticket details

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.8+ + Flask |
| Database | SQLite3 (stdlib, no extra install) |
| Frontend | HTML5 + CSS3 + Vanilla JavaScript |
| Templating | Jinja2 (via Flask) |
| File Uploads | Flask request.files + UUID storage |

## Quick Start (3 Steps)

### Step 1: Install Python Dependencies

```bash
cd it-ticketing-system
pip install -r requirements.txt
```

> **Note:** The only dependency is Flask. SQLite is included with Python's standard library.

### Step 2: Initialize the Database

```bash
python init_db.py
```

This creates the SQLite database (`tickets.db`) and seeds it with 6 pre-configured IT staff members:
- Alex Johnson (IT Manager)
- Sarah Chen (SysAdmin)
- Mike Williams (Help Desk)
- Emily Rodriguez (Network Engineer)
- David Park (Security Analyst)
- Lisa Thompson (Support Specialist)

### Step 3: Start the Server

```bash
python app.py
```

The application will start on **http://0.0.0.0:5000**

Open your browser and navigate to `http://<your-server-ip>:5000`

---

## Production Deployment

For production use on your local server, you should run the app behind a proper WSGI server.

### Option A: Using Gunicorn (Recommended)

1. Install Gunicorn:
```bash
pip install gunicorn
```

2. Start with Gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

This runs 4 worker processes. Adjust `-w` based on your server's CPU cores.

### Option B: Using systemd (Linux Server)

Create a service file at `/etc/systemd/system/it-ticketing.service`:

```ini
[Unit]
Description=IT Ticketing System
After=network.target

[Service]
User=www-data
Group=www-data
WorkingDirectory=/opt/it-ticketing-system
Environment="PATH=/opt/it-ticketing-system/venv/bin"
ExecStart=/opt/it-ticketing-system/venv/bin/gunicorn -w 4 -b 0.0.0.0:5000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl daemon-reload
sudo systemctl enable it-ticketing
sudo systemctl start it-ticketing
```

### Option C: Run in Background with nohup

For a simple background process:
```bash
nohup python app.py > app.log 2>&1 &
```

To stop later:
```bash
pkill -f "python app.py"
```

---

## File Structure

```
it-ticketing-system/
├── app.py              # Main Flask app — all routes and API endpoints
├── config.py           # Configuration (paths, limits, constants)
├── database.py         # Database layer — SQLite operations
├── init_db.py          # One-time database initialization script
├── requirements.txt    # Python dependencies
├── README.md           # This file
├── tickets.db          # SQLite database (created after init)
├── uploads/            # File attachments storage (created automatically)
├── static/
│   ├── css/
│   │   └── style.css   # All styles — responsive, modern design
│   └── js/
│       └── app.js      # All client-side JavaScript
└── templates/
    ├── base.html       # Master layout template
    ├── index.html      # Home — ticket form + my tickets list
    ├── dashboard.html  # Team status dashboard
    └── ticket_detail.html  # Single ticket detail / admin view
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Home page (ticket submission + my tickets) |
| `GET` | `/dashboard` | Team status dashboard |
| `GET` | `/admin` | Admin panel (all tickets) |
| `GET` | `/ticket/<id>` | Single ticket detail page |
| `POST` | `/api/tickets` | Submit a new ticket (multipart/form-data) |
| `GET` | `/api/tickets` | List tickets (`?email=` or `?admin=1`) |
| `GET` | `/api/ticket/<id>` | Get single ticket details |
| `PUT` | `/api/ticket/<id>/status` | Update ticket status & assignment |
| `GET` | `/api/attachments/<id>` | Download an attachment |
| `GET` | `/api/dashboard` | Get dashboard data (staff + stats) |

---

## Customizing Staff Members

To change the pre-seeded IT staff members, edit `config.py` and modify the `STAFF_MEMBERS` list. Then re-initialize:

```bash
rm tickets.db
python init_db.py
```

---

## Security Notes

- **Change `SECRET_KEY`** in `config.py` before production use
- The app runs on `0.0.0.0` — it will be accessible from any machine on your network
- For intranet-only deployment, bind to your internal IP or use a firewall
- File uploads are restricted by extension and MIME type (images, PDFs, text files, ZIP)
- Maximum file size: 16 MB per file, 5 files per ticket
- All SQL queries use parameterized statements (safe against injection)

---

## Port Conflicts

If port 5000 is already in use, change the port in `app.py`:

```python
app.run(debug=False, host='0.0.0.0', port=8080)  # Use port 8080
```

Or set the environment variable:
```bash
export FLASK_PORT=8080
python app.py
```

---

## Support

This system was built through Vibe Coding (conversational development). If you need changes or additional features, just ask!
