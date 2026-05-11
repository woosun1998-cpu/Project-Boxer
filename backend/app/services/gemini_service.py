import json

import google.generativeai as genai

from app.config import settings


class GeminiService:
    def __init__(self) -> None:
        self.enabled = bool(settings.GEMINI_API_KEY)
        if self.enabled:
            genai.configure(api_key=settings.GEMINI_API_KEY)
            self.model = genai.GenerativeModel("gemini-pro")
        else:
            self.model = None

    async def get_coaching(self, user_stats: dict) -> dict:
        if not self.enabled or self.model is None:
            return self._fallback(user_stats)

        win_pct = round(user_stats.get("win_rate", 0) * 100, 1)
        avg_ms = round(user_stats.get("avg_reaction_ms", 0) or 0)
        combo = user_stats.get("max_combo", 0)
        weak_attack = user_stats.get("weak_attack", "unknown")

        prompt = (
            "You are a boxing coach. Respond only as JSON with keys advice, focus_area, next_goal.\n"
            f"Win rate: {win_pct}%\n"
            f"Average reaction time: {avg_ms}ms\n"
            f"Max combo: {combo}\n"
            f"Weak attack type: {weak_attack}\n"
        )

        try:
            response = self.model.generate_content(prompt)
            text = response.text.strip()
            if "```json" in text:
                text = text.split("```json", 1)[1].split("```", 1)[0].strip()
            data = json.loads(text)
            return {
                "advice": str(data.get("advice", "")),
                "focus_area": str(data.get("focus_area", "")),
                "next_goal": str(data.get("next_goal", "")),
            }
        except Exception:
            return self._fallback(user_stats)

    def _fallback(self, user_stats: dict) -> dict:
        win_rate = user_stats.get("win_rate", 0.0)
        avg_reaction = user_stats.get("avg_reaction_ms", 0) or 0
        weak_attack = user_stats.get("weak_attack", "unknown")

        if win_rate < 0.5:
            advice = "Start with easier drills and focus on reading the attack before reacting."
        else:
            advice = "Your base performance is solid. Focus on making your movement more consistent."

        if avg_reaction and avg_reaction > 500:
            focus_area = "reaction speed"
        else:
            focus_area = weak_attack

        return {
            "advice": advice,
            "focus_area": focus_area,
            "next_goal": "Increase dodge consistency in the next 10 sessions.",
        }
