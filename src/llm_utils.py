from mirascope import llm

@llm.call(provider="google", model="gemini-pro")
def explain_flag(country: str) -> str:
    """Return a short explanation about the given country's flag."""
    return f"Explain the symbolism behind the flag of {country} in two to three sentences."
