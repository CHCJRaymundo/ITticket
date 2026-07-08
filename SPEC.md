# IT Ticketing System — Technical Specification

## 1. Overview

A complete internal IT ticketing system built with Python Flask, SQLite, and vanilla HTML/CSS/JS. Designed for local deployment on an internal server with zero cloud dependencies.

## 2. Project Structure

```
it-ticketing-system/
├── app.py                 # Main Flask application — all routes
├── database.py            # Database models, schema, init functions
├── config.py              # Configuration constants
├── requirements.txt       # Python dependencies
├── init_db.py             # Database initialization script
├── README.md              # Deployment instructions
├── uploads/               # File upload storage (created automatically)
│   └── .gitkeep
├── static/
│   ├── css/
│   │   └── style.css      # All application styles
│   └── js/
│       └── app.js         # All client-side JavaScript
└── templates/
    ├── base.html          # Master layout template (Jinja2)
    ├── index.html         # Home: Submit new ticket + view my tickets
    ├── ticket_detail.html # Single ticket detail view (for IT staff)
    └── dashboard.html     # Team Status Dashboard (publicly visible)
```

## 3. Technology Stack

- **Backend**: Python 3.8+, Flask 2.3+
- **Database**: SQLite3 (via `sqlite3` stdlib)
- **Frontend**: HTML5 + CSS3 + Vanilla JavaScript (no frameworks)
- **Templating**: Jinja2 (via Flask)
- **File Uploads**: Flask `request.files` + Werkzeug secure_filename

## 4. Database Schema

### 4.1 Table: `tickets`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, AUTOINCREMENT | Unique ticket ID |
| title | TEXT | NOT NULL | Brief ticket title |
| description | TEXT | NOT NULL | Detailed description |
| priority | TEXT | NOT NULL | 'High', 'Medium', 'Low' |
| category | TEXT | NOT NULL | 'Hardware', 'Software', 'Network', 'Other' |
| status | TEXT | NOT NULL, DEFAULT 'Pending' | 'Pending', 'In Progress', 'Resolved' |
| requester_name | TEXT | NOT NULL | Name of person submitting |
| requester_email | TEXT | NOT NULL | Email for notifications |
| assigned_to | TEXT | NULL | IT staff member name |
| created_at | TEXT | NOT NULL | ISO 8601 datetime string |
| updated_at | TEXT | NOT NULL | ISO 8601 datetime string |

### 4.2 Table: `attachments`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, AUTOINCREMENT | Unique attachment ID |
| ticket_id | INTEGER | NOT NULL, FK → tickets.id | CASCADE on delete |
| filename | TEXT | NOT NULL | Original uploaded filename |
| stored_filename | TEXT | NOT NULL | UUID-based stored filename |
| file_path | TEXT | NOT NULL | Relative path from project root |
| file_size | INTEGER | NOT NULL | Size in bytes |
| mime_type | TEXT | NOT NULL | MIME type |
| uploaded_at | TEXT | NOT NULL | ISO 8601 datetime |

### 4.3 Table: `staff_members`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK, AUTOINCREMENT | Unique staff ID |
| name | TEXT | NOT NULL, UNIQUE | Staff member full name |
| role | TEXT | NOT NULL | Job title (e.g., 'SysAdmin', 'Help Desk') |
| email | TEXT | NOT NULL | Contact email |
| is_available | INTEGER | NOT NULL, DEFAULT 1 | 1 = available, 0 = busy |
| avatar_color | TEXT | NOT NULL | Hex color for avatar badge (pre-assigned) |

### 4.4 Pre-seeded Staff Data (6 members)

Seed on first DB init:

| name | role | email | avatar_color |
|------|------|-------|-------------|
| Alex Johnson | IT Manager | alex@company.local | #4F46E5 |
| Sarah Chen | SysAdmin | sarah@company.local | #059669 |
| Mike Williams | Help Desk | mike@company.local | #D97706 |
| Emily Rodriguez | Network Engineer | emily@company.local | #DC2626 |
| David Park | Security Analyst | david@company.local | #7C3AED |
| Lisa Thompson | Support Specialist | lisa@company.local | #DB2777 |

