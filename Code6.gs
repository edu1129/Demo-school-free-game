// --- Web App Entry Point for Class/Subject Management ---
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
    const isValidToken = verifyAuthToken(payload.spreadsheetId, payload.authToken, payload.userType, null); // staffId not needed for principal actions
    if (!isValidToken) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid or expired token. Please log in again.', authError: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    switch (action) {
      case 'getInitialData':
        response = getInitialData(payload.spreadsheetId);
        break;
      case 'addClass':
        response = addClass(payload.spreadsheetId, payload.classInfo);
        break;
      case 'addSubject':
        response = addSubject(payload.spreadsheetId, payload.subjectInfo);
        break;
      case 'assignTeacher':
        response = assignTeacher(payload.spreadsheetId, payload.assignmentInfo);
        break;
      default:
        response = { success: false, message: `Unknown action: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in Code6.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Main Logic Functions ---

function getInitialData(spreadsheetId) {
    try {
        const classes = sheetToObjects(getSheet(spreadsheetId, 'Classes'));
        const subjects = sheetToObjects(getSheet(spreadsheetId, 'Subjects'));
        const staff = sheetToObjects(getSheet(spreadsheetId, 'Staffs')).filter(s => s.IsActive === true || String(s.IsActive).toUpperCase() === 'TRUE');
        const assignments = sheetToObjects(getSheet(spreadsheetId, 'ClassSubjects'));

        return {
            success: true,
            data: {
                classes: classes,
                subjects: subjects,
                staff: staff,
                assignments: assignments
            }
        };
    } catch (error) {
        Logger.log(`Error in getInitialData: ${error.stack}`);
        return { success: false, message: error.message };
    }
}

function addClass(spreadsheetId, classInfo) {
    try {
        const classSheet = getSheet(spreadsheetId, 'Classes');
        if (!classSheet) throw new Error("Classes sheet not found.");

        const classId = generateUUID();
        const headers = classSheet.getRange(1, 1, 1, classSheet.getLastColumn()).getValues()[0];
        const newRow = headers.map(header => {
            switch(header) {
                case 'ClassID': return classId;
                case 'ClassName': return classInfo.className;
                case 'Section': return classInfo.section || '';
                case 'ClassTeacherStaffID': return classInfo.classTeacherId || '';
                default: return '';
            }
        });

        classSheet.appendRow(newRow);
        Logger.log(`Added Class ${classInfo.className} with ID ${classId} to ${spreadsheetId}`);
        return { success: true, message: 'Class added successfully.', classId: classId };
    } catch (error) {
        Logger.log(`Error adding class: ${error.stack}`);
        return { success: false, message: `Failed to add class: ${error.message}` };
    }
}

function addSubject(spreadsheetId, subjectInfo) {
    try {
        const subjectSheet = getSheet(spreadsheetId, 'Subjects');
        if (!subjectSheet) throw new Error("Subjects sheet not found.");

        const subjectId = generateUUID();
        const headers = subjectSheet.getRange(1, 1, 1, subjectSheet.getLastColumn()).getValues()[0];
        const newRow = headers.map(header => {
            switch(header) {
                case 'SubjectID': return subjectId;
                case 'SubjectName': return subjectInfo.subjectName;
                default: return '';
            }
        });

        subjectSheet.appendRow(newRow);
        Logger.log(`Added Subject ${subjectInfo.subjectName} with ID ${subjectId} to ${spreadsheetId}`);
        return { success: true, message: 'Subject added successfully.', subjectId: subjectId };
    } catch (error) {
        Logger.log(`Error adding subject: ${error.stack}`);
        return { success: false, message: `Failed to add subject: ${error.message}` };
    }
}

function assignTeacher(spreadsheetId, assignmentInfo) {
    try {
        const assignmentSheet = getSheet(spreadsheetId, 'ClassSubjects');
        if (!assignmentSheet) throw new Error("ClassSubjects sheet not found.");

        const assignmentId = generateUUID();
        const headers = assignmentSheet.getRange(1, 1, 1, assignmentSheet.getLastColumn()).getValues()[0];
        const newRow = headers.map(header => {
            switch(header) {
                case 'AssignmentID': return assignmentId;
                case 'ClassID': return assignmentInfo.classId;
                case 'SubjectID': return assignmentInfo.subjectId;
                case 'StaffID': return assignmentInfo.staffId;
                default: return '';
            }
        });

        assignmentSheet.appendRow(newRow);
        Logger.log(`Assigned teacher ${assignmentInfo.staffId} to class ${assignmentInfo.classId} for subject ${assignmentInfo.subjectId}`);
        return { success: true, message: 'Teacher assigned successfully.', assignmentId: assignmentId };
    } catch (error) {
        Logger.log(`Error assigning teacher: ${error.stack}`);
        return { success: false, message: `Failed to assign teacher: ${error.message}` };
    }
}


// --- Utility Functions (Self-contained) ---

function generateUUID() {
  return Utilities.getUuid();
}

function getSheet(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
       Logger.log(`Sheet "${sheetName}" not found in spreadsheet ID: ${spreadsheetId}.`);
       // This tool assumes sheets exist from main setup.
       throw new Error(`Sheet "${sheetName}" not found. Please ensure it exists.`);
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
    return false;
  }
  try {
    const authSheet = getSheet(spreadsheetId, 'auth');
    if (!authSheet || authSheet.getLastRow() < 2) {
      return false;
    }
    const data = authSheet.getDataRange().getValues();
    const headers = data[0];
    const userIdIndex = headers.indexOf('UserID');
    const userTypeIndex = headers.indexOf('UserType');
    const tokenIndex = headers.indexOf('AuthToken');
    if (userIdIndex === -1 || userTypeIndex === -1 || tokenIndex === -1) {
      return false;
    }
    const userIdToFind = userType === 'principal' ? 'principal' : staffId;
    if (!userIdToFind) {
        return false;
    }
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[userIdIndex] == userIdToFind && row[userTypeIndex] == userType) {
        return (row[tokenIndex] && token === row[tokenIndex]);
      }
    }
    return false;
  } catch (e) {
    Logger.log(`Error during token verification for ${spreadsheetId}: ${e}`);
    return false;
  }
}