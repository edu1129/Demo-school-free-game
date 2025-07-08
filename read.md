Implemented a new decentralized, token-based authentication system for each school.

- On every login, a new unique auth token is generated.
- This token is stored in a dedicated sheet named 'auth' within each school's personal spreadsheet.
- The 'auth' sheet centralizes session tokens for both the principal and all teachers of that school.
- The system automatically creates and configures the 'auth' sheet if it doesn't exist.
- All protected API requests are now verified against this centralized 'auth' sheet, ensuring robust and school-specific security.
- The token has no expiration time but is regenerated upon each successful login.
- An auto-login feature restores sessions by verifying the stored token against the correct school's 'auth' sheet.
