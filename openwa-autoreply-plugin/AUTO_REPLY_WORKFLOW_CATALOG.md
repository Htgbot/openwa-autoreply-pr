# OpenWA Visual Auto-Reply Workflow Catalog & Blueprint Guide

Welcome to the **OpenWA Visual Auto-Reply Workflow Catalog**. This directory contains ready-to-import JSON workflow blueprints that you can use immediately in your OpenWA deployment or share with the community on GitHub.

---

## ⚡ How to Import a Workflow Blueprint (1-Click Import)

1. Open your OpenWA Dashboard (`http://localhost:3000` or your VPS domain).
2. Go to **Auto Reply** in the left sidebar menu.
3. Click the **`Import JSON`** button at the top toolbar.
4. Paste any of the JSON blueprints below into the text box and click **Import Workflow**.
5. Click **`Save Workflow`** to activate it on your connected WhatsApp account!

---

## 📚 Workflow Catalog Blueprints

---

### 1. 🖼️ Owner Image to Sticker Converter Blueprint (`.sticker`)
Automatically converts any quoted image into a WhatsApp sticker when the account owner or linked device replies `.sticker` to an image.

- **File**: [`workflows/01-image-to-sticker.json`](file:///d:/openwacode/OpenWA/workflows/01-image-to-sticker.json)
- **Trigger**: `.sticker` (Equals match)
- **Features**:
  - `restrictToOwner: true` (Only runs when sent from your account or linked phones)
  - `restrictedEmoji: "☠️"` (Reacts with ☠️ emoji if a non-owner tries to run it)
  - `mediaSource: "replied_message"` (Extracts media from quoted message without needing command media)

#### 📋 JSON Blueprint:
```json
{
  "name": "Owner Image to Sticker Converter",
  "nodes": [
    {
      "id": "node_trigger_sticker",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "equals",
        "matchValue": ".sticker",
        "chatScope": "all",
        "triggerOnSelfSent": true,
        "restrictToOwner": true,
        "restrictedEmoji": "☠️",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_condition_has_reply",
      "type": "condition",
      "x": 350,
      "y": 180,
      "data": {
        "variable": "reply_exists",
        "operator": "==",
        "value": "true"
      }
    },
    {
      "id": "node_condition_is_image",
      "type": "condition",
      "x": 600,
      "y": 120,
      "data": {
        "variable": "reply_type",
        "operator": "==",
        "value": "image"
      }
    },
    {
      "id": "node_send_sticker",
      "type": "reply_media",
      "x": 850,
      "y": 80,
      "data": {
        "mediaType": "sticker",
        "mediaSource": "replied_message",
        "mediaUrl": "{reply_media_url}",
        "mediaBase64": "{reply_media_base64}"
      }
    },
    {
      "id": "node_reply_not_image",
      "type": "reply_text",
      "x": 850,
      "y": 240,
      "data": {
        "text": "☠️ Replied message type: {reply_type}\nPlease reply directly to an image with .sticker"
      }
    },
    {
      "id": "node_reply_not_reply",
      "type": "reply_text",
      "x": 600,
      "y": 380,
      "data": {
        "text": "☠️ Not a reply.\nPlease reply directly to an image with .sticker"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_sticker_trigger_reply",
      "source": "node_trigger_sticker",
      "target": "node_condition_has_reply"
    },
    {
      "id": "edge_sticker_has_reply",
      "source": "node_condition_has_reply",
      "target": "node_condition_is_image",
      "sourceHandle": "true"
    },
    {
      "id": "edge_sticker_no_reply",
      "source": "node_condition_has_reply",
      "target": "node_reply_not_reply",
      "sourceHandle": "false"
    },
    {
      "id": "edge_sticker_is_image",
      "source": "node_condition_is_image",
      "target": "node_send_sticker",
      "sourceHandle": "true"
    },
    {
      "id": "edge_sticker_not_image",
      "source": "node_condition_is_image",
      "target": "node_reply_not_image",
      "sourceHandle": "false"
    }
  ]
}
```

---

### 2. 🔎 Owner Replied Message Inspector Blueprint (`.reply`)
Inspects and returns full metadata of any message you reply to on WhatsApp (message ID, text, type, media URL, MIME type, view-once flag, chat JID).

- **File**: [`workflows/02-message-inspector.json`](file:///d:/openwacode/OpenWA/workflows/02-message-inspector.json)
- **Trigger**: `.reply` (Equals match)
- **Features**:
  - Exposes normalized tokens `{reply_exists}`, `{reply_type}`, `{reply_text}`, `{reply_media_url}`, `{reply_mimetype}`, `{reply_message_id}`, `{chat_id}`

#### 📋 JSON Blueprint:
```json
{
  "name": "Owner Replied Message Inspector",
  "nodes": [
    {
      "id": "node_trigger_reply",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "equals",
        "matchValue": ".reply",
        "chatScope": "all",
        "triggerOnSelfSent": true,
        "restrictToOwner": true,
        "restrictedEmoji": "🔎",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_condition_reply_exists",
      "type": "condition",
      "x": 380,
      "y": 180,
      "data": {
        "variable": "reply_exists",
        "operator": "==",
        "value": "true"
      }
    },
    {
      "id": "node_reply_info",
      "type": "reply_text",
      "x": 700,
      "y": 100,
      "data": {
        "text": "🔎 REPLIED MESSAGE INFO\n\nExists: {reply_exists}\nType: {reply_type}\nText: {reply_text}\n\nHas Media: {reply_has_media}\nMedia URL: {reply_media_url}\nMedia Base64: {reply_media_base64}\nMimetype: {reply_mimetype}\nFilename: {reply_filename}\n\nView Once: {reply_view_once}\nMessage ID: {reply_message_id}\n\nChat ID: {chat_id}\nChat Type: {chat_type}"
      }
    },
    {
      "id": "node_reply_no_reply",
      "type": "reply_text",
      "x": 700,
      "y": 300,
      "data": {
        "text": "🔎 This command was not sent as a reply to another message."
      }
    }
  ],
  "edges": [
    {
      "id": "edge_reply_trigger_condition",
      "source": "node_trigger_reply",
      "target": "node_condition_reply_exists"
    },
    {
      "id": "edge_reply_true",
      "source": "node_condition_reply_exists",
      "target": "node_reply_info",
      "sourceHandle": "true"
    },
    {
      "id": "edge_reply_false",
      "source": "node_condition_reply_exists",
      "target": "node_reply_no_reply",
      "sourceHandle": "false"
    }
  ]
}
```

---

### 3. 💳 2-Step Interactive Customer NIC / Order Lookup Blueprint (`nic`)
Interactive 2-step prompt flow. When a user sends `nic`, the bot asks for their NIC number, captures their reply into `{nic}`, calls an HTTP API, and branches based on HTTP status code `200`.

- **File**: [`workflows/03-interactive-nic-lookup.json`](file:///d:/openwacode/OpenWA/workflows/03-interactive-nic-lookup.json)
- **Trigger**: `nic`
- **Features**:
  - `prompt_input` node saves user's reply into `{nic}`
  - `api_call` node sends POST request with `{nic}` and `{sender_number}`
  - `condition` node checks `{status} == 200` to branch success vs failure reply

#### 📋 JSON Blueprint:
```json
{
  "name": "2-Step Interactive NIC / Order Lookup",
  "nodes": [
    {
      "id": "node_trig_nic",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "equals",
        "matchValue": "nic",
        "chatScope": "all",
        "triggerOnSelfSent": false,
        "restrictToOwner": false,
        "restrictedEmoji": "🎉",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_prompt_nic",
      "type": "prompt_input",
      "x": 380,
      "y": 180,
      "data": {
        "promptText": "Please send your NIC number only:",
        "variableName": "nic"
      }
    },
    {
      "id": "node_api_lookup",
      "type": "api_call",
      "x": 660,
      "y": 180,
      "data": {
        "method": "POST",
        "url": "https://httpbin.org/post?nic={nic}&chatid={chat_id}",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": "{\"nic\": \"{nic}\", \"sender\": \"{sender_number}\"}"
      }
    },
    {
      "id": "node_cond_api_ok",
      "type": "condition",
      "x": 940,
      "y": 180,
      "data": {
        "variable": "status",
        "operator": "==",
        "value": "200"
      }
    },
    {
      "id": "node_reply_success",
      "type": "reply_text",
      "x": 1220,
      "y": 100,
      "data": {
        "text": "✅ Verification Successful for {name}!\n\nNIC: {nic}\nStatus: {status}\nURL: {data.url}\nDate: {datetime}"
      }
    },
    {
      "id": "node_reply_failed",
      "type": "reply_text",
      "x": 1220,
      "y": 280,
      "data": {
        "text": "❌ Verification Failed for {name}.\n\nNIC: {nic}\nError Code: {status}\nDetails: {response_error}"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_trig_prompt",
      "source": "node_trig_nic",
      "target": "node_prompt_nic"
    },
    {
      "id": "edge_prompt_api",
      "source": "node_prompt_nic",
      "target": "node_api_lookup"
    },
    {
      "id": "edge_api_cond",
      "source": "node_api_lookup",
      "target": "node_cond_api_ok"
    },
    {
      "id": "edge_cond_true",
      "source": "node_cond_api_ok",
      "target": "node_reply_success",
      "sourceHandle": "true"
    },
    {
      "id": "edge_cond_false",
      "source": "node_cond_api_ok",
      "target": "node_reply_failed",
      "sourceHandle": "false"
    }
  ]
}
```

---

### 4. 🤖 Dynamic Group Self-Mention Bot Blueprint (`@bot update`)
Triggers in WhatsApp groups when users tag your bot's phone number or privacy LID e.g. `@127135947722784 update`.

- **File**: [`workflows/04-group-self-mention-bot.json`](file:///d:/openwacode/OpenWA/workflows/04-group-self-mention-bot.json)
- **Trigger**: `update` (Equals match)
- **Features**:
  - `requireMentionedSelf: true` (Only triggers when the bot account is tagged)
  - `stripSelfMentionBeforeMatch: true` (Strips `@127135947722784` before matching `update`)
  - Exposes mention tokens `{mentioned_self}`, `{mentions}`, `{self_id}`, `{self_lid}`

#### 📋 JSON Blueprint:
```json
{
  "name": "Dynamic Self Mention Update Bot",
  "nodes": [
    {
      "id": "node_trigger_self_mention",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "equals",
        "matchValue": "update",
        "chatScope": "group",
        "triggerOnSelfSent": true,
        "restrictToOwner": true,
        "restrictedEmoji": "🤖",
        "requireMentionedSelf": true,
        "stripSelfMentionBeforeMatch": true
      }
    },
    {
      "id": "node_reply_mention_info",
      "type": "reply_text",
      "x": 480,
      "y": 180,
      "data": {
        "text": "🤖 SELF MENTION DETECTED\n\nMentioned Self: {mentioned_self}\nMentions: {mentions}\n\nSelf ID: {self_id}\nSelf LID: {self_lid}\n\nOriginal Message: {message}\n\nSender: {sender_number}\nSender ID: {sender_id}\nChat ID: {chat_id}\nChat Type: {chat_type}"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_self_mention_reply",
      "source": "node_trigger_self_mention",
      "target": "node_reply_mention_info"
    }
  ]
}
```

---

### 5. 📦 One-Line Regex Order ID Extractor Blueprint (`order 123456`)
Extracts parameters directly from one-line commands like `order 2000123` using named regex groups `(?<orderid>\d+)` without asking a 2-step question.

- **File**: [`workflows/05-regex-order-extractor.json`](file:///d:/openwacode/OpenWA/workflows/05-regex-order-extractor.json)
- **Trigger**: `order` (Starts With)
- **Features**:
  - `extract_regex` node uses `order\s+(?<orderid>\d{5,12})` to extract `{orderid}`
  - Automatically queries GET API endpoint with `{orderid}` and replies

#### 📋 JSON Blueprint:
```json
{
  "name": "One-Line Regex Order ID Extractor",
  "nodes": [
    {
      "id": "node_trigger_order",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "starts_with",
        "matchValue": "order",
        "chatScope": "all",
        "triggerOnSelfSent": false,
        "restrictToOwner": false,
        "restrictedEmoji": "🎉",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_extract_order",
      "type": "extract_regex",
      "x": 380,
      "y": 180,
      "data": {
        "pattern": "order\\s+(?<orderid>\\d{5,12})",
        "variableName": "orderid"
      }
    },
    {
      "id": "node_api_order",
      "type": "api_call",
      "x": 660,
      "y": 180,
      "data": {
        "method": "GET",
        "url": "https://httpbin.org/get?orderid={orderid}&user={sender_number}",
        "headers": {},
        "body": ""
      }
    },
    {
      "id": "node_reply_order",
      "type": "reply_text",
      "x": 940,
      "y": 180,
      "data": {
        "text": "📦 Order Status for #{orderid}\n\nCustomer: {name}\nHTTP Status: {status}\nQueried URL: {data.url}"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1_2",
      "source": "node_trigger_order",
      "target": "node_extract_order"
    },
    {
      "id": "edge_2_3",
      "source": "node_extract_order",
      "target": "node_api_order"
    },
    {
      "id": "edge_3_4",
      "source": "node_api_order",
      "target": "node_reply_order"
    }
  ]
}
```

---

### 6. 👋 Auto Mark-Read & Welcome Greeting Blueprint
Automatically marks incoming personal WhatsApp messages as read and replies with a personalized welcome greeting.

- **File**: [`workflows/06-auto-read-greeting.json`](file:///d:/openwacode/OpenWA/workflows/06-auto-read-greeting.json)
- **Trigger**: `hello` (Contains match, Personal Scope)
- **Features**:
  - `mark_read` node marks the chat as read on WhatsApp Web
  - `reply_text` node uses date/time tokens `{date}` and `{time}`

#### 📋 JSON Blueprint:
```json
{
  "name": "Auto Mark-Read & Welcome Greeting",
  "nodes": [
    {
      "id": "node_trig_hi",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "contains",
        "matchValue": "hello",
        "chatScope": "personal",
        "triggerOnSelfSent": false,
        "restrictToOwner": false,
        "restrictedEmoji": "🎉",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_mark_read",
      "type": "mark_read",
      "x": 380,
      "y": 180,
      "data": {}
    },
    {
      "id": "node_reply_greeting",
      "type": "reply_text",
      "x": 660,
      "y": 180,
      "data": {
        "text": "👋 Hello {name}!\n\nWelcome to our WhatsApp Support.\nDate: {date} | Time: {time}\n\nHow can we help you today?"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_trig_read",
      "source": "node_trig_hi",
      "target": "node_mark_read"
    },
    {
      "id": "edge_read_greeting",
      "source": "node_mark_read",
      "target": "node_reply_greeting"
    }
  ]
}
```

---

## 📖 Complete Variable Tokens Reference Table

You can use any of these tokens in **Reply Texts**, **API Endpoint URLs**, **JSON Bodies**, and **HTTP Headers**:

| Token Category | Variable Token | Description | Example Value |
| :--- | :--- | :--- | :--- |
| **Sender & Contact** | `{name}` | Sender push name / display name | `"John"` |
| | `{sender_number}` | Phone number digits | `"628123456789"` |
| | `{sender_id}` | Sender WhatsApp JID | `"628123456789@c.us"` |
| **Chat & Groups** | `{chat_id}` | Conversation JID | `"120363@g.us"` or `"628123@c.us"` |
| | `{group_id}` | Group JID or empty | `"120363@g.us"` |
| | `{channel_id}` | Newsletter JID or empty | `"120363@newsletter"` |
| | `{chat_type}` | Scope kind | `"group"`, `"channel"`, `"personal"` |
| **Quoted Reply Context** | `{reply_exists}` | Quoted reply presence | `"true"` or `"false"` |
| | `{reply_message_id}` | Quoted message ID | `"3EB0123..."` |
| | `{reply_type}` | Quoted message type | `"text"`, `"image"`, `"document"`, `"audio"`, `"sticker"`, `"view_once"` |
| | `{reply_text}` | Quoted text body | `"Check this photo"` |
| | `{reply_has_media}` | Quoted media flag | `"true"` or `"false"` |
| | `{reply_media_url}` | Quoted media Data URI / URL | `"data:image/jpeg;base64,..."` |
| | `{reply_media_base64}` | Raw quoted media Base64 payload | `"iVBORw0KGgo..."` |
| | `{reply_mimetype}` | Quoted media MIME type | `"image/png"` |
| | `{reply_filename}` | Quoted document filename | `"receipt.pdf"` |
| | `{reply_view_once}` | Quoted view-once flag | `"true"` or `"false"` |
| **Bot Mentions** | `{mentioned_self}` | Bot tagged flag | `"true"` or `"false"` |
| | `{mentions}` | List of tagged JIDs | `"628123@c.us,127135@lid"` |
| | `{self_id}` | Bot phone JID | `"628123456789@c.us"` |
| | `{self_lid}` | Bot privacy LID JID | `"127135947722784@lid"` |
| **Date & Time** | `{date}` | Current Date | `"2026-08-12"` |
| | `{time}` | Current Time | `"23:55:00"` |
| | `{datetime}` | Date & Time string | `"2026-08-12 23:55:00"` |
| **API Responses** | `{status}` | HTTP status code | `200`, `400`, `500` |
| | `{response_raw}` | Raw API response string | `"{ \"ok\": true }"` |
| | `{response_error}` | Network error message | `"FetchError: ECONNREFUSED"` |
| | `{data.<field>}` | JSON response field | `{data.message}`, `{data.user.name}` |
| **Custom Input** | `{<var_name>}` | Prompt or regex variable | `{nic}`, `{orderid}` |

---

## 🤖 Asking AI to Generate Custom Workflows

You can paste [`AI_WORKFLOW_GUIDE.md`](file:///d:/openwacode/OpenWA/AI_WORKFLOW_GUIDE.md) into any AI model (ChatGPT, Claude, DeepSeek, Gemini) and ask:

> *"Build me an OpenWA workflow JSON that asks for a flight number, checks my flight API, and replies with departure gate details."*

The AI will output a valid JSON blueprint that you can import with 1 click!
