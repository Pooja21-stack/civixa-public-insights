from fastapi import APIRouter, Request, Response
from twilio.twiml.messaging_response import MessagingResponse

router = APIRouter()


@router.post("/whatsapp")
async def whatsapp_webhook(request: Request):
    form = await request.form()
    body = form.get("Body", "")
    from_number = form.get("From", "")

    # Full WhatsApp handling implemented in messaging step
    resp = MessagingResponse()
    resp.message("Thank you for your message. Our team is processing your request.")
    return Response(content=str(resp), media_type="application/xml")
