import threading
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="Robot FastAPI Communication")

command_lock = threading.Lock()
pending_command = None


class CommandRequest(BaseModel):
    command: str


@app.get("/")
def home():
    return {"message": "Robot FastAPI Communication is running"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.post("/robot/command")
def set_command(request: CommandRequest):
    global pending_command

    command = request.command.strip().upper()

    with command_lock:
        pending_command = command

    return {
        "status": "accepted",
        "command": command
    }


@app.get("/robot/command")
def get_command():
    global pending_command

    with command_lock:
        command = pending_command
        pending_command = None

    return {"command": command or "NONE"}