## 5. API Routes (Flask)

### 5.1 Page Routes (render_template)

| Route | Method | Template | Description |
|-------|--------|----------|-------------|
| `/` | GET | index.html | Home: ticket submission form + user's ticket list |
| `/ticket/<int:id>` | GET | ticket_detail.html | Detailed view of a single ticket (admin/IT view) |
| `/dashboard` | GET | dashboard.html | Public team status dashboard |
| `/admin` | GET | index.html (admin mode) | Admin view showing ALL tickets |

### 5.2 API Routes (JSON)

| Route | Method | Description | Request | Response |
|-------|--------|-------------|---------|----------|
| `/api/tickets` | POST | Submit new ticket | FormData (multipart) | `{"success": true, "ticket_id": N}` |
| `/api/tickets` | GET | Get tickets (filtered) | Query: `?email=` or `?admin=1` | JSON list of tickets |
| `/api/ticket/<int:id>` | GET | Get single ticket details | — | JSON ticket + attachments |
| `/api/ticket/<int:id>/status` | PUT | Update ticket status | JSON: `{"status": "...", "assigned_to": "..."}` | `{"success": true}` |
| `/api/attachments/<int:id>` | GET | Download attachment | — | File download |
| `/api/dashboard` | GET | Get dashboard data | — | JSON: `{staff: [...], stats: {...}}` |

### 5.3 Route Details

**POST /api/tickets**
- Accepts multipart/form-data
- Fields: `title`, `description`, `priority`, `category`, `requester_name`, `requester_email`
- Optional file field: `attachments` (multiple files allowed, max 5, max 16MB each)
- Creates ticket record, saves attachments to `uploads/` with UUID filenames
- Returns `{"success": true, "ticket_id": <id>}` or `{"success": false, "error": "..."}`

**GET /api/tickets**
- With `?email=<email>`: returns only that requester's tickets, ordered by created_at DESC
- With `?admin=1`: returns ALL tickets (for admin panel), ordered by created_at DESC

**GET /api/ticket/<int:id>**
- Returns full ticket details including nested `attachments` array
- Each attachment has: `id`, `filename` (original name), `file_size`, `uploaded_at`
- Attachment download URL: `/api/attachments/<attachment_id>`

**PUT /api/ticket/<int:id>/status**
- Body: `{"status": "In Progress|Resolved"}` or `{"status": "...", "assigned_to": "Staff Name"}`
- Updates ticket status and optionally assignment
- Updates `updated_at` timestamp

**GET /api/dashboard**
- Returns: `{"staff": [...], "stats": {...}}`
- Each staff object: `name`, `role`, `is_available`, `avatar_color`, `current_tickets: [...]`
- `current_tickets` lists active (non-resolved) tickets assigned to that staff member
- `stats`: `{total_tickets, open_tickets, in_progress_tickets, resolved_tickets, avg_resolution_hours}`

## 6. Page Designs

### 6.1 base.html — Master Layout

Structure:
```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{% block title %}IT Ticketing System{% endblock %}</title>
    <link rel="stylesheet" href="{{ url_for('static', filename='css/style.css') }}">
</head>
<body>
    <nav class="navbar">
        <div class="nav-brand">
            <span class="logo-icon">🎫</span>
            <span class="logo-text">IT Support</span>
        </div>
        <div class="nav-links">
            <a href="/" class="nav-link active">Submit Ticket</a>
            <a href="/dashboard" class="nav-link">Team Dashboard</a>
            <a href="/admin" class="nav-link admin-link">Admin Panel</a>
        </div>
    </nav>
    
    <main class="main-content">
        {% block content %}{% endblock %}
    </main>
    
    <footer class="footer">
        <p>Internal IT Ticketing System — Local Deployment</p>
    </footer>
    
    <script src="{{ url_for('static', filename='js/app.js') }}"></script>
    {% block extra_js %}{% endblock %}
</body>
</html>
```

### 6.2 index.html — Home Page (Two-column layout)

