#!/usr/bin/env python3
"""
Standalone MCP server built with FastMCP.

Run with:
  python mcp_server.py

The server exposes a set of simple utility tools over MCP.
"""

import json
import os
import random
import smtplib
import sys
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from dotenv import load_dotenv
from mcp.server.fastmcp import FastMCP

load_dotenv()

mcp = FastMCP("MCP-AI-Agent", host="127.0.0.1", port=9000)


@mcp.tool()
def get_current_time() -> str:
    """Return the current date and time."""
    return f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"


@mcp.tool()
def calculate(expression: str) -> str:
    """Evaluate a simple math expression."""
    try:
        builtins_dict = __builtins__ if isinstance(__builtins__, dict) else vars(__builtins__)
        allowed = {k: v for k, v in builtins_dict.items() if k in ("abs", "round", "min", "max", "sum", "pow")}
        result = eval(expression, {"__builtins__": allowed})
        return f"{expression} = {result}"
    except Exception as exc:
        return f"Error evaluating expression: {exc}"


@mcp.tool()
def reverse_text(text: str) -> str:
    """Reverse the given text."""
    return f"Original : {text}\nReversed : {text[::-1]}"


@mcp.tool()
def count_words(text: str) -> str:
    """Count words, characters, and sentences in the given text."""
    words = len(text.split())
    characters = len(text)
    sentences = text.count(".") + text.count("!") + text.count("?")
    return (
        f"Words      : {words}\n"
        f"Characters : {characters}\n"
        f"Sentences  : {sentences}"
    )


@mcp.tool()
def random_number(min_val: int = 1, max_val: int = 100) -> str:
    """Generate a random number between min_val and max_val."""
    number = random.randint(min_val, max_val)
    return f"Random number between {min_val} and {max_val}: {number}"


@mcp.tool()
def convert_temperature(value: float, from_unit: str) -> str:
    """Convert temperature between Celsius, Fahrenheit, and Kelvin."""
    from_unit = from_unit.upper()
    if from_unit == "C":
        fahrenheit = (value * 9 / 5) + 32
        kelvin = value + 273.15
        return f"{value}°C  →  {fahrenheit:.2f}°F  |  {kelvin:.2f}K"
    if from_unit == "F":
        celsius = (value - 32) * 5 / 9
        kelvin = celsius + 273.15
        return f"{value}°F  →  {celsius:.2f}°C  |  {kelvin:.2f}K"
    if from_unit == "K":
        celsius = value - 273.15
        fahrenheit = (celsius * 9 / 5) + 32
        return f"{value}K  →  {celsius:.2f}°C  |  {fahrenheit:.2f}°F"
    return f"Unknown unit: {from_unit}"


@mcp.tool()
def email_tool(to: list, subject: str, message: str, max_retries: int = 3, confirm: bool = False) -> str:
    """Send an email using SMTP."""
    smtp_host = os.getenv("SMTP_HOST")
    smtp_port = int(os.getenv("SMTP_PORT", 587))
    smtp_user = os.getenv("SMTP_USER")
    smtp_pass = os.getenv("SMTP_PASS")

    if not all([smtp_host, smtp_port, smtp_user, smtp_pass]):
        return json.dumps({"success": False, "error": "Missing SMTP credentials."})

    html_template = f"""
    <html>
        <body style='font-family: Arial; background:#f9f9f9;'>
            <div style='background:#fff;padding:20px;border-radius:8px;'>
                <h2>{subject}</h2>
                <p>{message}</p>
                <hr>
                <small>Sent by ToolChain AI | {smtp_user}</small>
            </div>
        </body>
    </html>
    """

    if not confirm:
        return json.dumps(
            {
                "success": False,
                "preview": {
                    "to": to,
                    "subject": subject,
                    "message": message,
                },
                "info": "Preview above. Set confirm=True to actually send the email.",
            }
        )

    msg = MIMEMultipart("alternative")
    msg["From"] = smtp_user
    msg["To"] = smtp_user
    msg["Bcc"] = ", ".join(to)
    msg["Subject"] = subject
    msg.attach(MIMEText(message, "plain"))
    msg.attach(MIMEText(html_template, "html"))

    attempt = 0
    while attempt < max_retries:
        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.starttls()
                server.login(smtp_user, smtp_pass)
                server.send_message(msg)
            return json.dumps({"success": True, "message": f"Email sent to {', '.join(to)}"})
        except Exception as exc:
            attempt += 1
            if attempt >= max_retries:
                return json.dumps({"success": False, "error": str(exc)})

    return json.dumps({"success": False, "error": "Failed after retries"})


if __name__ == "__main__":
    print("Starting MCP Server (FastMCP)...", file=sys.stderr)
    print("Listening on: http://127.0.0.1:9000", file=sys.stderr)
    print("Tools available:", file=sys.stderr)
    print("  1. get_current_time()", file=sys.stderr)
    print("  2. calculate(expression)", file=sys.stderr)
    print("  3. reverse_text(text)", file=sys.stderr)
    print("  4. count_words(text)", file=sys.stderr)
    print("  5. random_number(min_val, max_val)", file=sys.stderr)
    print("  6. convert_temperature(value, from_unit)", file=sys.stderr)
    print("  7. email_tool(to, subject, message, max_retries, confirm)", file=sys.stderr)
    print("JSON-RPC Protocol: ENABLED", file=sys.stderr)
    print("", file=sys.stderr)
    mcp.run(transport="sse")