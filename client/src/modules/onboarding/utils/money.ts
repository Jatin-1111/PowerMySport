/**
 * Rupees and paise for the sign-up forms. The owner types rupees; the server
 * stores paise. A slip here is a 100x error, so nothing in this file multiplies a
 * decimal.
 */

/**
 * Rupees as typed (or as a number) to paise. Works on the digits of the text:
 * 1.005 * 100 is 100.49999999999999, which would round the wrong way. Rounds half
 * up to the nearest paisa. Anything that is not a plain positive number gives 0.
 */
export const rupeesToPaise = (rupees: number | string): number => {
  const text = String(rupees).trim();
  if (!/^\d+(\.\d+)?$/.test(text)) return 0;
  const [whole = "0", fraction = ""] = text.split(".");
  const digits = fraction.padEnd(3, "0");
  let paise = Number(whole) * 100 + Number(digits.slice(0, 2));
  if (Number(digits[2]) >= 5) paise += 1;
  return paise;
};

export const paiseToRupees = (paise: number | null | undefined): number | "" => {
  if (!paise || !Number.isFinite(paise)) return "";
  return paise / 100;
};

/**
 * What an owner actually types into an amount box: "1,500", "₹500", "Rs. 500",
 * " 500 ". The symbol, the word, commas and spaces are ignored. Returns paise, or
 * 0 when there is no usable amount.
 */
export const parseRupeesInput = (text: string): number =>
  rupeesToPaise(text.replace(/₹|rs\.?|inr/gi, "").replace(/[,\s]/g, ""));

/** Paise as a plain rupee string for a text box: 50000 gives "500", 19999 gives "199.99". */
export const paiseToInputText = (paise: number | null | undefined): string => {
  const rupees = paiseToRupees(paise);
  return rupees === "" ? "" : String(rupees);
};
