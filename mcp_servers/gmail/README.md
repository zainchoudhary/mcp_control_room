# Gmail MCP Server (Standalone)

A fully standalone MCP server for Gmail, compliant with [Anthropic's Model Context Protocol](https://modelcontextprotocol.io).

## Key Design

- **Zero database dependencies** — no DB, no ORM, no connection strings
- **Credentials passed per-call** — the calling app provides `access_token`, `refresh_token`, `client_id`, `client_secret` as tool arguments
- **Auto-refresh** — if the access token is expired, it refreshes automatically using the refresh token
- **Portable** — can be used by any MCP client, not tied to any specific application

## Setup

```bash
pip install -r requirements.txt
```

## Run

```bash
python server.py              # default port 9002
python server.py --port 9005  # custom port
MCP_PORT=9005 python server.py
```

## Tools (15)

| # | Tool | Description |
|---|------|-------------|
| 1 | `search_emails` | Search with Gmail query syntax |
| 2 | `read_email` | Read full email content by ID |
| 3 | `send_email` | Send a new email |
| 4 | `reply_to_email` | Reply to an email thread |
| 5 | `get_inbox_summary` | Inbox overview with unread count |
| 6 | `modify_labels` | Add/remove labels |
| 7 | `list_labels` | List all Gmail labels |
| 8 | `create_draft` | Create an email draft |
| 9 | `trash_email` | Move email to trash |
| 10 | `get_thread` | Get full conversation thread |
| 11 | `forward_email` | Forward email to someone |
| 12 | `get_profile` | Get account profile info |
| 13 | `mark_as_read` | Mark email read/unread |
| 14 | `star_email` | Star/unstar an email |
| 15 | `get_attachment_info` | List email attachments |

## How Credentials Work

Every tool requires these 4 credential fields (hidden from the LLM by the calling app):

| Field | Description |
|-------|-------------|
| `access_token` | Google OAuth2 access token |
| `refresh_token` | Google OAuth2 refresh token |
| `client_id` | Google OAuth2 client ID |
| `client_secret` | Google OAuth2 client secret |

The calling application is responsible for:
1. Managing the OAuth2 flow (consent screen, token exchange)
2. Storing tokens in its own database
3. Passing them to tool calls at runtime

This server never stores, reads, or manages tokens itself.

## Protocol

- **Transport**: SSE (Server-Sent Events)
- **Standard**: Anthropic MCP
