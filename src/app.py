import os
import logging
from flask import Flask, request
from twilio.rest import Client
from dotenv import load_dotenv

load_dotenv()

from src.game import GameBot

app = Flask(__name__)

# Configure basic logging so we can debug incoming requests easily.
logging.basicConfig(level=os.environ.get("LOG_LEVEL", "INFO"))
client = Client(os.environ.get('TWILIO_ACCOUNT_SID'), os.environ.get('TWILIO_AUTH_TOKEN'))
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')
bot = GameBot(client, TWILIO_WHATSAPP_NUMBER)


@app.route('/webhook', methods=['POST'])
def whatsapp_webhook():
    return bot.handle(request.values)

if __name__ == '__main__':
    # Default to port 5001 so it matches the README instructions
    port = int(os.environ.get('PORT', 5001))
    logging.info('Starting Flask server on port %s', port)
    app.run(host='0.0.0.0', port=port)
