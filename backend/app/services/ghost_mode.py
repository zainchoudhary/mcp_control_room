"""Ghost mode — ephemeral chat sessions that never appear in history."""

GHOST_SESSION_TITLE = "__ghost__"


def is_ghost_session_title(title: str | None) -> bool:
    return (title or "") == GHOST_SESSION_TITLE
