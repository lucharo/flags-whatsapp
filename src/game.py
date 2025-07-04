import random
import logging
from typing import Dict
from rapidfuzz import fuzz
from twilio.twiml.messaging_response import MessagingResponse
from twilio.rest import Client

from src.flag_data import FLAGS
from src.llm_utils import explain_flag

logger = logging.getLogger(__name__)


class GameBot:
    """Shared game logic used by both Flask and Cloudflare Workers."""

    THRESHOLD = 80

    def __init__(self, client: Client, whatsapp_number: str):
        self.client = client
        self.whatsapp_number = whatsapp_number
        # sessions[from_number] = {"mode": "flag"|"capital", "item": FLAGS[n]}
        self.sessions: Dict[str, Dict] = {}
        logger.debug("GameBot initialized with WhatsApp number %s", whatsapp_number)

    def send_game_mode_options(self, to_number: str) -> None:
        """Send a WhatsApp list message asking the user to choose a game mode."""
        if not (self.client and self.whatsapp_number):
            logger.warning("Twilio client or WhatsApp number missing; cannot send options")
            return
        logger.info("Sending game mode menu to %s", to_number)
        message = self.client.messages.create(
            from_=f"whatsapp:{self.whatsapp_number}",
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
        logger.debug("Sent menu message SID %s", getattr(message, "sid", "?"))

    def handle(self, data: Dict[str, str]) -> str:
        incoming_msg = data.get("Body", "").strip()
        from_number = data.get("From", "")
        list_reply = data.get("ListReplyId", "").lower()

        logger.info("Message from %s: %s", from_number, incoming_msg)

        resp = MessagingResponse()

        if incoming_msg.lower() == "start" or from_number not in self.sessions:
            logger.debug("Starting new session for %s", from_number)
            self.sessions[from_number] = {"mode": None, "item": None}
            self.send_game_mode_options(from_number)
            return str(resp)

        session = self.sessions.get(from_number)

        chosen = list_reply or incoming_msg.lower()
        if session and session["mode"] is None and chosen in {"flag", "capital"}:
            session["mode"] = chosen
            item = random.choice(FLAGS)
            session["item"] = item
            logger.info("User %s chose mode %s", from_number, chosen)
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
            logger.debug("Providing explanation for %s", country)
            resp.message(explanation)
            return str(resp)

        if session and session["mode"] == "flag":
            country = session["item"]["country"]
            if fuzz.ratio(incoming_msg.lower(), country.lower()) >= self.THRESHOLD:
                logger.info("%s guessed %s correctly", from_number, country)
                resp.message(f"Correct! It is {country}.")
            else:
                logger.info("%s guessed %s incorrectly", from_number, incoming_msg)
                resp.message(f"Incorrect. The correct answer was {country}.")
            session["item"] = random.choice(FLAGS)
            resp.message(f"Next flag: {session['item']['emoji']}")
            return str(resp)

        if session and session["mode"] == "capital":
            capital = session["item"]["capital"]
            if fuzz.ratio(incoming_msg.lower(), capital.lower()) >= self.THRESHOLD:
                logger.info("%s guessed %s correctly", from_number, capital)
                resp.message("Correct!")
            else:
                logger.info("%s guessed %s incorrectly", from_number, incoming_msg)
                resp.message(f"Incorrect. The capital is {capital}.")
            session["item"] = random.choice(FLAGS)
            resp.message(
                f"What is the capital of {session['item']['country']}?"
            )
            return str(resp)

        resp.message("Type 'start' to begin.")
        logger.debug("No valid session found for %s", from_number)
        return str(resp)
