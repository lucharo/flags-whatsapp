import os
import random
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client
from rapidfuzz import fuzz
from cloudflare.workers import Response

from src.flag_data import FLAGS
from src.llm_utils import explain_flag

client = Client(os.environ.get("TWILIO_ACCOUNT_SID"), os.environ.get("TWILIO_AUTH_TOKEN"))
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")
THRESHOLD = 80
sessions = {}


def send_game_mode_options(to_number: str) -> None:
    if not (client and TWILIO_WHATSAPP_NUMBER):
        return
    client.messages.create(
        from_=f"whatsapp:{TWILIO_WHATSAPP_NUMBER}",
        to=to_number,
        interactive={
            "type": "list",
            "header": {"type": "text", "text": "Welcome!"},
            "body": {"text": "Choose a game mode"},
            "action": {
                "button": "Select",
                "sections": [
                    {
                        "title": "Modes",
                        "rows": [
                            {"id": "flag", "title": "Guess the Flag"},
                            {"id": "capital", "title": "Guess the Capital"},
                        ],
                    }
                ],
            },
        },
    )


def handle(form: dict) -> str:
    incoming_msg = form.get("Body", "").strip()
    from_number = form.get("From", "")
    list_reply = form.get("ListReplyId", "").lower()

    resp = MessagingResponse()

    if incoming_msg.lower() == "start" or from_number not in sessions:
        sessions[from_number] = {"mode": None, "item": None}
        send_game_mode_options(from_number)
        return str(resp)

    session = sessions.get(from_number)

    chosen = list_reply or incoming_msg.lower()
    if session and session["mode"] is None and chosen in {"flag", "capital"}:
        session["mode"] = chosen
        item = random.choice(FLAGS)
        session["item"] = item
        if chosen == "flag":
            resp.message(f"Guess the country: {item['emoji']}")
        else:
            resp.message(f"What is the capital of {item['country']}?")
        return str(resp)

    if incoming_msg.lower() in {"explain", "hint", "why"} and session:
        country = session["item"]["country"]
        try:
            explanation = explain_flag(country)
        except Exception:
            explanation = "LLM explanation is not available."
        resp.message(explanation)
        return str(resp)

    if session and session["mode"] == "flag":
        country = session["item"]["country"]
        if fuzz.ratio(incoming_msg.lower(), country.lower()) >= THRESHOLD:
            resp.message(f"Correct! It is {country}.")
        else:
            resp.message(f"Incorrect. The correct answer was {country}.")
        session["item"] = random.choice(FLAGS)
        resp.message(f"Next flag: {session['item']['emoji']}")
        return str(resp)

    if session and session["mode"] == "capital":
        capital = session["item"]["capital"]
        if fuzz.ratio(incoming_msg.lower(), capital.lower()) >= THRESHOLD:
            resp.message("Correct!")
        else:
            resp.message(f"Incorrect. The capital is {capital}.")
        session["item"] = random.choice(FLAGS)
        resp.message(f"What is the capital of {session['item']['country']}?")
        return str(resp)

    resp.message("Type 'start' to begin.")
    return str(resp)


async def main(request):
    form = await request.form_data()
    data = {key: form.get(key, "") for key in form.keys()}
    xml = handle(data)
    return Response(xml, headers={"Content-Type": "application/xml"})

