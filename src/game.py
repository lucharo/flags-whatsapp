"""Flag Quiz Game Logic.

This module contains the core game logic for the Flag Quiz WhatsApp bot.
It handles game state management, user interactions, and game flow,
but delegates all Twilio API interactions to the TwilioService class.

The GameBot class maintains user sessions, processes incoming messages,
and determines appropriate responses based on game state and user input.
"""

import random
import logging
from typing import Dict
from rapidfuzz import fuzz
from twilio.twiml.messaging_response import MessagingResponse

from src.flag_data import FLAGS
from src.llm_utils import get_flag_explanation
from src.twilio_api import TwilioService

logger = logging.getLogger(__name__)

class GameBot:
    """Flag quiz game logic."""

    SIMILARITY_THRESHOLD = 80
    DEFAULT_ATTEMPTS = 3
    MAX_ATTEMPTS = 5

    def __init__(self, twilio_service: TwilioService):
        """Initialize with a TwilioService for messaging."""
        self.twilio = twilio_service
        # sessions[from_number] = {"mode": "flag"|"capital", "item": FLAGS[n]}
        self.sessions: Dict[str, Dict] = {}

    def _get_or_create_session(self, from_number: str, create_new: bool = False) -> Dict:
        """Get existing session or create a new one if requested."""
        if create_new or from_number not in self.sessions:
            logger.debug("Creating new session for %s", from_number)
            self.sessions[from_number] = {
                "mode": None, 
                "item": None, 
                "attempts": self.DEFAULT_ATTEMPTS, 
                "wrong_guesses": 0
            }
        return self.sessions.get(from_number, {})
    
    def send_welcome_message(self, to_number: str) -> None:
        """Send welcome message with instructions."""
        welcome_msg = (
            "Welcome to Flag Quiz! Here are your options:\n\n"
            "• Type a number between 1-5 to set max wrong attempts per flag\n"
            "• Type 'next' to skip to next flag\n"
            "• Type 'stop' or 'end' to quit\n"
            "• Type 'start' anytime to restart\n"
            "• Type 'hint' to get a hint"
        )
        self.twilio.send_text_message(to_number, welcome_msg)
    
    def send_game_mode_options(self, to_number: str) -> None:
        """Send quick reply menu with game mode options."""
        options = [
            {"title": "Guess the Flag", "id": "flag"},
            {"title": "Guess the Capital", "id": "capital"}
        ]
        self.twilio.send_quick_reply_menu(to_number, options)
    
    def send_flag(self, to_number: str, flag_item: Dict) -> None:
        """Send flag emoji as a standalone message."""
        self.twilio.send_text_message(to_number, flag_item['emoji'])
    
    def start_game(self, from_number: str) -> MessagingResponse:
        """Start or restart the game."""
        # Create new session
        self._get_or_create_session(from_number, create_new=True)
        
        # Send welcome and game options
        self.send_welcome_message(from_number)
        self.send_game_mode_options(from_number)
        
        # Return empty response as we've sent messages directly
        return MessagingResponse()
    
    def set_attempts(self, from_number: str, attempts: int) -> MessagingResponse:
        """Set number of attempts per flag."""
        session = self._get_or_create_session(from_number)
        attempts = min(max(1, attempts), self.MAX_ATTEMPTS)  # Ensure between 1-5
        session["attempts"] = attempts
        
        resp = MessagingResponse()
        resp.message(f"Great! You now have {attempts} attempts per flag.")
        return resp
    
    def next_item(self, from_number: str) -> MessagingResponse:
        """Skip to next flag/capital."""
        session = self._get_or_create_session(from_number)
        if not session.get("mode"):
            resp = MessagingResponse()
            resp.message("Please choose a game mode first.")
            return resp
        
        # Pick random flag
        item = random.choice(FLAGS)
        session["item"] = item
        session["wrong_guesses"] = 0
        
        resp = MessagingResponse()
        # Handle flag or capital mode
        if session["mode"] == "flag":
            # Send flag as standalone message
            self.send_flag(from_number, item)
            resp.message("Guess the country:")
        else:
            resp.message(f"What is the capital of {item['country']}?")
        
        return resp
    
    def process_guess(self, from_number: str, guess: str) -> MessagingResponse:
        """Process user's guess."""
        session = self._get_or_create_session(from_number)
        if not session.get("mode") or not session.get("item"):
            return MessagingResponse()  # Should never happen but just in case
        
        current = session["item"]
        attempts_limit = session.get("attempts", self.DEFAULT_ATTEMPTS)
        resp = MessagingResponse()
        
        # Handle guess based on game mode
        if session["mode"] == "flag":
            target = current["country"].lower()
            similarity = fuzz.ratio(guess.lower(), target)
            
            if similarity >= self.SIMILARITY_THRESHOLD:
                # Correct guess
                next_item = random.choice(FLAGS)
                session["item"] = next_item
                session["wrong_guesses"] = 0
                
                # Send success message
                resp.message(f"✅ Correct! The flag is {current['emoji']} {current['country']}.")
                
                # Send next flag
                self.send_flag(from_number, next_item)
                resp.message("Guess the next country:")
            else:
                # Wrong guess
                session["wrong_guesses"] += 1
                remaining = attempts_limit - session["wrong_guesses"]
                
                if remaining <= 0:
                    # No more attempts
                    next_item = random.choice(FLAGS)
                    session["item"] = next_item
                    session["wrong_guesses"] = 0
                    
                    resp.message(f"The correct answer was: {current['country']}")
                    
                    # Send next flag
                    self.send_flag(from_number, next_item)
                    resp.message("Guess the next country:")
                else:
                    # Still has attempts left
                    hint = current['country'][0] if remaining <= attempts_limit - 1 else ""
                    resp.message(f"Try again! {remaining} {'attempt' if remaining == 1 else 'attempts'} left.{f' Hint: {hint}' if hint else ''}")
        else:
            # Capital mode
            if fuzz.ratio(guess.lower(), current["capital"].lower()) >= self.SIMILARITY_THRESHOLD:
                # Correct guess
                next_item = random.choice(FLAGS)
                session["item"] = next_item
                session["wrong_guesses"] = 0
                resp.message(f"✅ Correct! The capital of {current['country']} is {current['capital']}.\n\nWhat is the capital of {next_item['country']}?")
            else:
                # Wrong guess
                session["wrong_guesses"] += 1
                remaining = attempts_limit - session["wrong_guesses"]
                
                if remaining <= 0:
                    # No more attempts
                    next_item = random.choice(FLAGS)
                    session["item"] = next_item
                    session["wrong_guesses"] = 0
                    resp.message(f"The correct answer was: {current['capital']}\n\nWhat is the capital of {next_item['country']}?")
                else:
                    # Still has attempts left
                    hint = current['capital'][0] if remaining <= attempts_limit - 1 else ""
                    resp.message(f"Try again! {remaining} {'attempt' if remaining == 1 else 'attempts'} left.{f' Hint: {hint}' if hint else ''}")
        
        return resp
    
    def set_game_mode(self, from_number: str, mode: str) -> MessagingResponse:
        """Set game mode and start first question."""
        if mode not in {"flag", "capital"}:
            resp = MessagingResponse()
            resp.message("Please choose a valid game mode: flag or capital.")
            return resp
            
        session = self._get_or_create_session(from_number)
        session["mode"] = mode
        item = random.choice(FLAGS)
        session["item"] = item
        session["wrong_guesses"] = 0
        
        resp = MessagingResponse()
        if mode == "flag":
            # Send flag as standalone message
            self.send_flag(from_number, item)
            resp.message("Guess the country:")
        else:
            resp.message(f"What is the capital of {item['country']}?")
        
        return resp
    
    def provide_hint(self, from_number: str) -> MessagingResponse:
        """Provide hint for current item."""
        session = self._get_or_create_session(from_number)
        resp = MessagingResponse()
        
        if not session.get("item"):
            resp.message("You need to start a game first. Type 'start'.")
            return resp
            
        country = session["item"]["country"]
        explanation = get_flag_explanation(country)
        
        resp.message(explanation)
        return resp
    
    def end_game(self, from_number: str) -> MessagingResponse:
        """End the game session."""
        if from_number in self.sessions:
            del self.sessions[from_number]
        
        resp = MessagingResponse()
        resp.message("Thanks for playing! Type 'start' anytime to play again.")
        return resp
    
    def handle(self, data: Dict[str, str]) -> str:
        """Process incoming webhook data and return response."""
        incoming_msg = data.get("Body", "").strip()
        from_number = data.get("From", "")
        
        # Capture quick replies from ButtonPayload or ListReplyId
        list_reply = data.get("ListReplyId", "").lower()
        button_payload = data.get("ButtonPayload", "").lower()
        chosen_option = button_payload or list_reply or ""
        
        # Log incoming data for debugging
        logger.info("Message from %s: %s", from_number, incoming_msg)
        if list_reply or button_payload:
            logger.debug("Quick reply: %s", chosen_option)
            
        # Get session if exists
        session = self.sessions.get(from_number, {})
        
        # Initialize response
        resp = MessagingResponse()
        
        # Handle start command
        if incoming_msg.lower() == "start":
            return str(self.start_game(from_number))
            
        # Handle end/stop command
        if session and incoming_msg.lower() in {"stop", "end"}:
            return str(self.end_game(from_number))
            
        # Handle attempts setting (1-5)
        try:
            attempts = int(incoming_msg)
            if 1 <= attempts <= 5 and session:
                return str(self.set_attempts(from_number, attempts))
        except ValueError:
            pass
            
        # Handle next command
        if session and session.get("mode") and incoming_msg.lower() == "next":
            return str(self.next_item(from_number))
            
        # Handle game in progress
        if session and session.get("mode") and session.get("item"):
            # Process hint request
            if incoming_msg.lower() in {"explain", "hint", "why"}:
                return str(self.provide_hint(from_number))
                
            # Process guess
            return str(self.process_guess(from_number, incoming_msg))
            
        # Handle game mode selection
        if session and session.get("mode") is None and chosen_option in {"flag", "capital"}:
            return str(self.set_game_mode(from_number, chosen_option))
            
        # No valid session or command recognized, or this is a new user
        if not from_number in self.sessions:
            logger.info("New user detected, sending welcome message")
            return str(self.start_game(from_number))
        
        # Default fallback for existing users without a clear command
        resp.message("Type 'start' to begin a new game, or 'next' to continue.")
        return str(resp)
