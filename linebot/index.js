const express = require("express");
const { reply, startLoading, handleText } = require("./Functions/Messages");
const app = express();

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.sendStatus(200);
});

app.post("/webhook", async (req, res) => {
  // The "Verify" button in the LINE console sends { events: [] } — just return 200
  const events = (req.body && req.body.events) || [];

  try {
    // On Vercel the function may be frozen once the response is sent,
    // so finish the reply calls BEFORE responding.
    await Promise.all(
      events
        .filter(
          (event) => event.type === "message" && event.message.type === "text"
        )
        .map(async (event) => {
          // Loading animation only works in 1-on-1 chats (not groups/rooms)
          if (event.source.type === "user") {
            await startLoading(event.source.userId);
          }
          // `await` so handleText can later fetch real data (sensors, DB, ...)
          const messages = await handleText(event.message.text);
          await reply(event.replyToken, messages);
        })
    );
  } catch (err) {
    console.error(err);
  }

  res.sendStatus(200);
});

// Run a local server only when started directly (`node index.js`).
// On Vercel the exported app is used as the serverless handler.
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Example app listening at http://localhost:${PORT}`);
  });
}

module.exports = app;
