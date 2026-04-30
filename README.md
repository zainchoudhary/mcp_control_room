# MCP Agent Dashboard

A full-stack AI agent control room where you can register MCP (Model Context Protocol) servers,
connect them, and chat with a LangGraph-powered Groq agent that uses those tools in real-time.

## Stack

| Layer      | Technology                          |
|------------|--------------------------------------|
| Backend    | FastAPI + Uvicorn                    |
| AI Agent   | LangGraph ReAct + LangChain          |
| LLM        | Groq hosted Llama models             |
| MCP Client | langchain-mcp-adapters               |
| Persistence| SQLite via aiosqlite                 |
| Frontend   | Vanilla JS / HTML / CSS (no build step) |

## Project Structure

```
mcp-agent-dashboard/
├── main.py          # FastAPI app + all routes
├── database.py      # SQLite async CRUD
├── mcp_manager.py   # MCP connection lifecycle + probing
├── agent.py         # LangGraph agent + streaming
├── requirements.txt
├── .env.example
└── static/
    └── index.html   # Dashboard UI
```

## Setup

```bash
# 1. Create virtualenv
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Set your API key
cp .env.example .env
# Edit .env and set GROQ_API_KEY

# 4. Run
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Open http://localhost:8000 in your browser.

## API Reference

| Method | Endpoint                          | Description                      |
|--------|-----------------------------------|----------------------------------|
| GET    | `/api/mcps`                       | List all registered MCPs         |
| POST   | `/api/mcps`                       | Register a new MCP server        |
| GET    | `/api/mcps/{id}`                  | Get MCP details                  |
| DELETE | `/api/mcps/{id}`                  | Delete an MCP                    |
| POST   | `/api/mcps/{id}/connect`          | Connect MCP (activate for agent) |
| POST   | `/api/mcps/{id}/disconnect`       | Disconnect MCP from agent        |
| POST   | `/api/mcps/{id}/probe`            | Probe MCP and list its tools     |
| POST   | `/api/sessions`                   | Create a new chat session        |
| GET    | `/api/sessions/{id}/messages`     | Get session message history      |
| POST   | `/api/chat/stream`                | Stream agent response (SSE)      |

## MCP Server Requirements

Your MCP server must expose an SSE endpoint (or streamable HTTP).
Popular transports supported:
- `sse` — Server-Sent Events at the given URL
- `streamable_http` — Streamable HTTP POST

Example test MCP servers:
- https://github.com/modelcontextprotocol/servers (official examples)
- Any server built with the MCP SDK that exposes `/sse`

## How It Works

1. **Register** — Add your MCP server URL + transport in the dashboard
2. **Probe** — Optionally test connectivity and preview available tools
3. **Connect** — Mark MCPs as active; they'll be loaded for every agent call
4. **Chat** — The LangGraph ReAct agent sees all connected tools and decides when to call them
5. **Stream** — Responses stream token-by-token via SSE; tool calls are shown inline

## Environment Variables

| Variable            | Required | Description               |
|---------------------|----------|---------------------------|
| `GROQ_API_KEY`      | Yes      | Your Groq API key         |
