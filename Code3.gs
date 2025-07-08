function doPost(e) {
  let response;
  try {
    Logger.log("Code3.gs doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const payload = requestData.payload;

    // All actions here require a valid token
    if (!payload || !payload.authToken || !payload.spreadsheetId) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Authentication details are missing.', authError: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const isValidToken = verifyAuthToken(payload.spreadsheetId, payload.authToken, payload.userType, payload.staffId);
    if (!isValidToken) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid or expired token. Please log in again.', authError: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    response = getAllSheetData(payload.spreadsheetId);

  } catch (error) {
    Logger.log(`Error in Code3.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function getAllSheetData(spreadsheetId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheets = spreadsheet.getSheets();
    
    const allData = sheets.map(sheet => {
      const sheetName = sheet.getName();
      const dataRange = sheet.getDataRange();
      const values = dataRange.getValues();
      return {
        sheetName: sheetName,
        data: values
      };
    });

    return { success: true, data: allData };

  } catch (error) {
    Logger.log(`Error in getAllSheetData for spreadsheet ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to retrieve sheet data: ${error.message}` };
  }
}

// --- Utility Functions (Copied for self-containment) ---

function getSheet(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
       Logger.log(`Sheet "${sheetName}" not found in spreadsheet ID: ${spreadsheetId}.`);
    }
    return sheet;
  } catch (e) {
    Logger.log(`Error getting sheet "${sheetName}" in spreadsheet ID ${spreadsheetId}: ${e}`);
    throw new Error(`Could not access sheet: ${sheetName}. Error: ${e.message}`);
  }
}

function verifyAuthToken(spreadsheetId, token, userType, staffId) {
  if (!spreadsheetId || !token || !userType) {
    Logger.log(`Token verification failed: Missing parameters. SS_ID: ${!!spreadsheetId}, Token: ${!!token}, UserType: ${userType}`);
    return false;
  }
  try {
    const authSheet = getSheet(spreadsheetId, 'auth');
    if (!authSheet || authSheet.getLastRow() < 2) {
      Logger.log(`Token verification failed: 'auth' sheet not found or empty in ${spreadsheetId}.`);
      return false;
    }

    const data = authSheet.getDataRange().getValues();
    const headers = data[0];
    const userIdIndex = headers.indexOf('UserID');
    const userTypeIndex = headers.indexOf('UserType');
    const tokenIndex = headers.indexOf('AuthToken');

    if (userIdIndex === -1 || userTypeIndex === -1 || tokenIndex === -1) {
      Logger.log(`Token verification failed: 'auth' sheet in ${spreadsheetId} is missing required columns (UserID, UserType, AuthToken).`);
      return false;
    }

    const userIdToFind = userType === 'principal' ? 'principal' : staffId;
    if (!userIdToFind) {
        Logger.log(`Token verification failed: User ID is missing for userType ${userType}.`);
        return false;
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[userIdIndex] == userIdToFind && row[userTypeIndex] == userType) {
        const storedToken = row[tokenIndex];
        if (storedToken && token === storedToken) {
          return true;
        } else {
          Logger.log(`Token mismatch for user ${userIdToFind} in ${spreadsheetId}. Provided: ${token}, Stored: ${storedToken}`);
          return false;
        }
      }
    }

    Logger.log(`Token verification failed: User ${userIdToFind} of type ${userType} not found in 'auth' sheet of ${spreadsheetId}.`);
    return false; // User not found
  } catch (e) {
    Logger.log(`Error during token verification for ${spreadsheetId}: ${e}`);
    return false;
  }
}
