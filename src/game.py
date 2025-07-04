import random
import logging
import requests
import os
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

        try:
            # Define the payload for Content API based on Twilio docs
            payload = {
                "friendly_name": "game_menu",
                "language": "en",
                "types": {
                    "twilio/quick-reply": {  # Note: format changed from twilio_quick_reply to twilio/quick-reply
                        "body": "Choose a game mode",
                        "actions": [
                            {
                                "title": "Guess the Flag",
                                "id": "flag",
                                "type": "QUICK_REPLY"  # Add required type field
                            },
                            {
                                "title": "Guess the Capital",
                                "id": "capital",
                                "type": "QUICK_REPLY"  # Add required type field
                            }
                        ]
                    }
                }
            }
            
            # Get credentials directly from environment (same as app.py does when creating the client)
            account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
            auth_token = os.environ.get('TWILIO_AUTH_TOKEN')
            
            # Make authenticated request to Content API
            response = requests.post(
                "https://content.twilio.com/v1/Content",
                json=payload,
                auth=(account_sid, auth_token),
                headers={'Content-Type': 'application/json'}
            )
            
            # Check response
            response.raise_for_status()
            content_sid = response.json().get('sid')
            
            # Send message with content SID
            self.client.messages.create(
                from_=f"whatsapp:{self.whatsapp_number}",
                to=to_number,
                content_sid=content_sid,
            )
            logger.debug("Sent menu content SID %s", content_sid)
        except Exception as exc:
            logger.error("Failed to send quick reply: %s", exc)

    def handle(self, data: Dict[str, str]) -> str:
        incoming_msg = data.get("Body", "").strip()
        from_number = data.get("From", "")
        # Capture quick replies correctly - might be ListReplyId or ButtonPayload
        list_reply = data.get("ListReplyId", "").lower()
        button_payload = data.get("ButtonPayload", "").lower()

        # Log all relevant fields for debugging
        logger.info("Message from %s: %s", from_number, incoming_msg)
        if list_reply:
            logger.info("List reply ID: %s", list_reply)
        if button_payload:
            logger.info("Button payload: %s", button_payload)
        
        # Log all webhook data for complete debugging
        logger.debug("Webhook data: %s", data)

        resp = MessagingResponse()

        if incoming_msg.lower() == "start" or from_number not in self.sessions:
            logger.debug("Starting new session for %s", from_number)
            self.sessions[from_number] = {"mode": None, "item": None}
            self.send_game_mode_options(from_number)
            return str(resp)

        session = self.sessions.get(from_number)

        # Check for game mode selection from any of the possible sources
        chosen = button_payload or list_reply or incoming_msg.lower()
        logger.debug("Chosen option: %s", chosen)
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
