import { verifyEmailTransport } from "./src/utils/email";
(async () => {
  const raw = process.env.EMAIL_PASSWORD || "";
  console.log("user:", process.env.EMAIL_USER);
  console.log("pass length:", raw.length, "| has surrounding quotes:", /^["'].*["']$/.test(raw), "| has whitespace:", /\s/.test(raw));
  console.log("verify:", JSON.stringify(await verifyEmailTransport()));
})();
