const TOKEN = process.env.LINE_ACCESS_TOKEN;
// Set DASHBOARD_URL (https://...) to make "View dashboard" open a web page.
const DASHBOARD_URL = process.env.DASHBOARD_URL;

async function reply(replyToken, messages) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error("LINE reply failed:", res.status, await res.text());
  }
}

// Show the "..." loading animation in the user's chat.
// It disappears automatically when the bot's reply arrives (or after `seconds`).
// Only works in 1-on-1 chats; seconds must be 5–60 in steps of 5.
async function startLoading(userId, seconds = 20) {
  const res = await fetch("https://api.line.me/v2/bot/chat/loading/start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + TOKEN,
    },
    body: JSON.stringify({ chatId: userId, loadingSeconds: seconds }),
  });
  if (!res.ok) {
    console.error("LINE loading failed:", res.status, await res.text());
  }
}

// Flex "rich message" with the three menu buttons.
// Message actions make the user "type" the label, so handleText below picks it up.
function menuMessage(title) {
  const dashboardAction = DASHBOARD_URL
    ? { type: "uri", label: "View dashboard", uri: DASHBOARD_URL }
    : { type: "message", label: "View dashboard", text: "View dashboard" };

  return {
    type: "flex",
    altText: title,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [{ type: "text", text: title, wrap: true, weight: "bold" }],
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "button", style: "primary", action: { type: "message", label: "AIR status", text: "AIR status" } },
          { type: "button", style: "secondary", action: { type: "message", label: "1st zone", text: "1st zone" } },
          { type: "button", style: "link", action: dashboardAction },
        ],
      },
    },
  };
}

function handleText(text) {
  const msg = text.trim().toLowerCase();

  // exact matches
  switch (msg) {
    case "hi":
    case "hello":
    case "สวัสดี":
      return [menuMessage("สวัสดีสมาชิกแห่งจักพรรดิกุ้งที่ 1\nวันนี้ข้าสามารถช่วยอะไรเจ้าได้หรือไม่")];
    case "help":
    case "ช่วย":
      return [
        { type: "text", text: "Commands: hi, status, temp <number>" },
        menuMessage("เลือกเมนูด้านล่างได้เลย"),
      ];
    case "status":
      return [{ type: "text", text: "All systems OK" }];

    // menu buttons
    case "air status":
      return [{ type: "text", text: "AIR status: OK" }]; // TODO: real sensor data
    case "1st zone":
      return [{ type: "text", text: "1st zone: OK" }]; // TODO: real zone data
    case "view dashboard":
      return [{ type: "text", text: "Dashboard link is not set yet (DASHBOARD_URL)." }];
  }

  // commands with arguments, e.g. "temp 30"
  if (msg.startsWith("temp ")) {
    const value = Number(msg.slice(5));
    if (Number.isNaN(value)) return [{ type: "text", text: "Usage: temp <number>" }];
    return [{ type: "text", text: `Threshold set to ${value}°C` }];
  }

  // fallback
  const shown = text.length > 50 ? text.slice(0, 50) + "…" : text; // altText max is 400 chars
  return [menuMessage(`Sorry, I don't know "${shown}". Choose an option below.`)];
}

module.exports = { reply, startLoading, handleText, menuMessage };
