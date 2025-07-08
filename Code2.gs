// --- Web App Entry Point for Dues List ---
function doPost(e) {
  let response;
  try {
    Logger.log("Code2.gs doPost received data: " + e.postData.contents);
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
      case 'getDuesList':
        response = getStudentsWithDues(payload.spreadsheetId);
        break;
      default:
        response = { success: false, message: `Unknown action: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in Code2.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Utility Functions ---

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
    const headers = values.shift();
    return values.map(row => {
        let obj = {};
        headers.forEach((header, index) => {
            obj[header] = row[index];
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


// --- Main Logic Function ---
function getStudentsWithDues(spreadsheetId) {
  try {
    const studentsSheet = getSheet(spreadsheetId, 'Students');
    const feesSheet = getSheet(spreadsheetId, 'StudentsFees');
    const classesSheet = getSheet(spreadsheetId, 'Classes');

    if (!studentsSheet || !feesSheet || !classesSheet) {
      throw new Error("Required sheets (Students, StudentsFees, Classes) not found or are inaccessible.");
    }

    const studentsData = sheetToObjects(studentsSheet);
    const feesData = sheetToObjects(feesSheet);
    const classesData = sheetToObjects(classesSheet);

    // Create maps for efficient lookups
    const studentMap = new Map(studentsData.map(s => [s.StudentID, s]));
    const classMap = new Map(classesData.map(c => [c.ClassID, `${c.ClassName || ''} ${c.Section || ''}`.trim()]));

    const duesByStudent = {};

    feesData.forEach(fee => {
      if (fee.Status && (String(fee.Status).toLowerCase() === 'due' || String(fee.Status).toLowerCase() === 'partial')) {
        const studentId = fee.StudentID;
        const amount = parseFloat(fee.Amount) || 0;
        if (studentId && amount > 0) {
          if (!duesByStudent[studentId]) {
            duesByStudent[studentId] = 0;
          }
          duesByStudent[studentId] += amount;
        }
      }
    });

    const studentsWithDues = Object.keys(duesByStudent).map(studentId => {
      const studentInfo = studentMap.get(studentId);
      if (studentInfo) {
        return {
          studentId: studentId,
          name: studentInfo.Name,
          rollNumber: studentInfo.RollNumber,
          className: classMap.get(studentInfo.Class) || 'N/A',
          dues: duesByStudent[studentId]
        };
      }
      return null; // Student in fees sheet but not in students sheet
    }).filter(Boolean); // Filter out nulls

    return { success: true, data: studentsWithDues };

  } catch (error) {
    Logger.log(`Error in getStudentsWithDues: ${error.stack}`);
    return { success: false, message: error.message };
  }
}
