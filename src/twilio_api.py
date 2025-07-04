"""Twilio API Service Module.

This module encapsulates all Twilio API interactions used by the WhatsApp Flag Quiz bot.
It provides a clean interface for sending text messages and quick reply menus,
handling all the complexity of Twilio's API formats and authentication.

The TwilioService class abstracts away Twilio-specific details from the rest of the application,
making the code more maintainable and easier to test.
"""

import os
import logging
import requests
from twilio.rest import Client

logger = logging.getLogger(__name__)

class TwilioService:
    """Handles all Twilio-specific API calls and formatting."""

    def __init__(self, client: Client, whatsapp_number: str):
        """Initialize the Twilio service with client and WhatsApp number."""
        self.client = client
        self.whatsapp_number = whatsapp_number
        # For direct API calls
        self.account_sid = os.environ.get('TWILIO_ACCOUNT_SID')
        self.auth_token = os.environ.get('TWILIO_AUTH_TOKEN')

    def format_whatsapp_number(self, number: str) -> str:
        """Format a phone number with WhatsApp prefix if needed."""
        if number and not number.startswith("whatsapp:"):
            return f"whatsapp:{number}"
        return number

    def send_text_message(self, to_number: str, body: str) -> None:
        """Send a simple text message via WhatsApp."""
        try:
            self.client.messages.create(
                from_=self.format_whatsapp_number(self.whatsapp_number),
                to=self.format_whatsapp_number(to_number),
                body=body
            )
            logger.debug("Sent WhatsApp message to %s", to_number)
        except Exception as exc:
            logger.error("Failed to send WhatsApp message: %s", exc)

    def send_quick_reply_menu(self, to_number: str, options: list) -> None:
        """Send a WhatsApp quick reply menu with the given options.
        
        Args:
            to_number: The recipient's phone number
            options: List of dictionaries with 'title' and 'id' keys
        """
        try:
            # Format the actions for the Content API
            actions = []
            for option in options:
                actions.append({
                    "title": option["title"],
                    "id": option["id"],
                    "type": "QUICK_REPLY"
                })
            
            # Define the payload for Content API
            payload = {
                "friendly_name": "quick_reply_menu",
                "language": "en",
                "types": {
                    "twilio/quick-reply": {
                        "body": "Choose an option:",
                        "actions": actions
                    }
                }
            }
            
            # Make authenticated request to Content API
            response = requests.post(
                "https://content.twilio.com/v1/Content",
                json=payload,
                auth=(self.account_sid, self.auth_token),
                headers={'Content-Type': 'application/json'}
            )
            
            # Check response
            response.raise_for_status()
            content_sid = response.json().get('sid')
            
            # Send message with content SID
            self.client.messages.create(
                from_=self.format_whatsapp_number(self.whatsapp_number),
                to=self.format_whatsapp_number(to_number),
                content_sid=content_sid,
            )
            logger.debug("Sent quick reply menu with SID %s", content_sid)
        except Exception as exc:
            logger.error("Failed to send quick reply menu: %s", exc)
