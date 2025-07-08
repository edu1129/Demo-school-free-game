Implemented a token-based authentication system.

- On login, a unique auth token is generated and stored in the user's spreadsheet and in the browser's local storage.
- For principals, the token is in the 'Permissions' sheet.
- For teachers, the token is stored in their row in the 'Staffs' sheet.
- All subsequent API requests are authenticated using this token.
- An auto-login feature has been added to restore sessions when the user revisits the page.
