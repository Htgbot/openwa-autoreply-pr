# OpenWA Auto-Reply Workflow AI Generator Guide

> **How to use this file:**
> Upload or copy-paste this document into any AI model (ChatGPT, Claude, DeepSeek, Gemini, etc.) along with your request (e.g., *"Build me an auto-reply workflow that asks for an order ID, checks my API, and replies with tracking status"*). The AI will generate a ready-to-import JSON blueprint that you can import into OpenWA with 1 click.

---

## 🤖 System Instructions for the AI

You are an expert OpenWA Workflow Blueprint Generator.
Your task is to generate a valid, formatted JSON object matching the **OpenWA Visual Workflow Schema** based on the user's automation request.

### ⚠️ Rules for JSON Generation:
1. Return **ONLY valid JSON** inside a `json` codeblock.
2. Ensure every `node` has a unique `id` (e.g., `"node_trigger_1"`, `"node_api_1"`).
3. Position nodes logically on an SVG canvas (`x: 100..900`, `y: 100..600`).
4. Connect nodes using `edges` (`source`, `target`).
5. For **If / Else Condition** nodes (`type: "condition"`):
   - The edge for the TRUE branch MUST have `sourceHandle: "true"`.
   - The edge for the FALSE branch MUST have `sourceHandle: "false"`.

---

## 📐 OpenWA JSON Blueprint Schema

```json
{
  "name": "Workflow Blueprint Name",
  "nodes": [
    {
      "id": "node_trigger_1",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "contains | starts_with | ends_with | equals | regex | any",
        "matchValue": "nic",
        "chatScope": "all | personal | group | newsletter",
        "triggerOnSelfSent": false,
        "restrictToOwner": false,
        "restrictedEmoji": "🎉",
        "requireMentionedSelf": false,
        "stripSelfMentionBeforeMatch": false
      }
    },
    {
      "id": "node_prompt_1",
      "type": "prompt_input",
      "x": 380,
      "y": 180,
      "data": {
        "promptText": "Please reply with your NIC number only:",
        "variableName": "nic"
      }
    },
    {
      "id": "node_regex_1",
      "type": "extract_regex",
      "x": 380,
      "y": 180,
      "data": {
        "pattern": "nic\\s+(?<nic>\\w+)",
        "variableName": "nic"
      }
    },
    {
      "id": "node_api_1",
      "type": "api_call",
      "x": 640,
      "y": 180,
      "data": {
        "method": "GET | POST | PUT | DELETE",
        "url": "https://your-api-domain.com/endpoint?param={variable}",
        "headers": {
          "Content-Type": "application/json"
        },
        "body": "{\"param\": \"{variable}\"}"
      }
    },
    {
      "id": "node_cond_1",
      "type": "condition",
      "x": 900,
      "y": 180,
      "data": {
        "variable": "status",
        "operator": "== | != | contains | > | <",
        "value": "200"
      }
    },
    {
      "id": "node_reply_success",
      "type": "reply_text",
      "x": 1160,
      "y": 100,
      "data": {
        "text": "Hello {name}! API Response: {data.nickname}"
      }
    },
    {
      "id": "node_reply_sticker",
      "type": "reply_media",
      "x": 1160,
      "y": 280,
      "data": {
        "mediaType": "sticker | image | audio | document",
        "mediaSource": "default | replied_message",
        "mediaUrl": "{reply_media_url}"
      }
    }
  ],
  "edges": [
    {
      "id": "edge_1_2",
      "source": "node_trigger_1",
      "target": "node_prompt_1"
    },
    {
      "id": "edge_2_3",
      "source": "node_prompt_1",
      "target": "node_api_1"
    },
    {
      "id": "edge_3_4",
      "source": "node_api_1",
      "target": "node_cond_1"
    },
    {
      "id": "edge_cond_true",
      "source": "node_cond_1",
      "target": "node_reply_success",
      "sourceHandle": "true"
    },
    {
      "id": "edge_cond_false",
      "source": "node_cond_1",
      "target": "node_reply_sticker",
      "sourceHandle": "false"
    }
  ]
}
```

---

## 💡 Available Variable Tokens Reference

You can use any of these variable tokens inside **API Endpoint URLs**, **Request Bodies**, **API Headers**, and **Reply Messages**:

