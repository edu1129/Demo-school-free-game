// --- Web App Entry Point for Dues List ---
function doPost(e) {
  let response;
  try {
    Logger.log("Code2.gs doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;

    if (action === 'getDuesList') {
      if (!payload || !payload.spreadsheetId) {
        throw new Error("Spreadsheet ID is missing in the request payload.");
      }
      response = getStudentsWithDues(payload.spreadsheetId);
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

  } catch (error) {
    Logger.log(`Error in Code2.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// --- Utility to get sheet data ---
function getSheetData(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      Logger.log(`Sheet "${sheetName}" not found in spreadsheet ID: ${spreadsheetId}.`);
      return null;
    }
    if (sheet.getLastRow() < 2) {
        return { headers: [], data: [] }; // Sheet exists but is empty or has only headers
    }
    const values = sheet.getDataRange().getValues();
    const headers = values.shift(); // Remove headers and store them
    const data = values.map(row => {
      let obj = {};
      headers.forEach((header, index) => {
         obj[header] = row[index];
      });
      return obj;
    });
    return { headers, data };
  } catch (e) {
    Logger.log(`Error getting data from sheet "${sheetName}" in spreadsheet ID ${spreadsheetId}: ${e}`);
    throw new Error(`Could not access or read sheet: ${sheetName}.`);
  }
}


// --- Main Logic Function ---
function getStudentsWithDues(spreadsheetId) {
  try {
    const studentsResult = getSheetData(spreadsheetId, 'Students');
    const feesResult = getSheetData(spreadsheetId, 'StudentsFees');
    const classesResult = getSheetData(spreadsheetId, 'Classes');

    if (!studentsResult || !feesResult || !classesResult) {
      throw new Error("Required sheets (Students, StudentsFees, Classes) not found or are inaccessible.");
    }

    const studentsData = studentsResult.data;
    const feesData = feesResult.data;
    const classesData = classesResult.data;

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
