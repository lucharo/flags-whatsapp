import os
from twilio.rest import Client
from cloudflare.workers import Response

from src.game import GameBot

client = Client(os.environ.get("TWILIO_ACCOUNT_SID"), os.environ.get("TWILIO_AUTH_TOKEN"))
bot = GameBot(client, os.environ.get("TWILIO_WHATSAPP_NUMBER", ""))


async def main(request):
    form = await request.form_data()
    data = {key: form.get(key, "") for key in form.keys()}
    xml = bot.handle(data)
    return Response(xml, headers={"Content-Type": "application/xml"})
