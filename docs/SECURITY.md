# Security — Charkh o Falak 1.1.0

The extension requests Chrome's `scripting` permission and access to `https://flow.google.com/*`.

Interaction with scripts running on the same page may introduce compatibility issues. Messages exchanged within that page do not independently authenticate their sender, so other page scripts may send similar messages. Disabling the extension does not necessarily reverse changes already applied to an open tab until it is reloaded.

This release has not undergone an independent security audit or official Chrome Web Store approval. Never publish passwords, cookies, tokens or other sensitive data in issue reports.