Left column (40%): Submit Ticket Form
- Card with header: "Submit New Ticket"
- Fields:
  - Your Name (text input, required)
  - Your Email (email input, required)
  - Ticket Title (text input, required, max 100)
  - Category (select: Hardware, Software, Network, Other)
  - Priority (radio buttons: High/Medium/Low, styled as selectable cards)
  - Description (textarea, required, rows=5)
  - Attachments (file input, multiple, accept="image/*,.pdf,.txt,.log,.zip", max 5 files)
  - Submit button (primary, full width)
- Show success/error messages in a toast notification area

Right column (60%): My Tickets
- Header: "My Tickets" with email filter input
- Filter input: "Enter your email to view your tickets"
- "Load My Tickets" button
- Ticket cards list (displayed after email entered):
  - Each card shows: Ticket ID badge, Title, Category badge, Priority badge (colored), Status badge, Created date
  - Cards are clickable → expand to show description + attachments
  - Color coding: High=red, Medium=amber, Low=green
  - Status: Pending=gray, In Progress=blue, Resolved=green

### 6.3 dashboard.html — Team Status Dashboard

Full-width layout:

Top Stats Bar (4 cards in a row):
- Total Tickets
- Open (Pending)
- In Progress
- Resolved

Main Content — Staff Availability Grid:
- Header: "Team Availability"
- Grid of staff cards (2-3 per row, responsive):
  - Each card:
    - Avatar circle with initials + color from avatar_color
    - Name
    - Role (subtitle)
    - Availability badge: "Available" (green) or "Busy" (amber)
    - If busy: list of current tickets they're working on
      - Ticket #ID — Title (truncated)
    - Card border changes: green tint if available, amber tint if busy

Auto-refresh: Every 30 seconds, fetch fresh dashboard data.

### 6.4 ticket_detail.html — Admin Ticket Detail

(Used by IT staff to view and manage individual tickets)

Two-column layout:

Left (65%): Ticket Information
- Breadcrumb: "All Tickets > Ticket #X"
- Ticket header: #ID — Title
- Meta bar: Category badge | Priority badge | Created by | Date
- Description box (well-formatted, preserved line breaks)
- Attachments section: list with download links for each file

Right (35%): Actions Panel
- Status selector dropdown (Pending, In Progress, Resolved)
- Assign to selector (dropdown of staff members)
- "Update Ticket" button
- Activity log (simplified: shows status changes with timestamps)
- Quick stats: time since created, time since last update

## 7. Visual Design System

### 7.1 Color Palette

```
--primary: #2563EB          /* Main blue */
--primary-dark: #1D4ED8     /* Hover state */
--primary-light: #DBEAFE    /* Light backgrounds */
--success: #059669          /* Resolved, available */
--success-light: #D1FAE5
--warning: #D97706          /* Medium priority, busy */
--warning-light: #FEF3C7
--danger: #DC2626           /* High priority */
--danger-light: #FEE2E2
--gray-50: #F9FAFB          /* Page background */
--gray-100: #F3F4F6         /* Card backgrounds */
--gray-200: #E5E7EB         /* Borders */
--gray-300: #D1D5DB
--gray-500: #6B7280         /* Secondary text */
--gray-700: #374151         /* Primary text */
--gray-900: #111827         /* Headings */
--white: #FFFFFF
```

### 7.2 Typography

- Font family: `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`
- Headings: 600 weight
- Body: 400 weight, 14px base
- Page title: 24px
- Card title: 18px
- Body text: 14px
- Small/caption: 12px

### 7.3 Spacing

- Page padding: 24px
- Card padding: 20px
- Card border-radius: 12px
- Card shadow: `0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)`
- Input border-radius: 8px
- Button border-radius: 8px
- Gap between cards: 16px
- Section gap: 24px

### 7.4 Component Styles

**Navbar:**
- Background: white
- Border-bottom: 1px solid gray-200
- Height: 60px
- Padding: 0 24px
- Brand: logo-icon (20px) + logo-text (18px, 600 weight, primary color)
- Links: 14px, gray-700, padding 8px 16px, border-radius 6px
- Active link: primary-light background, primary color text
- Hover: gray-100 background

