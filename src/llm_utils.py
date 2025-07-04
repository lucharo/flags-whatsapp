import logging
from mirascope import llm
from mirascope.exceptions import MirascopeException

logger = logging.getLogger(__name__)

@llm.call(provider="google", model="gemini-pro")
def explain_flag(country: str) -> str:
    """Return a short explanation about the given country's flag."""
    return f"Explain the symbolism behind the flag of {country} in two to three sentences."

def get_flag_explanation(country: str) -> str:
    """Safely get flag explanation with error handling.
    
    Args:
        country: The name of the country to get flag explanation for
        
    Returns:
        A string containing the explanation or error message
    """
    try:
        return explain_flag(country)
    except MirascopeException as e:
        error_msg = f"Failed to get flag explanation: {str(e)}"
        logger.error(error_msg)
        return "Sorry, I couldn't retrieve flag information right now."
    except Exception as e:
        error_msg = f"Unexpected error in LLM call: {str(e)}"
        logger.error(error_msg)
        return "Sorry, I couldn't retrieve flag information right now."
