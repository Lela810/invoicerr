---
sidebar_position: 5.5
---

# Purchase orders

A purchase order is what you send a supplier to order goods or services. Its addressee is a client
flagged as a supplier, and it is sent by email.

## Actions

- **Save draft** - keep the order as a **Draft**, editable
- **Send** - email the order to the supplier, its PDF attached. The recipient is pre-filled from the
  supplier's contact email and can be changed. Sending gives the order its number
- **Cancel** - once **Sent** or **Send failed**, mark the order cancelled
- **Delete** - available only on a **Draft**, after a confirmation; see below

## Deleting a draft

Choose **Delete** in a draft order's row menu or on its own page, then confirm: the draft is removed
permanently. The delete is refused while a goods receipt names the order; delete that receipt first.

:::info[Why a sent purchase order cannot be deleted]
Sending a purchase order gives it a number, and a numbered order is never deleted, even if you edit it
back into a draft afterwards: **Delete** is not offered, and the server refuses it even when asked
directly through the API. Cancel the order instead.
:::

## Statuses

| Status | Meaning |
| --- | --- |
| **Draft** | Created, not yet sent. Editable, and can be deleted |
| **Sending** | Send in progress |
| **Sent** | Emailed to the supplier |
| **Send failed** | The last delivery attempt failed |
| **Cancelled** | Cancelled after it was sent |