**Cards:**
- Background: white
- Border-radius: 12px
- Padding: 20px
- Shadow as defined above
- Hover on interactive cards: slightly elevated shadow

**Form Inputs:**
- Border: 1px solid gray-300
- Border-radius: 8px
- Padding: 10px 14px
- Font-size: 14px
- Focus: 2px primary color ring, border primary

**Buttons:**
- Primary: background primary, white text, padding 10px 20px, border-radius 8px, font-weight 500
- Hover: primary-dark background
- Disabled: opacity 0.5, cursor not-allowed

**Badges (Priority/Category/Status):**
- Padding: 4px 10px
- Border-radius: 9999px (pill shape)
- Font-size: 12px
- Font-weight: 500
- High priority: danger-light bg, danger text
- Medium priority: warning-light bg, warning text
- Low priority: success-light bg, success text
- Status Pending: gray-100 bg, gray-500 text
- Status In Progress: primary-light bg, primary text
- Status Resolved: success-light bg, success text

**Toast Notifications:**
- Position: fixed top-right, 24px from edges
- Slide-in animation from right
- Success: green border-left, check icon
- Error: red border-left, X icon
- Auto-dismiss after 5 seconds

## 8. JavaScript Functionality

### 8.1 Global (app.js)

**Toast System:**
- `showToast(message, type)` — type is 'success' or 'error'
- Creates toast element, appends to body, auto-removes after 5s
- Slide-in animation via CSS transition

**Navigation Active State:**
- On page load, highlight current page in navbar based on URL path

### 8.2 index.html Page JS

**Ticket Form Submission:**
- Listen for form submit
- Collect form data into FormData (for file upload support)
- POST to `/api/tickets`
- On success: showToast("Ticket submitted!"), reset form, reload ticket list
- On error: showToast(error, 'error')

**Load My Tickets:**
- User enters email, clicks "Load My Tickets"
- GET `/api/tickets?email=<email>`
- Render ticket cards into the right column
- Each card expandable to show full description + attachments
- Store email in localStorage for convenience
- If admin mode (`/admin`): load all tickets via `?admin=1`

**Ticket Card Expansion:**
- Click card header → toggle description + attachments visibility
- Attachment links point to `/api/attachments/<id>`

### 8.3 dashboard.html Page JS

**Load Dashboard Data:**
- On page load: `fetch('/api/dashboard').then(render)`
- Render stats cards
- Render staff grid with availability and current tickets

**Auto-refresh:**
- `setInterval(() => loadDashboard(), 30000)` — refresh every 30 seconds
- Update timestamp showing "Last updated: X seconds ago"

### 8.4 ticket_detail.html Page JS

**Load Ticket Details:**
- Extract ticket ID from URL path
- GET `/api/ticket/<id>`
- Render all ticket info, description, attachments

**Update Status/Assignment:**
- Dropdown change → enable "Update" button
- On click: PUT `/api/ticket/<id>/status` with JSON body
- On success: showToast, reload ticket data

## 9. File Upload Specifications

- Upload folder: `uploads/` (relative to project root)
- Max file size: 16 MB per file
- Max files per ticket: 5
- Allowed MIME types: `image/*`, `application/pdf`, `text/plain`, `text/x-log`, `application/zip`
- Storage: Files saved with UUID4 filename, original name stored in DB
- Download: Served via `/api/attachments/<id>` with original filename in Content-Disposition header

## 10. Error Handling

- All API routes return JSON with `{"success": false, "error": "message"}` on errors
- HTTP 400: Bad request (missing fields, validation errors)
- HTTP 404: Ticket or attachment not found
- HTTP 413: File too large
- HTTP 500: Server error
- Frontend: Errors shown via toast notifications

## 11. Configuration (config.py)

```python
import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
DATABASE = os.path.join(BASE_DIR, 'tickets.db')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'log', 'zip'}
SECRET_KEY = 'dev-change-in-production'
```

## 12. Initialization

- On first run, `database.py` should create tables if they don't exist
- Seed staff_members table with 6 pre-defined staff members
- Create `uploads/` directory if it doesn't exist
