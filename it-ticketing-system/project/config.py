"""Configuration constants for the IT Ticketing System."""

import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB
DATABASE = os.path.join(BASE_DIR, 'tickets.db')
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'pdf', 'txt', 'log', 'zip'}
SECRET_KEY = 'dev-change-in-production'

# Staff members seeded on first DB init
STAFF_MEMBERS = [
    {
        'name': 'Alex Johnson',
        'role': 'IT Manager',
        'email': 'alex@company.local',
        'avatar_color': '#4F46E5'
    },
    {
        'name': 'Sarah Chen',
        'role': 'SysAdmin',
        'email': 'sarah@company.local',
        'avatar_color': '#059669'
    },
    {
        'name': 'Mike Williams',
        'role': 'Help Desk',
        'email': 'mike@company.local',
        'avatar_color': '#D97706'
    },
    {
        'name': 'Emily Rodriguez',
        'role': 'Network Engineer',
        'email': 'emily@company.local',
        'avatar_color': '#DC2626'
    },
    {
        'name': 'David Park',
        'role': 'Security Analyst',
        'email': 'david@company.local',
        'avatar_color': '#7C3AED'
    },
    {
        'name': 'Lisa Thompson',
        'role': 'Support Specialist',
        'email': 'lisa@company.local',
        'avatar_color': '#DB2777'
    }
]
