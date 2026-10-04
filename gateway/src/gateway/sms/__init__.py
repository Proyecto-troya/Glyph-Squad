"""``POST /api/sms``: one validated Spanish sentence to append to the Leaf Plate SMS code.

The app builds the deterministic ``LP ...`` code line itself. This service only adds a
second line, validates it strictly, and falls back to a fixed template when the model is
slow, unreachable or off-spec. The phone keeps sending the code alone when the laptop
is unreachable; this endpoint is never required for the app to work.
"""
