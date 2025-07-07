"""WhatsApp Flag Quiz Flask Application.

This is the main entry point for the Flag Quiz application.
It provides a Flask web server that handles WhatsApp webhook requests,
connecting the Twilio API with the game logic.

The application follows a clean architecture pattern where:
- TwilioService handles all Twilio API interactions
- GameBot contains the core game logic
- This Flask app connects everything together
"""

import os
import logging
from flask import Flask, request
from twilio.rest import Client
from dotenv import load_dotenv
from src.twilio_api import TwilioService
from src.game import GameBot

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Configure logging
log_level = os.environ.get('LOG_LEVEL', 'INFO')
logging.basicConfig(level=log_level)

# Reduce Twilio HTTP client logging - only show ERROR level
twilio_http_logger = logging.getLogger('twilio.http_client')
twilio_http_logger.setLevel(logging.ERROR)

# Setup Twilio client and services
client = Client(os.environ.get('TWILIO_ACCOUNT_SID'), os.environ.get('TWILIO_AUTH_TOKEN'))
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')

# Create TwilioService first, then pass it to GameBot for better separation of concerns
twilio_service = TwilioService(client, TWILIO_WHATSAPP_NUMBER)
bot = GameBot(twilio_service)


@app.route('/webhook', methods=['POST'])
def whatsapp_webhook():
    return bot.handle(request.values)

if __name__ == '__main__':
    # Default to port 5001 so it matches the README instructions
    port = int(os.environ.get('PORT', 5001))
    logging.info('Starting Flask server on port %s', port)
    app.run(host='0.0.0.0', port=port)
