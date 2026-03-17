import axios from "axios";

/**
 * Translate text to English using Google Translate endpoint
 * @param {string} text - Text to translate
 * @param {function} callback - function(err, translatedText)
 */
export function translateToEnglish(text, callback) {
  const url = "https://translate.googleapis.com/translate_a/single";
  const params = {
    client: "gtx",
    sl: "auto",
    tl: "en",
    hl: "en",
    dt: "t",
    ie: "UTF-8",
    oe: "UTF-8",
    otf: 1,
    ssel: 0,
    tsel: 0,
    kc: 7,
    tk: "43951.432337",
    q: text
  };

  axios
    .get(url, { params })
    .then(response => {
      try {
        const data = response.data;
        const translatedText = data?.[0]?.[0]?.[0] ?? text;
        callback(null, translatedText);
      } catch (err) {
        callback(err, text); // fallback
      }
    })
    .catch(err => {
      console.error("Translate API Error:", err.message);
      callback(err, text); // fallback
    });
}