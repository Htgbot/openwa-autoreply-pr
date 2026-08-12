# 🤖 OpenWA Auto-Reply Workflow Plugin & Blueprint Pack

This standalone plugin package provides a complete collection of 1-click **Auto-Reply Workflows (Blueprints)**, **Interactive 2-Step Prompts**, **Quoted Reply Inspectors**, **Image-to-Sticker Converters**, and **Group Bot Mention Triggers** for the OpenWA API Gateway.

---

## ⚡ How to Install / Use

1. **Extract ZIP**: Download and extract this `openwa-autoreply-plugin.zip` file.
2. **Open Dashboard**: Go to your OpenWA Dashboard (`http://localhost:3000` or your VPS URL) and click **Auto Reply**.
3. **Import Blueprint**:
   - Click the **`Import JSON`** button at the top right of the workflow editor.
   - Open any `.json` file from the `workflows/` directory in a text editor (e.g. `01-image-to-sticker.json` or `03-interactive-nic-lookup.json`).
   - Copy the JSON content, paste it into the Import dialog, and click **Import Workflow**.
4. **Save**: Click **`Save Workflow`** to activate the automation on your session!

---

## 📂 Pack Contents

- **`workflows/01-image-to-sticker.json`**: Reply `.sticker` to any image to convert it into a sticker.
- **`workflows/02-message-inspector.json`**: Reply `.reply` to inspect replied message details.
- **`workflows/03-interactive-nic-lookup.json`**: 2-step prompt flow asking for NIC/Order ID and calling HTTP API.
- **`workflows/04-group-self-mention-bot.json`**: Triggers when users tag `@bot update` in group chats using phone or LID.
- **`workflows/05-regex-order-extractor.json`**: One-line regex parameter extractor (`order 123456`).
- **`workflows/06-auto-read-greeting.json`**: Auto marks conversation as read and replies with personalized greeting.

For detailed documentation, token lists, and AI prompt instructions, see [`AUTO_REPLY_WORKFLOW_CATALOG.md`](./AUTO_REPLY_WORKFLOW_CATALOG.md) and [`AI_WORKFLOW_GUIDE.md`](./AI_WORKFLOW_GUIDE.md).
