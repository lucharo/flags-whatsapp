import os
from twilio.rest import Client
from cloudflare.workers import Response

from src.game import GameBot
from src.twilio_api import TwilioService

# Setup Twilio client and services
client = Client(os.environ.get("TWILIO_ACCOUNT_SID"), os.environ.get("TWILIO_AUTH_TOKEN"))
TWILIO_WHATSAPP_NUMBER = os.environ.get("TWILIO_WHATSAPP_NUMBER", "")

# Create TwilioService first, then pass it to GameBot
twilio_service = TwilioService(client, TWILIO_WHATSAPP_NUMBER)
bot = GameBot(twilio_service)


async def main(request):
    form = await request.form_data()
    data = {key: form.get(key, "") for key in form.keys()}
    xml = bot.handle(data)
    return Response(xml, headers={"Content-Type": "application/xml"})
