"""Supabase client for Scolyax database operations.

This module provides a centralized Supabase connection and utilities for database operations.
"""

import logging
from typing import Optional
from supabase import create_client, Client
import os
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "")
# Para operaciones admin (DELETE, etc.) sin RLS
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("SUPABASE_URL or SUPABASE_KEY not configured. Database operations may fail.")

supabase: Optional[Client] = None
supabase_admin: Optional[Client] = None

def get_supabase_client() -> Client:
    """Get or create the Supabase client."""
    global supabase
    if supabase is None:
        if not SUPABASE_URL or not SUPABASE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be configured")
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    return supabase


def get_supabase_admin_client() -> Client:
    """Get or create the Supabase admin client (for operations that bypass RLS)."""
    global supabase_admin
    if supabase_admin is None:
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be configured")
        supabase_admin = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    return supabase_admin


def close_supabase_client():
    """Close the Supabase client."""
    global supabase
    if supabase is not None:
        supabase = None
