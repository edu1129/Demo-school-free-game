// --- Global Configuration ---
const MAIN_SPREADSHEET_ID = '1PjNIMBpDWqU_Vj8SHnCG39mvAqjZ1S51lcLxK5Apzf8';
const MAIN_SHEET_NAME = 'Schools';
const RESULT_SHEET_NAME = 'results1129';

function doPost(e) {
  let response;
  try {
    Logger.log("Code4.gs doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;

    if (!action) {
      throw new Error("Action parameter is missing in the request.");
    }

    switch (action) {
      case 'getStudentResult':
        response = getStudentResult(payload.schoolCode, payload.className, payload.rollNumber);
        break;
      default:
        response = { success: false, message: `Unknown action: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in Code4.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheetDataAsObjects(sheet) {
  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  return data.map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function getStudentResult(schoolCode, className, rollNumber) {
  try {
    if (!schoolCode || !className || !rollNumber) {
      return { success: false, message: "School Code, Class Name, and Roll Number are required." };
    }

    // 1. Find the school in the main spreadsheet
    const mainSS = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const mainSheet = mainSS.getSheetByName(MAIN_SHEET_NAME);
    if (!mainSheet) {
      throw new Error(`Main sheet '${MAIN_SHEET_NAME}' not found.`);
    }

    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData[0];
    
    // Assuming column names as per request
    const schoolCodeIndex = mainHeaders.indexOf("SchoolCode"); // Column R
    const spreadsheetIdIndex = mainHeaders.indexOf("SchoolSpreadsheetID"); // Column I
    const schoolNameIndex = mainHeaders.indexOf("School Name"); // Column A
    const addressIndex = mainHeaders.indexOf("Address"); // Column F

    if (schoolCodeIndex === -1 || spreadsheetIdIndex === -1 || schoolNameIndex === -1 || addressIndex === -1) {
      throw new Error("Main spreadsheet is missing required columns: SchoolCode, SchoolSpreadsheetID, School Name, Address.");
    }

    let schoolInfo = null;
    let schoolSpreadsheetId = null;

    for (let i = 1; i < mainData.length; i++) {
      if (mainData[i][schoolCodeIndex] == schoolCode) {
        schoolSpreadsheetId = mainData[i][spreadsheetIdIndex];
        schoolInfo = {
          name: mainData[i][schoolNameIndex],
          address: mainData[i][addressIndex]
        };
        break;
      }
    }

    if (!schoolSpreadsheetId) {
      return { success: false, message: "Invalid School Code. School not found." };
    }

    // 2. Find the student in the school's result spreadsheet
    const schoolSS = SpreadsheetApp.openById(schoolSpreadsheetId);
    const resultSheet = schoolSS.getSheetByName(RESULT_SHEET_NAME);
    if (!resultSheet) {
      return { success: false, message: `Result sheet '${RESULT_SHEET_NAME}' not found for this school.` };
    }

    const studentsResults = getSheetDataAsObjects(resultSheet);
    
    const studentRecord = studentsResults.find(student => 
      student.ClassName == className && student.RollNumber == rollNumber
    );

    if (!studentRecord) {
      return { success: false, message: "Student not found with the provided Class and Roll Number." };
    }

    // 3. Prepare and return the data (without any IDs)
    const studentInfo = {
      resultName: studentRecord.ResultName,
      className: studentRecord.ClassName,
      timestamp: studentRecord.Timestamp,
      rollNumber: studentRecord.RollNumber,
      name: studentRecord.Name,
      mobile: studentRecord.Mobile,
      gmail: studentRecord.Gmail,
      fatherName: studentRecord.FatherName,
      motherName: studentRecord.MotherName,
      address: studentRecord.Address,
      photoUrl: studentRecord.PhotoURL,
      aadhar: studentRecord.Aadhar,
      gender: studentRecord.Gender,
      registrationDate: studentRecord.RegistrationDate,
      marks: {}
    };

    // Extract all columns ending with '_Marks'
    for (const key in studentRecord) {
      if (key.endsWith('_Marks') && studentRecord[key] !== '') {
        const subject = key.replace('_Marks', '').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
        studentInfo.marks[subject] = studentRecord[key];
      }
    }
    
    return {
      success: true,
      schoolInfo: schoolInfo,
      studentInfo: studentInfo
    };

  } catch (error) {
    Logger.log(`Error in getStudentResult: ${error.stack}`);
    return { success: false, message: `An error occurred: ${error.message}` };
  }
}
