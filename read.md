Implemented a decentralized, token-based authentication system for each school.

- On login, a unique auth token is generated and stored in a sheet named 'auth' within the specific school's spreadsheet.
- This 'auth' sheet holds tokens for the principal and all teachers associated with that particular school.
- The system automatically creates the 'auth' sheet within the school's spreadsheet if it doesn't exist during login or school setup.
- All subsequent API requests are authenticated using the token against the school's dedicated 'auth' sheet.
- An auto-login feature has been added to restore sessions by verifying the token against the correct school's spreadsheet.
