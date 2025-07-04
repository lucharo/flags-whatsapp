import os
from flask import Flask, request
from twilio.rest import Client

from src.game import GameBot

app = Flask(__name__)

client = Client(os.environ.get('TWILIO_ACCOUNT_SID'), os.environ.get('TWILIO_AUTH_TOKEN'))
TWILIO_WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', '')
bot = GameBot(client, TWILIO_WHATSAPP_NUMBER)


@app.route('/webhook', methods=['POST'])
def whatsapp_webhook():
    return bot.handle(request.values)

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
