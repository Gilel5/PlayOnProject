from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.openai_services import get_chat_response

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatRequest(BaseModel):
    message: str

# OpenAI endpoint (for chatting)
@router.post("/", response_model=dict)
def chat(request: ChatRequest):
    try:
        reply = get_chat_response(request.message)
        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")