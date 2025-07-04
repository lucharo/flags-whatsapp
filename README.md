# WhatsApp Guess the Flag Bot

This project implements a simple WhatsApp game using Twilio. The bot sends a flag emoji and waits for the user to guess the country. Answers are matched using fuzzy string matching. You can also ask for a short explanation of a flag using an LLM. A welcome message lets the user choose between guessing flags or capitals.

The application uses a clean architecture with separation of concerns:

- `twilio_api.py` handles all Twilio API interactions
- `game.py` contains the core game logic
- `app.py` provides the Flask web server and webhook endpoint

## Features

- WhatsApp webhook using Twilio and Flask
- Fuzzy matching with RapidFuzz
- Optional flag explanations powered by [Mirascope](https://github.com/Mirascope/mirascope) and a Gemini model
- Interactive list to choose between flag and capital game modes
- Dataset includes all recognized countries with flag emojis and capitals

## Setup

1. Install dependencies:

```bash
pip install -r requirements.txt
```

1. Configure environment variables (for Twilio and LLM provider):

- `TWILIO_ACCOUNT_SID` – your Twilio account SID
- `TWILIO_AUTH_TOKEN` – your Twilio auth token
- `TWILIO_WHATSAPP_NUMBER` – the WhatsApp number provided by Twilio
- `GOOGLE_API_KEY` – API key for Gemini (or other LLM provider)
- `LOG_LEVEL` – set to `DEBUG` for verbose logging

You can place these in a `.env` file for development. Set `LOG_LEVEL=DEBUG`
to print detailed information about incoming requests and game logic.
The code under the `src` directory is a Python package, so run modules using
the `python -m` syntax.

1. Point Twilio's inbound URL to your `/webhook` endpoint.
   Expose your local server with [localtunnel](https://github.com/localtunnel/localtunnel):

   ```bash
   npx localtunnel --port 5001
   ```

   Copy the HTTPS URL that localtunnel prints (for example `https://abcd.loca.lt`).
   Append `/webhook` and paste the result into the **When a message comes in**
   field of the WhatsApp sandbox configuration page in the Twilio console.
   If you omit the `/webhook` path you'll get a 404 response.

1. Run the server locally (it listens on port `5001` by default):

```bash
python -m src.app
```

Send `start` on WhatsApp to begin the game. You'll receive a menu to choose either "Guess the Flag" or "Guess the Capital". During the game you can reply with `explain` to get a short description of the current flag.

The project uses a clean architecture with separation of concerns:

- `src/game.py` contains the core game logic
- `src/twilio_api.py` handles all Twilio API interactions
- `src/app.py` provides the Flask web server and webhook endpoint

This modular design makes the code more maintainable, testable, and easier to understand.

## Deploying to Cloudflare Workers

You can run the webhook on [Cloudflare Workers](https://developers.cloudflare.com/workers/) using their Python runtime.

1. Install the [Wrangler](https://github.com/cloudflare/wrangler) CLI and log in:

   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. The repository contains a sample `wrangler.toml` and a Python worker under `cloudflare/worker.py`.
   Update `wrangler.toml` with your Cloudflare account ID and set the environment variable values or
   add them using `wrangler secret put`.

3. Deploy the worker with:

   ```bash
   wrangler deploy
   ```

Set the Twilio webhook URL to the worker route shown after deployment.
