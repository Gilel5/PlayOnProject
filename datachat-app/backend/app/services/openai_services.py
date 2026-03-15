from openai import OpenAI
from app.core.config import settings

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# Sends a message to OpenAI and returns the response
def get_chat_response(message: str) -> str:
    completion = client.chat.completions.create(
        model="gpt-4o",
        messages=[{"role": "user", "content": message}],
    )
    return completion.choices[0].message.content