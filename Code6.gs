// --- Web App Entry Point ---
function doPost(e) {
  let response;
  try {
    Logger.log("Code6.gs doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;

    if (!action) {
      throw new Error("Action parameter is missing in the request.");
    }

    // All actions here require a valid token
    if (!payload || !payload.authToken || !payload.spreadsheetId || !payload.userType) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Authentication details are missing.', authError: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    const isValidToken = verifyAuthToken(payload.spreadsheetId, payload.authToken, payload.userType, payload.staffId);
    if (!isValidToken) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid or expired token. Please log in again.', authError: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    switch (action) {
      case 'getRequiredDataForTools':
        response = getRequiredDataForTools(payload.spreadsheetId, payload.sheetNames);
        break;
      default:
        response = { success: false, message: `Unknown action in Code6.gs: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in Code6.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error in Code6.gs: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Fetches data from a specified list of sheets within a spreadsheet.
 * @param {string} spreadsheetId The ID of the spreadsheet.
 * @param {string[]} sheetNames An array of sheet names to fetch data from.
 * @returns {object} An object containing the data for each requested sheet.
 */
function getRequiredDataForTools(spreadsheetId, sheetNames) {
  if (!spreadsheetId || !Array.isArray(sheetNames) || sheetNames.length === 0) {
    return { success: false, message: "Spreadsheet ID and a list of sheet names are required." };
  }

  try {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const allData = {};

    sheetNames.forEach(sheetName => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        allData[sheetName] = sheetToObjects(sheet);
      } else {
        Logger.log(`Sheet "${sheetName}" not found in spreadsheet ID: ${spreadsheetId}.`);
        allData[sheetName] = []; // Return empty array if sheet not found
      }
    });

    return { success: true, data: allData };

  } catch (error) {
    Logger.log(`Error in getRequiredDataForTools for spreadsheet ${spreadsheetId}: ${error.stack}`);
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

function sheetToObjects(sheet) {
    if (!sheet || sheet.getLastRow() < 2) {
        return []; // empty or only headers
    }
    const values = sheet.getDataRange().getValues();
    const headers = values.shift(); // Remove header row
    return values.map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            if (header) { // Only add property if header is not empty
              obj[header] = row[index];
            }
        });
        return obj;
    });
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
