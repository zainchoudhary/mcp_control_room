"""
database.py - SQLite persistence layer for MCP registry
"""
import aiosqlite
import uuid
from typing import Optional
from datetime import datetime

DB_PATH = "mcp_agent.db"


async def init_db():
    """Initialize database and create tables."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS mcps (
                id          TEXT PRIMARY KEY,
                name        TEXT NOT NULL,
                url         TEXT NOT NULL,
                transport   TEXT NOT NULL DEFAULT 'sse',
                description TEXT,
                connected   INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS chat_sessions (
                id         TEXT PRIMARY KEY,
                created_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id         TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                role       TEXT NOT NULL,
                content    TEXT NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (session_id) REFERENCES chat_sessions(id)
            )
        """)
        await db.commit()


async def register_mcp(name: str, url: str, transport: str, description: Optional[str] = None) -> dict:
    """Register a new MCP server."""
    mcp_id = str(uuid.uuid4())
    created_at = datetime.utcnow().isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO mcps (id, name, url, transport, description, connected, created_at) VALUES (?,?,?,?,?,0,?)",
            (mcp_id, name, url, transport, description, created_at)
        )
        await db.commit()
    return {"id": mcp_id, "name": name, "url": url, "transport": transport,
            "description": description, "connected": False, "created_at": created_at}


async def list_mcps() -> list:
    """List all registered MCPs."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM mcps ORDER BY created_at DESC")
        rows = await cursor.fetchall()
        return [dict(r) | {"connected": bool(r["connected"])} for r in rows]


async def get_mcp(mcp_id: str) -> Optional[dict]:
    """Get a single MCP by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM mcps WHERE id = ?", (mcp_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        return dict(row) | {"connected": bool(row["connected"])}


async def set_mcp_connection(mcp_id: str, connected: bool):
    """Toggle MCP connection status."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("UPDATE mcps SET connected = ? WHERE id = ?", (1 if connected else 0, mcp_id))
        await db.commit()


async def delete_mcp(mcp_id: str):
    """Delete an MCP by ID."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("DELETE FROM mcps WHERE id = ?", (mcp_id,))
        await db.commit()


async def get_connected_mcps() -> list:
    """Get all connected MCPs."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM mcps WHERE connected = 1")
        rows = await cursor.fetchall()
        return [dict(r) | {"connected": True} for r in rows]


async def create_session() -> str:
    """Create a new chat session."""
    session_id = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("INSERT INTO chat_sessions (id, created_at) VALUES (?,?)",
                         (session_id, datetime.utcnow().isoformat()))
        await db.commit()
    return session_id


async def save_message(session_id: str, role: str, content: str):
    """Persist a chat message."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), session_id, role, content, datetime.utcnow().isoformat())
        )
        await db.commit()


async def get_session_messages(session_id: str) -> list:
    """Retrieve all messages for a session."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at",
            (session_id,)
        )
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]
