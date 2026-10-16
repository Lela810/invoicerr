import { describe, expect, it } from "vitest"

import { languageToLocale, SUPPORTED_LANGUAGES } from "./i18n"

// Every value `i18n.language` can take that resolves to a locale other than en-US, with that locale.
const EXPECTED_DATE_LOCALE: Record<string, string> = {
  ar: "ar",
  "ar-DZ": "ar-DZ",
  "ar-EG": "ar-EG",
  "ar-MA": "ar-MA",
  "ar-SA": "ar-SA",
  "ar-TN": "ar-TN",
  cs: "cs",
  de: "de",
  "de-AT": "de-AT",
  "en-AU": "en-AU",
  "en-CA": "en-CA",
  "en-GB": "en-GB",
  "en-IE": "en-IE",
  "en-IN": "en-IN",
  "en-NZ": "en-NZ",
  "en-ZA": "en-ZA",
  es: "es",
  fr: "fr",
  "fr-CA": "fr-CA",
  "fr-CH": "fr-CH",
  it: "it",
  "it-CH": "it-CH",
  nl: "nl",
  "nl-BE": "nl-BE",
  pl: "pl",
  da: "da",
  he: "he",
  ja: "ja",
  ko: "ko",
  "pt-BR": "pt-BR",
  ru: "ru",
  sv: "sv",
  uk: "uk",
}

describe("languageToLocale", () => {
  it.each(Object.entries(EXPECTED_DATE_LOCALE))("resolves %s to the %s date-fns locale", (language, code) => {
    expect(languageToLocale(language).code).toBe(code)
  })

  it("gives every supported language a date-fns locale of that language", () => {
    for (const { code } of SUPPORTED_LANGUAGES) {
      expect(languageToLocale(code).code.split("-")[0]).toBe(code)
    }
  })

  it.each([
    "en",
    "en-US",
    "fr-FR",
    "de-CH",
    "es-MX",
    "zh-Hans",
    "kab",
    "rtltest",
    "xx",
    "",
    "constructor",
  ])("falls back to en-US for %j", (language) => {
    expect(languageToLocale(language).code).toBe("en-US")
  })
})
