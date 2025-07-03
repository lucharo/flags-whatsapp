# WhatsApp Guess the Flag Bot

This project implements a simple WhatsApp game using Twilio. The bot sends a flag emoji and waits for the user to guess the country. Answers are matched using fuzzy string matching. You can also ask for a short explanation of a flag using an LLM. A welcome message lets the user choose between guessing flags or capitals.

## Features

- WhatsApp webhook using Twilio and Flask
- Fuzzy matching with RapidFuzz
- Optional flag explanations powered by [Mirascope](https://github.com/Mirascope/mirascope) and a Gemini model
- Interactive list to choose between flag and capital game modes

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Configure environment variables (for Twilio and LLM provider):

- `TWILIO_ACCOUNT_SID` – your Twilio account SID
- `TWILIO_AUTH_TOKEN` – your Twilio auth token
- `TWILIO_WHATSAPP_NUMBER` – the WhatsApp number provided by Twilio
- `GOOGLE_API_KEY` – API key for Gemini (or other LLM provider)

You can place these in a `.env` file for development.

3. Expose the `/webhook` endpoint to Twilio. In the Twilio console, set your WhatsApp webhook URL to `https://<your-server>/webhook`.

4. Run the server locally:

```bash
python src/app.py
```

Send `start` on WhatsApp to begin the game. You'll receive a menu to choose either "Guess the Flag" or "Guess the Capital". During the game you can reply with `explain` to get a short description of the current flag.
