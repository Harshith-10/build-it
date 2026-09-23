
fetch("http://localhost:3000/api/auth/sign-in/username", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ username: "admin999", password: "mockpassword" })
}).then(async r => {
  console.log("Status:", r.status);
  console.log("Body:", await r.text());
}).catch(console.error);

