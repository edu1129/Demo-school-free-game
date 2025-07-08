Implemented a centralized, token-based authentication system.

- On login, a unique auth token is generated and stored in a central 'auth' spreadsheet and in the browser's local storage.
- This central spreadsheet holds tokens for all users (principals and teachers).
- The system automatically creates the 'auth' spreadsheet if it doesn't exist.
- All subsequent API requests are authenticated using this token against the central sheet.
- An auto-login feature has been added to restore sessions when the user revisits the page.
