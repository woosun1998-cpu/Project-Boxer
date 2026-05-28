/**
 * 구글 드라이브 이미지 — 파일 ID → 로컬 캐시 (frontend/image/cache)
 * 무엇: lh3 429(Too Many Requests) 방지 / 왜: 개발·로컬에서 외부 CDN 반복 요청 시 이미지 로드 실패
 */
(function (global) {
  function cacheBase() {
    if (typeof window === "undefined") return "./image/cache/";
    var p = window.location.pathname || "";
    if (p.indexOf("/imboxer/") >= 0) return "../image/cache/";
    if (p.indexOf("/frontend/") >= 0) return "/frontend/image/cache/";
    return "./image/cache/";
  }
  function uc(id) {
    return cacheBase() + id + ".png";
  }
  global.BOXER_DRIVE_IMG = {
    uc: uc,
    defaultProfile: uc("1fBykG25zJ2YkJFqY2exc-Lraz0Zzcr18"),
    logo: uc("1E58-Ar9HJovqNrhjRTCRZ5bArTU8Q1Hg"),
    mainBgShape: uc("1CFTAkSBoHfnxLvybI0pQyUoYdgycocIi"),
    mainBoxer: uc("1qbEsaRfOnN7EduZ3goZL2RAHXbN0igBt"),
    s2Boxer: uc("1HVY1if5oj5NL8BNPkwVElC6A0V8llj4P"),
    s2BgText: uc("1OsCn8YAAfVF5kdRT5HuLhEaRi6dAfR-p"),
    cardTraining: uc("1-im4x2fSa-ZPPT18CaF0E_atqIXVTosC"),
    cardDiet: uc("1iESKt0gYpCTnbXXZB9RFx-AHI68X8kD1"),
    cardSparring: uc("1wNDyG62sB_0Z_oLJxI2Ha9I6YodkOenG"),
    loginOverlayIllustration: uc("19ZNW9ic3jcD0cefm9UWToxY_kyxJG8N0"),
    graphPlaceholder: uc("1E58-Ar9HJovqNrhjRTCRZ5bArTU8Q1Hg"),
    tutHeroShape: uc("1QH3XaFWgPDjkpXbD2qo9Arbo70sLR3Y6"),
    tutHeroTitle: uc("1TUE5jY6eCGOM_yOu8l4p6M6NziIht3ak"),
    tutHeroBoxer: uc("15iS0urubtcHar13vK_yWpWGqd6i079cl"),
    levelBeginner: uc("1GNUy58w9hQqheQSQj7Iu9n9NnV7W8ODY"),
    levelIntermediate: uc("1LOVkkMQdeOrdmHWfWEYwkfRzx5O2KLZS"),
    levelAdvanced: uc("1UvCXsjpI8eAGvBpXSax67cNbUNJC7mPo"),
    sparHeroShape: uc("1QH3XaFWgPDjkpXbD2qo9Arbo70sLR3Y6"),
    sparHeroTitle: uc("14jguV6ikFruZiU8Ets_j0scPc2m2bVDc"),
    sparModeBg: uc("1_r0vKkO6Njt8xS24qmSbI8QQWCw8W7h1"),
    sparBeginner: uc("1rDPcR8JCroL_sbC8LSdaqhYvCUYQghTd"),
    sparNormal: uc("1XinhVhUMte7JYBK8zQkxAfiTRSuTOIG3"),
    sparHard: uc("1BKKOaB5I2BxykyAYIU9qeJX5wLN_tdSb"),
    sparPro: uc("1w6F6GsrkVeyetyaxYKc3-RIR3mVKCUHC"),
    dietHeroBg: uc("1q0R8NWaNvle1dQuOl-6TTBdqreoEC7gF"),
    dietHeroParallelogram: uc("1QH3XaFWgPDjkpXbD2qo9Arbo70sLR3Y6"),
    dietHeroShape: uc("1_r0vKkO6Njt8xS24qmSbI8QQWCw8W7h1"),
    dietHeroTitle: uc("1l9TYHFzvzvHi6JvOiY0V4_tcPBCQft0y"),
    dietHeroBoxer: uc("1iFZPj-_D6EbeYw0UDLZ8Nop_1B_9Bk4_"),
    dietModeBg: uc("1_r0vKkO6Njt8xS24qmSbI8QQWCw8W7h1"),
    dietLight: uc("1Gm0xS-b5RJLq2EVsznJQjYQhoGj6_gPi"),
    dietStandard: uc("12Ps3xRPGBNqPXRGSqfTMw2_F6RLqrFb8"),
    dietIntense: uc("1iRaWdg-CIIPR23_SoAxBbt8WtEIuIs64"),
    stretchBg: uc("1O5bwUe7IoA8p0Zk25oNmoyT1WMP4g9Ad"),
    stretchShoulder: uc("1Ao0WZ89nzBMsOWCwQxYPjETpc6cn1GF4"),
    readyBgTop: uc("1iFZPj-_D6EbeYw0UDLZ8Nop_1B_9Bk4_"),
    readyBgBottom: uc("1q0R8NWaNvle1dQuOl-6TTBdqreoEC7gF"),
    readyLogo: uc("1cSzxDlFtHLLYuAeHunJlRK5Yf_YBTXxe"),
    myHpBar: uc("1oZRuK0m5U4XlcIYBVtyrsUc1_wjdj-yt"),
    cpuHpBar: uc("1q07oGsEEJQUwlli15pov7ZHFj9A4xWA9"),
    iconMuscle: uc("1hnbZ5TvvwjMi2Z9MkR08kSRYKAb2FIWa"),
    iconGlove: uc("14SGqNnOWakQhHrWgC4kkEaoCLhqE_WCF"),
    iconHeadgear: uc("1OPOr1iYXWhvTx_1smfQIR_bDes6YExev"),
    iconCrown: uc("11g8e8zCQ8VsBJM0J0b96nW8taq2BFSzj"),
    tutorial2Hero: uc("1yWuXksGdsDFRHVgGUNLQy5I8mP9JoWi5"),
  };
})(typeof window !== "undefined" ? window : globalThis);