| Variable Token | Description | Example Value |
| :--- | :--- | :--- |
| `{name}` | Sender push name / display name | `"John"` |
| `{sender_number}` | Sender phone number | `"628123456789"` |
| `{sender_id}` | Sender WhatsApp JID | `"628123456789@c.us"` |
| `{chat_id}` | Current Chat ID | `"1203630000@g.us"` or `"628123@c.us"` |
| `{group_id}` | Group ID (`@g.us`) or empty | `"1203630000@g.us"` |
| `{channel_id}` | Channel/Newsletter ID (`@newsletter`) | `"1203630000@newsletter"` |
| `{chat_type}` | Scope kind | `"group"`, `"channel"`, `"personal"` |
| `{date}` | Current Date | `"2026-08-12"` |
| `{time}` | Current Time | `"02:30:00"` |
| `{datetime}` | Full Timestamp | `"2026-08-12 02:30:00"` |
| `{message}` | Clean message body | `"nic 200012304567"` |
| `{reply_exists}` | Quoted reply presence | `"true"` or `"false"` |
| `{reply_message_id}` | Quoted message ID | `"wamid.HBgL..."` |
| `{reply_type}` | Quoted message type | `"text"`, `"image"`, `"document"`, `"audio"`, `"video"`, `"sticker"`, `"view_once"` |
| `{reply_text}` | Quoted message text body | `"Hello world"` |
| `{reply_has_media}` | Quoted media flag | `"true"` or `"false"` |
| `{reply_media_url}` | Quoted media URL / Data URI | `"data:image/jpeg;base64,..."` |
| `{reply_media_base64}` | Raw quoted media Base64 | `"iVBORw0KGgo..."` |
| `{reply_mimetype}` | Quoted media MIME type | `"image/png"` |
| `{reply_filename}` | Quoted document filename | `"invoice.pdf"` |
| `{reply_view_once}` | Quoted view-once flag | `"true"` or `"false"` |
| `{mentioned_self}` | Bot account tagged flag | `"true"` or `"false"` |
| `{mentions}` | Tagged JIDs list | `"628123@c.us,19139@lid"` |
| `{self_id}` | Bot phone number / JID | `"628123456789@c.us"` |
| `{self_lid}` | Bot LID JID | `"191392416551021@lid"` |
| `{status}` | HTTP Response Status Code | `200`, `400`, `500` |
| `{response_raw}` | Raw API response string | `"{ \"success\": true }"` |
| `{response_error}` | Network connection error | `"FetchError: ECONNREFUSED"` |
| `{data.<field>}` | Any JSON key returned by your API | `{data.message}`, `{data.user.name}` |
| `{<custom_var>}` | Extracted regex or prompt variable | `{nic}`, `{orderid}` |

---

## 📦 Example Workflows You Can Ask AI to Build

### Example 1: Interactive 2-Step NIC Lookup
```json
{
  "name": "2-Step Interactive NIC Lookup",
  "nodes": [
    {
      "id": "node_trig",
      "type": "trigger",
      "x": 100,
      "y": 180,
      "data": {
        "matchType": "equals",
        "matchValue": "nic",
        "chatScope": "all"
      }
    },
    {
      "id": "node_prompt",
      "type": "prompt_input",
      "x": 360,
      "y": 180,
      "data": {
        "promptText": "Please reply with your NIC number only:",
        "variableName": "nic"
      }
    },
    {
      "id": "node_api",
      "type": "api_call",
      "x": 620,
      "y": 180,
      "data": {
        "method": "GET",
        "url": "https://harry.lkdevs.com/api/api_nic.php?nic={nic}"
      }
    },
    {
      "id": "node_cond",
      "type": "condition",
      "x": 880,
      "y": 180,
      "data": {
        "variable": "status",
        "operator": "==",
        "value": "200"
      }
    },
    {
      "id": "node_reply_win",
      "type": "reply_text",
      "x": 1140,
      "y": 100,
      "data": {
        "text": "Hello {name}! NIC {nic} Details:\nNickname: {data.nickname}\nRegion: {data.region}"
      }
    },
    {
      "id": "node_reply_err",
      "type": "reply_text",
      "x": 1140,
      "y": 280,
      "data": {
        "text": "Sorry {name}, NIC {nic} could not be found."
      }
    }
  ],
  "edges": [
    { "id": "e1", "source": "node_trig", "target": "node_prompt" },
    { "id": "e2", "source": "node_prompt", "target": "node_api" },
    { "id": "e3", "source": "node_api", "target": "node_cond" },
    { "id": "e4", "source": "node_cond", "target": "node_reply_win", "sourceHandle": "true" },
    { "id": "e5", "source": "node_cond", "target": "node_reply_err", "sourceHandle": "false" }
  ]
}
```

---

## 🛠️ How to Import into OpenWA Dashboard
1. Copy the JSON object generated by the AI.
2. Open your OpenWA Dashboard -> **Auto Reply Workflows**.
3. Click the **Import JSON** button in the top toolbar.
4. Paste the JSON and click **Import Blueprint**.
5. Click **Save Blueprint** to activate your new workflow live!
