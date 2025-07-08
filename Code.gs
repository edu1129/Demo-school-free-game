
// --- Global Configuration ---
const MAIN_SPREADSHEET_ID = '1PjNIMBpDWqU_Vj8SHnCG39mvAqjZ1S51lcLxK5Apzf8';
const MAIN_SHEET_NAME = 'Schools'; // Assuming the main sheet is named 'Schools'
const AUTH_SHEET_NAME = 'auth';

function getAuthSheet() {
  const properties = PropertiesService.getScriptProperties();
  let spreadsheetId = properties.getProperty('AUTH_SPREADSHEET_ID');
  let ss;

  if (spreadsheetId) {
    try {
      ss = SpreadsheetApp.openById(spreadsheetId);
    } catch (e) {
      Logger.log(`Could not open auth spreadsheet with stored ID ${spreadsheetId}. Searching by name. Error: ${e.message}`);
      spreadsheetId = null; // Reset to trigger search/create
    }
  }

  if (!spreadsheetId) {
    const files = DriveApp.getFilesByName(AUTH_SHEET_NAME);
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
      spreadsheetId = ss.getId();
      properties.setProperty('AUTH_SPREADSHEET_ID', spreadsheetId);
      Logger.log(`Found auth spreadsheet by name. ID: ${spreadsheetId}`);
    } else {
      ss = SpreadsheetApp.create(AUTH_SHEET_NAME);
      spreadsheetId = ss.getId();
      properties.setProperty('AUTH_SPREADSHEET_ID', spreadsheetId);
      const sheet = ss.getSheets()[0];
      sheet.setName('Tokens');
      const headers = ['AuthToken', 'UserID', 'UserType', 'SchoolSpreadsheetID', 'Timestamp'];
      sheet.appendRow(headers);
      sheet.setFrozenRows(1);
      Logger.log(`Created new auth spreadsheet. Name: "${AUTH_SHEET_NAME}", ID: ${spreadsheetId}`);
    }
  }
  
  let sheet = ss.getSheetByName('Tokens');
  if (!sheet) {
    sheet = ss.insertSheet('Tokens');
    const headers = ['AuthToken', 'UserID', 'UserType', 'SchoolSpreadsheetID', 'Timestamp'];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() < 1) {
    const headers = ['AuthToken', 'UserID', 'UserType', 'SchoolSpreadsheetID', 'Timestamp'];
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }

  return sheet;
}

// --- Web App Entry Points ---

function doGet(e) {
  // Basic GET handler, can be expanded if needed
  Logger.log("doGet received request: " + JSON.stringify(e));
  const response = { status: "success", message: "School Management API is active." };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  let response;
  try {
    Logger.log("doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload; // Data sent from the frontend

    if (!action) {
      throw new Error("Action parameter is missing in the request.");
    }

    // Public actions that do not require token verification
    const publicActions = ['registerSchool', 'principalLogin', 'teacherLogin', 'verifyToken'];

    if (!publicActions.includes(action)) {
      // All other actions require a valid token
      if (!payload || !payload.authToken || !payload.spreadsheetId || !payload.userType) {
        // Return a specific error for invalid tokens
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Authentication details are missing for protected action.', authError: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      const isValidToken = verifyAuthToken(payload.spreadsheetId, payload.authToken, payload.userType, payload.staffId);
      if (!isValidToken) {
        // Return a specific error for invalid tokens
        return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'Invalid or expired token. Please log in again.', authError: true }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    switch (action) {
      case 'registerSchool':
        response = registerSchool(payload); // payload is schoolInfo
        break;
      case 'principalLogin':
        response = principalLogin(payload.mobile, payload.password);
        break;
      case 'teacherLogin':
        response = teacherLogin(payload.schoolGmail, payload.staffId, payload.password);
        break;
      case 'verifyToken':
        response = verifyToken(payload);
        break;
      case 'logout':
        response = logout(payload);
        break;
      case 'getPrincipalDashboardData':
        response = getPrincipalDashboardData(payload.spreadsheetId);
        break;
       case 'getTeacherDashboardData':
         response = getTeacherDashboardData(payload.spreadsheetId, payload.staffId);
         break;
      case 'getSchoolData':
         response = getSchoolData(payload.spreadsheetId, payload.sheetName);
         break;
      case 'getStudentsForClass':
         response = getStudentsForClass(payload.spreadsheetId, payload.classId);
         break;
      case 'addStudent':
        response = addStudent(payload.spreadsheetId, payload.studentInfo, payload.imageInfo);
        break;
      case 'addStaff':
        response = addStaff(payload.spreadsheetId, payload.staffInfo, payload.imageInfo);
        break;
       case 'addFeeType':
         response = addFeeType(payload.spreadsheetId, payload.feeTypeInfo);
         break;
       case 'addStudentFee':
         response = addStudentFee(payload.spreadsheetId, payload.feeInfo);
         break;
       case 'addStaffSalaryPayment':
          response = addStaffSalaryPayment(payload.spreadsheetId, payload.salaryInfo);
          break;
       case 'addExpense':
          response = addExpense(payload.spreadsheetId, payload.expenseInfo);
          break;
       case 'recordAttendance':
          response = recordAttendance(payload.spreadsheetId, payload.attendanceInfo);
          break;
       // Add cases for other actions needed by the frontend
      default:
        response = { success: false, message: `Unknown action: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  // Always return JSON response
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}


// --- Utility Functions (Mostly unchanged) ---

function getSheet(spreadsheetId, sheetName) {
  try {
    const ss = SpreadsheetApp.openById(spreadsheetId);
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
       Logger.log(`Sheet "${sheetName}" not found in spreadsheet ID: ${spreadsheetId}. It might be created if necessary.`);
    }
    return sheet;
  } catch (e) {
    Logger.log(`Error getting sheet "${sheetName}" in spreadsheet ID ${spreadsheetId}: ${e}`);
    throw new Error(`Could not access sheet: ${sheetName}. Error: ${e.message}`);
  }
}

function getGitHubToken() {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_API_TOKEN');
  if (!token) {
    Logger.log("GITHUB_API_TOKEN not found in script properties.");
    // Decide if this should throw an error or return null/empty
    // Throwing error is safer if token is mandatory for image uploads
    throw new Error('GitHub API Token not set in Script Properties.');
  }
  return token;
}

function getGitHubRepoInfo() {
function verifyAuthToken(spreadsheetId, token, userType, staffId) {
  if (!spreadsheetId || !token || !userType) {
    Logger.log(`Token verification failed: Missing parameters. SS_ID: ${!!spreadsheetId}, Token: ${!!token}, UserType: ${userType}`);
    return false;
  }
  try {
    const authSheet = getAuthSheet();
    if (!authSheet || authSheet.getLastRow() < 2) {
      Logger.log('Auth sheet is missing or empty. Verification failed.');
      return false;
    }

    const data = authSheet.getDataRange().getValues();
    const headers = data[0];
    const tokenIndex = headers.indexOf('AuthToken');
    const userIdIndex = headers.indexOf('UserID');
    const userTypeIndex = headers.indexOf('UserType');
    const ssIdIndex = headers.indexOf('SchoolSpreadsheetID');

    if ([tokenIndex, userIdIndex, userTypeIndex, ssIdIndex].includes(-1)) {
      Logger.log('Auth sheet is missing required columns (AuthToken, UserID, UserType, SchoolSpreadsheetID).');
      return false;
    }

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (row[tokenIndex] === token) {
        // Found the token, now verify other details.
        const storedUserType = row[userTypeIndex];
        const storedSsId = row[ssIdIndex];
        const storedUserId = row[userIdIndex];

        // The UserID for a teacher is their staffId. For a principal, it's their mobile number.
        // The `staffId` parameter is only reliably passed for teachers.
        // We can trust the token if it matches and the userType/ssId also match.
        if (storedUserType == userType && storedSsId == spreadsheetId) {
           // Optional: For teachers, we can do an extra check on staffId if it's provided.
           if (userType === 'teacher' && staffId && storedUserId != staffId) {
               Logger.log(`Token valid, but staffId mismatch. Token UserID: ${storedUserId}, Payload staffId: ${staffId}`);
               return false;
           }
           Logger.log(`Token verified successfully for userType: ${userType}, userId: ${storedUserId}`);
           return true;
        } else {
           Logger.log(`Token found, but mismatch on details. Token UserType: ${storedUserType}, Payload UserType: ${userType}. Token SS_ID: ${storedSsId}, Payload SS_ID: ${spreadsheetId}`);
           return false;
        }
      }
    }

    Logger.log(`Token verification failed: Token "${token}" not found.`);
    return false;
  } catch (e) {
    Logger.log(`Error during token verification: ${e.stack}`);
    return false;
  }
}

function verifyToken(payload) {
  const { spreadsheetId, authToken, userType, staffId } = payload;
  const isValid = verifyAuthToken(spreadsheetId, authToken, userType, staffId);

  if (!isValid) {
    return { success: false, message: 'Invalid session. Please log in.' };
  }

  // If token is valid, re-fetch user data to send to frontend
  if (userType === 'principal') {
    const mainSheet = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME);
    const data = mainSheet.getDataRange().getValues();
    const headers = data[0];
    const spreadsheetIdIndex = headers.indexOf('SchoolSpreadsheetID');
    const schoolNameIndex = headers.indexOf('School Name');
    const principalNameIndex = headers.indexOf('Principal Name');

    for (let i = 1; i < data.length; i++) {
      if (data[i][spreadsheetIdIndex] == spreadsheetId) {
        return {
          success: true,
          message: 'Token verified.',
          schoolName: data[i][schoolNameIndex],
          spreadsheetId: spreadsheetId,
          principalName: data[i][principalNameIndex],
          authToken: authToken,
          userType: 'principal'
        };
      }
    }
  } else if (userType === 'teacher') {
    // For teacher, we need to find their details again
    const staffSheet = getSheet(spreadsheetId, 'Staffs');
    if (!staffSheet) return { success: false, message: 'Could not find Staffs sheet to verify user.' };
    
    const staffData = staffSheet.getDataRange().getValues();
    const staffHeaders = staffData[0];
    const staffIdIndex = staffHeaders.indexOf('StaffID');
    const nameIndex = staffHeaders.indexOf('Name');

    let teacherName = '';
    for (let i = 1; i < staffData.length; i++) {
        if (staffData[i][staffIdIndex] == staffId) {
            teacherName = staffData[i][nameIndex];
            break;
        }
    }
    if (!teacherName) return { success: false, message: 'Could not find teacher profile.' };

    const mainSheet = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME);
    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData[0];
    const mainSSIdIndex = mainHeaders.indexOf('SchoolSpreadsheetID');
    const schoolNameIndex = mainHeaders.indexOf('School Name');
    let schoolName = '';
    for (let i = 1; i < mainData.length; i++) {
        if (mainData[i][mainSSIdIndex] == spreadsheetId) {
            schoolName = mainData[i][schoolNameIndex];
            break;
        }
    }

    const assignedClasses = getAssignedClassesForTeacher(spreadsheetId, staffId);
    return {
      success: true,
      message: 'Token verified.',
      teacherName: teacherName,
      staffId: staffId,
      schoolName: schoolName,
      spreadsheetId: spreadsheetId,
      assignedClasses: assignedClasses,
      authToken: authToken,
      userType: 'teacher'
    };
  }
  
  return { success: false, message: 'Could not re-validate session.' };
}

function logout(payload) {
  // The authToken is added to the payload by the client-side callBackendAPI function
  const { authToken } = payload;
  if (!authToken) {
    return { success: false, message: 'Auth token not provided for logout.' };
  }
  try {
    const authSheet = getAuthSheet();
    if (!authSheet || authSheet.getLastRow() < 2) {
      Logger.log('Auth sheet not found or empty, cannot process logout.');
      return { success: true, message: 'Logged out successfully (no server session found).' };
    }

    const data = authSheet.getDataRange().getValues();
    const headers = data[0];
    const tokenIndex = headers.indexOf('AuthToken');

    if (tokenIndex === -1) {
      Logger.log('AuthToken column not found in auth sheet.');
      return { success: false, message: 'Server configuration error during logout.' };
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][tokenIndex] === authToken) {
        authSheet.deleteRow(i + 1);
        Logger.log(`Deleted token entry for ${authToken.substring(0, 8)}... on logout.`);
        return { success: true, message: 'Logged out successfully.' };
      }
    }
    
    Logger.log(`Logout request for a token that was not found: ${authToken.substring(0, 8)}...`);
    return { success: true, message: 'Logged out successfully (session already ended).' };

  } catch (e) {
    Logger.log(`Error during logout: ${e.stack}`);
    return { success: false, message: 'Logout failed on server.' };
  }
}

   const user = PropertiesService.getScriptProperties().getProperty('GITHUB_USER') || 'YOUR_GITHUB_USERNAME';
   const repo = PropertiesService.getScriptProperties().getProperty('GITHUB_REPO') || 'YOUR_GITHUB_REPOSITORY_NAME';
   const path = PropertiesService.getScriptProperties().getProperty('GITHUB_IMAGE_PATH') || 'school_images';
   if (user === 'YOUR_GITHUB_USERNAME' || repo === 'YOUR_GITHUB_REPOSITORY_NAME') {
       Logger.log("Warning: GitHub user/repo not configured in Script Properties. Using placeholders.");
   }
   return { user, repo, path };
}

function generateUUID() {
  return Utilities.getUuid();
}

// --- GitHub Image Upload (Unchanged) ---

function uploadImageToGitHub(imageDataBase64, fileName, schoolName) {
  let token;
  try {
    token = getGitHubToken();
  } catch (e) {
     Logger.log("GitHub Token missing, cannot upload image. " + e.message);
     return ''; // Return empty string or handle as needed if token is missing but upload is optional
  }
  const repoInfo = getGitHubRepoInfo();
  const sanitizedSchoolName = schoolName.replace(/[^a-zA-Z0-9]/g, '_');
  const uniqueFileName = `${Date.now()}_${fileName}`;
  const githubPath = `${repoInfo.path}/${sanitizedSchoolName}/${uniqueFileName}`;

  const apiUrl = `https://api.github.com/repos/${repoInfo.user}/${repoInfo.repo}/contents/${githubPath}`;

  // Ensure base64 prefix is removed
  const base64Content = imageDataBase64.includes(',') ? imageDataBase64.split(',')[1] : imageDataBase64;

  const payload = JSON.stringify({
    message: `Upload image: ${uniqueFileName}`,
    content: base64Content,
    branch: 'main' // Or your default branch name
  });

  const options = {
    method: 'put',
    headers: {
      'Authorization': `token ${token}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: payload,
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch(apiUrl, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();
    Logger.log(`GitHub Upload Response Code: ${responseCode}`);
    Logger.log(`GitHub Upload Response Body: ${responseBody}`);

    if (responseCode === 201 || responseCode === 200) {
      const jsonResponse = JSON.parse(responseBody);
      // Prefer download_url for direct image access if available, else html_url
      const imageUrl = jsonResponse.content?.download_url || jsonResponse.content?.html_url?.replace('/blob/', '/raw/');
       if (!imageUrl) {
           Logger.log("Warning: GitHub response did not contain a usable image URL.");
           return jsonResponse.content?.html_url || ''; // Fallback to html_url or empty
       }
      Logger.log(`Image uploaded successfully. URL: ${imageUrl}`);
      return imageUrl;
    } else {
      throw new Error(`GitHub API Error (${responseCode}): ${responseBody}`);
    }
  } catch (error) {
    Logger.log(`Error uploading image to GitHub: ${error}`);
    // Decide whether to re-throw or just return empty string
    // throw new Error(`Failed to upload image: ${error.message}`);
     Logger.log("Image upload failed, returning empty URL.");
     return ''; // Return empty URL on failure
  }
}

// --- School Registration (Modified slightly for error handling if upload fails) ---

function setupNewSchoolSpreadsheet(spreadsheet, schoolName) {
  const sheetNames = {
    students: 'Students',
    staff: 'Staffs',
    classes: 'Classes',
    subjects: 'Subjects',
    classSubjects: 'ClassSubjects',
    studentsFees: 'StudentsFees',
    feeTypes: 'FeeTypes',
    staffSalaryPayments: 'StaffSalaryPayments',
    results: 'Results',
    attendance: 'Attendance',
    expenses: 'Expenses'
,  };

  const headers = {
    [sheetNames.students]: ['StudentID', 'RollNumber', 'Name', 'Mobile', 'Gmail', 'Password', 'FatherName', 'MotherName', 'Class', 'Address', 'PhotoURL', 'Aadhar', 'Gender', 'RegistrationDate'],
    [sheetNames.staff]: ['StaffID', 'Name', 'Mobile', 'Gmail', 'Password', 'JoiningDate', 'PhotoURL', 'SalaryAmount', 'TotalPaid', 'TotalDues', 'IsActive'],
    [sheetNames.classes]: ['ClassID', 'ClassName', 'Section', 'ClassTeacherStaffID'],
    [sheetNames.subjects]: ['SubjectID', 'SubjectName'],
    [sheetNames.classSubjects]: ['AssignmentID', 'ClassID', 'SubjectID', 'StaffID'],
    [sheetNames.studentsFees]: ['FeeRecordID', 'StudentID', 'FeeTypeID', 'Amount', 'DueDate', 'PaidDate', 'Status', 'AcademicYear', 'Notes'],
    [sheetNames.feeTypes]: ['FeeTypeID', 'FeeTypeName', 'DefaultAmount', 'Frequency'],
    [sheetNames.staffSalaryPayments]: ['PaymentID', 'StaffID', 'PaymentDate', 'Amount', 'MonthYear', 'Notes'],
    [sheetNames.results]: ['ResultID', 'StudentID', 'ClassID', 'SubjectID', 'MarksObtained', 'MaxMarks', 'ExamName', 'AcademicYear'],
    [sheetNames.attendance]: ['AttendanceID', 'Date', 'ClassID', 'PresentStudentIDs', 'AbsentStudentIDs'],
    [sheetNames.expenses]: ['ExpenseID', 'Date', 'Category', 'Description', 'Amount']
  };

  // DO NOT Delete default "Sheet1" as requested
  // const defaultSheet = spreadsheet.getSheetByName('Sheet1');
  // if (defaultSheet && spreadsheet.getSheets().length > 1) {
  //   spreadsheet.deleteSheet(defaultSheet);
  // }

  for (const key in sheetNames) {
    const sheetName = sheetNames[key];
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      Logger.log(`Created sheet: ${sheetName}`);
      if (headers[sheetName]) {
        sheet.appendRow(headers[sheetName]);
        sheet.setFrozenRows(1);
        headers[sheetName].forEach((_, i) => sheet.autoResizeColumn(i + 1));
        Logger.log(`Added headers to ${sheetName}`);
      }
    } else {
       Logger.log(`Sheet "${sheetName}" already exists.`);
       if (headers[sheetName] && sheet.getLastRow() < 1) {
           sheet.appendRow(headers[sheetName]);
           sheet.setFrozenRows(1);
           headers[sheetName].forEach((_, i) => sheet.autoResizeColumn(i + 1));
           Logger.log(`Added missing headers to existing empty sheet ${sheetName}`);
       }
    }
  }
}


function registerSchool(schoolInfo) {
  // Note: schoolInfo comes directly from the JSON payload parsed in doPost
  try {
    const mainSS = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    let mainSheet = mainSS.getSheetByName(MAIN_SHEET_NAME);
    if (!mainSheet) {
       mainSheet = mainSS.insertSheet(MAIN_SHEET_NAME);
       mainSheet.appendRow(['School Name', 'Principal Name', 'Mobile Number', 'Gmail', 'Password', 'Address', 'Website', 'School Image URL', 'SchoolSpreadsheetID', 'SchoolSpreadsheetURL', 'Registration Timestamp']);
       mainSheet.setFrozenRows(1);
       Logger.log(`Created main sheet: ${MAIN_SHEET_NAME}`);
    }

    const mobileCol = mainSheet.getRange(1, 1, 1, mainSheet.getLastColumn()).getValues()[0].indexOf('Mobile Number') + 1;
    if (mobileCol > 0 && mainSheet.getLastRow() > 1) {
       const existingMobiles = mainSheet.getRange(2, mobileCol, mainSheet.getLastRow() -1 , 1).getValues().flat();
       if (existingMobiles.includes(schoolInfo.principalMobile)) {
           Logger.log(`Registration failed: Mobile number ${schoolInfo.principalMobile} already exists.`);
           return { success: false, message: 'Mobile number already registered.' };
       }
    } else {
       Logger.log("Could not find 'Mobile Number' column or sheet empty, skipping duplicate check.");
    }

    let imageUrl = '';
    if (schoolInfo.schoolImage && schoolInfo.schoolImage.data) {
        Logger.log("Attempting to upload school image to GitHub...");
        // Image upload failure should not stop registration, just leave the URL empty.
        imageUrl = uploadImageToGitHub(schoolInfo.schoolImage.data, schoolInfo.schoolImage.name, schoolInfo.schoolName);
        if (!imageUrl) {
             Logger.log("Image upload failed or returned empty URL, proceeding without image URL.");
        } else {
            Logger.log(`Image URL received: ${imageUrl}`);
        }
    } else {
        Logger.log("No school image provided or image data missing.");
    }

    Logger.log(`Creating new spreadsheet for school: ${schoolInfo.schoolName}`);
    const newSpreadsheet = SpreadsheetApp.create(schoolInfo.schoolName);
    const newSpreadsheetId = newSpreadsheet.getId();
    const newSpreadsheetUrl = newSpreadsheet.getUrl();
    Logger.log(`New spreadsheet created. ID: ${newSpreadsheetId}, URL: ${newSpreadsheetUrl}`);

    Logger.log("Setting up sheets in the new spreadsheet...");
    setupNewSchoolSpreadsheet(newSpreadsheet, schoolInfo.schoolName);
    Logger.log("Sheet setup complete.");

    const timestamp = new Date();
    mainSheet.appendRow([
      schoolInfo.schoolName,
      schoolInfo.principalName,
      schoolInfo.principalMobile,
      schoolInfo.principalGmail,
      schoolInfo.password, // Plain text as requested
      schoolInfo.schoolAddress,
      schoolInfo.website || '',
      imageUrl, // Will be empty if upload failed or no image provided
      newSpreadsheetId,
      newSpreadsheetUrl,
      timestamp
    ]);
    Logger.log("School information added to the main sheet.");

    const subject = `Welcome to School Management System, ${schoolInfo.schoolName}!`;
    const body = `Dear ${schoolInfo.principalName},\n\nYour school, ${schoolInfo.schoolName}, has been successfully registered.\n\nYour login mobile number is: ${schoolInfo.principalMobile}\nYour password is: ${schoolInfo.password}\n\nYou can now log in and start managing your school.\n\nRegards,\nSchool Management System`;
    try {
        MailApp.sendEmail(schoolInfo.principalGmail, subject, body);
        Logger.log(`Confirmation email sent to ${schoolInfo.principalGmail}`);
    } catch (mailError) {
        Logger.log(`Failed to send confirmation email to ${schoolInfo.principalGmail}: ${mailError}`);
    }

    return { success: true, message: 'School registered successfully! Spreadsheet created.', spreadsheetId: newSpreadsheetId, schoolName: schoolInfo.schoolName };

  } catch (error) {
    Logger.log(`Error during school registration: ${error.stack}`);
    // Return error message suitable for frontend display
    return { success: false, message: `Registration failed: ${error.message}` };
  }
}


// --- Login Functions (Unchanged logic, just called by doPost) ---

function principalLogin(mobile, password) {
  try {
    const mainSheet = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME);
    if (!mainSheet) return { success: false, message: 'Main configuration sheet not found.' };

    const data = mainSheet.getDataRange().getValues();
    const headers = data[0];
    const mobileIndex = headers.indexOf('Mobile Number');
    const passwordIndex = headers.indexOf('Password');
    const schoolNameIndex = headers.indexOf('School Name');
    const spreadsheetIdIndex = headers.indexOf('SchoolSpreadsheetID');
    const principalNameIndex = headers.indexOf('Principal Name'); // Get principal name too

    if (mobileIndex === -1 || passwordIndex === -1 || schoolNameIndex === -1 || spreadsheetIdIndex === -1 || principalNameIndex === -1) {
      return { success: false, message: 'Main sheet is missing required columns.' };
    }

    for (let i = 1; i < data.length; i++) {
      if (data[i][mobileIndex] == mobile && data[i][passwordIndex] == password) { // Plain text comparison
        Logger.log(`Principal login successful for mobile: ${mobile}`);
        
        const spreadsheetId = data[i][spreadsheetIdIndex];
        const authToken = generateUUID();
        // Store token in the central auth sheet
        const authSheet = getAuthSheet();
        const authData = authSheet.getDataRange().getValues();
        const authHeaders = authData[0];
        const userIdIndex = authHeaders.indexOf('UserID');
        const userTypeIndex = authHeaders.indexOf('UserType');

        // Remove any old tokens for this user
        for (let j = authData.length - 1; j >= 1; j--) {
            if (authData[j][userIdIndex] == mobile && authData[j][userTypeIndex] == 'principal') {
                authSheet.deleteRow(j + 1);
                Logger.log(`Removed old token for principal ${mobile}.`);
            }
        }
        
        // Add new token
        authSheet.appendRow([authToken, mobile, 'principal', spreadsheetId, new Date()]);
        
        return {
          success: true,
          schoolName: data[i][schoolNameIndex],
          spreadsheetId: spreadsheetId,
          principalName: data[i][principalNameIndex], // Send name back
          authToken: authToken,
          userType: 'principal'
        };
      }
    }

    Logger.log(`Principal login failed for mobile: ${mobile}`);
    return { success: false, message: 'Invalid mobile number or password.' };
  } catch (error) {
    Logger.log(`Error during principal login: ${error}`);
    return { success: false, message: `Login error: ${error.message}` };
  }
}

function teacherLogin(schoolGmail, staffId, password) {
  try {
    const mainSheet = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME);
     if (!mainSheet) return { success: false, message: 'Main configuration sheet not found.' };

    const mainData = mainSheet.getDataRange().getValues();
    const mainHeaders = mainData[0];
    const gmailIndex = mainHeaders.indexOf('Gmail');
    const spreadsheetIdIndex = mainHeaders.indexOf('SchoolSpreadsheetID');
    const schoolNameIndex = mainHeaders.indexOf('School Name');

    if (gmailIndex === -1 || spreadsheetIdIndex === -1 || schoolNameIndex === -1) {
       return { success: false, message: 'Main sheet is missing required columns for teacher login.' };
    }

    let schoolSpreadsheetId = null;
    let schoolName = null;
    for (let i = 1; i < mainData.length; i++) {
        if (mainData[i][gmailIndex] == schoolGmail) {
            schoolSpreadsheetId = mainData[i][spreadsheetIdIndex];
            schoolName = mainData[i][schoolNameIndex];
            break;
        }
    }

    if (!schoolSpreadsheetId) {
        return { success: false, message: 'School not found with the provided Principal\'s Gmail address.' };
    }

    const staffSheet = getSheet(schoolSpreadsheetId, 'Staffs');
    if (!staffSheet || staffSheet.getLastRow() < 2) return { success: false, message: 'Staff data not found for this school or sheet is empty.' };

    const staffData = staffSheet.getDataRange().getValues();
    const staffHeaders = staffData[0];
    const staffIdIndex = staffHeaders.indexOf('StaffID');
    const passwordIndex = staffHeaders.indexOf('Password');
    const nameIndex = staffHeaders.indexOf('Name');
    const isActiveIndex = staffHeaders.indexOf('IsActive');


    if (staffIdIndex === -1 || passwordIndex === -1 || nameIndex === -1 || isActiveIndex === -1) {
       return { success: false, message: 'Staffs sheet is missing required columns (StaffID, Password, Name, IsActive).' };
    }

    for (let i = 1; i < staffData.length; i++) {
      if (staffData[i][staffIdIndex] == staffId && staffData[i][passwordIndex] == password) {
         if (staffData[i][isActiveIndex] !== true && String(staffData[i][isActiveIndex]).toUpperCase() !== 'TRUE') {
             Logger.log(`Teacher login failed for Staff ID: ${staffId}. Account is inactive.`);
             return { success: false, message: 'Your account is inactive. Please contact the principal.' };
         }

         const authToken = generateUUID();
         // Store token in the central auth sheet
         const authSheet = getAuthSheet();
         const authData = authSheet.getDataRange().getValues();
         const authHeaders = authData[0];
         const userIdIndex = authHeaders.indexOf('UserID');
         const userTypeIndex = authHeaders.indexOf('UserType');

         // Remove any old tokens for this user
         for (let j = authData.length - 1; j >= 1; j--) {
             if (authData[j][userIdIndex] == staffId && authData[j][userTypeIndex] == 'teacher') {
                 authSheet.deleteRow(j + 1);
                 Logger.log(`Removed old token for teacher ${staffId}.`);
             }
         }
        
         // Add new token
         authSheet.appendRow([authToken, staffId, 'teacher', schoolSpreadsheetId, new Date()]);

         const assignedClasses = getAssignedClassesForTeacher(schoolSpreadsheetId, staffId);

         Logger.log(`Teacher login successful for Staff ID: ${staffId}`);
         return {
           success: true,
           teacherName: staffData[i][nameIndex],
           staffId: staffData[i][staffIdIndex],
           schoolName: schoolName,
           spreadsheetId: schoolSpreadsheetId,
           assignedClasses: assignedClasses,
           authToken: authToken,
           userType: 'teacher'
         };
      }
    }

    Logger.log(`Teacher login failed for Staff ID: ${staffId}`);
    return { success: false, message: 'Invalid Staff ID or password.' };
  } catch (error) {
    Logger.log(`Error during teacher login: ${error}`);
    return { success: false, message: `Login error: ${error.message}` };
  }
}


// --- Data Fetching Functions (Unchanged logic) ---

function getSchoolData(spreadsheetId, sheetName) {
  try {
    const sheet = getSheet(spreadsheetId, sheetName);
     if (!sheet) {
       // If sheet doesn't exist, return success false or empty data structure
       Logger.log(`Sheet ${sheetName} not found in ${spreadsheetId}`);
       return { success: true, headers: [], data: [], message: `Sheet ${sheetName} not found.` }; // Or success: false
     }
    if (sheet.getLastRow() < 1) return { success: true, headers: [], data: [] };
    if (sheet.getLastRow() === 1) return { success: true, headers: sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0], data: [] };

    const range = sheet.getDataRange();
    const values = range.getValues();
    const headers = values[0];
    const data = values.slice(1).map(row => {
      let obj = {};
      headers.forEach((header, index) => {
         // Ensure dates are handled appropriately if needed, otherwise they are sent as is
         obj[header] = row[index];
      });
      return obj;
    });
     // Return success true along with data
    return { success: true, headers: headers, data: data };
  } catch (error) {
    Logger.log(`Error fetching data from ${sheetName} in ${spreadsheetId}: ${error}`);
    // Return success false with error message
    return { success: false, message: `Failed to fetch data from ${sheetName}: ${error.message}` };
  }
}


function getPrincipalDashboardData(spreadsheetId) {
    try {
        const studentsResult = getSchoolData(spreadsheetId, 'Students');
        const staffResult = getSchoolData(spreadsheetId, 'Staffs');
        const attendanceResult = getSchoolData(spreadsheetId, 'Attendance');
        const feeResult = getSchoolData(spreadsheetId, 'StudentsFees');
        const expenseResult = getSchoolData(spreadsheetId, 'Expenses');
        const salaryPaymentResult = getSchoolData(spreadsheetId, 'StaffSalaryPayments');
        const classResult = getSchoolData(spreadsheetId, 'Classes');

        // Check for errors in fetched data
        if (!studentsResult.success || !staffResult.success || !attendanceResult.success || !feeResult.success || !expenseResult.success || !salaryPaymentResult.success || !classResult.success) {
             // Aggregate error messages or return the first one found
             const firstError = [studentsResult, staffResult, attendanceResult, feeResult, expenseResult, salaryPaymentResult, classResult].find(r => !r.success);
             throw new Error(`Failed to fetch required dashboard data: ${firstError?.message || 'Unknown data fetch error'}`);
        }

        // Use .data from successful results
        const studentsData = studentsResult.data;
        const staffData = staffResult.data;
        const attendanceData = attendanceResult.data;
        const feeData = feeResult.data;
        const expenseData = expenseResult.data;
        const salaryPaymentData = salaryPaymentResult.data;
        const classData = classResult.data;


        const totalStudents = studentsData.length;
        const totalStaff = staffData.filter(s => s.IsActive === true || String(s.IsActive).toUpperCase() === 'TRUE').length;
        const totalClasses = classData.length;

        const totalIncome = feeData.reduce((sum, record) => sum + (parseFloat(record.Amount) || 0), 0);
        const totalExpenses = expenseData.reduce((sum, record) => sum + (parseFloat(record.Amount) || 0), 0);
        const totalSalaryPaid = salaryPaymentData.reduce((sum, record) => sum + (parseFloat(record.Amount) || 0), 0);
        const netBalance = totalIncome - totalExpenses - totalSalaryPaid;

        let attendanceSummary = { totalRecords: attendanceData.length };

        return {
            success: true,
            stats: {
                totalStudents: totalStudents,
                totalStaff: totalStaff,
                totalClasses: totalClasses
            },
            financials: {
                totalIncome: totalIncome, // Send raw number
                totalExpenses: totalExpenses,
                totalSalaryPaid: totalSalaryPaid,
                netBalance: netBalance
            },
            // Include data needed for lists/tables on the overview or other tabs if fetched here
            students: studentsResult, // Send the full result object (includes headers)
            staff: staffResult,
            classes: classResult,
            attendance: attendanceResult // Raw attendance for potential processing/charting
        };

    } catch (error) {
        Logger.log(`Error fetching principal dashboard data for ${spreadsheetId}: ${error}`);
        return { success: false, message: `Error fetching dashboard data: ${error.message}` };
    }
}

function getAssignedClassesForTeacher(spreadsheetId, staffId) {
  // This is an internal helper, doesn't need success property unless called directly
  try {
    const classAssignSheet = getSheet(spreadsheetId, 'ClassSubjects');
    const classesSheet = getSheet(spreadsheetId, 'Classes');

    // Check if sheets exist and have headers + data
    if (!classAssignSheet || classAssignSheet.getLastRow() < 2 || !classesSheet || classesSheet.getLastRow() < 2) {
      Logger.log(`ClassSubjects or Classes sheet missing/empty for teacher ${staffId} in ${spreadsheetId}`);
      return []; // Return empty array if data is missing
    }

    const assignments = classAssignSheet.getDataRange().getValues();
    const assignHeaders = assignments[0];
    const assignStaffIdIndex = assignHeaders.indexOf('StaffID');
    const assignClassIdIndex = assignHeaders.indexOf('ClassID');

    const classes = classesSheet.getDataRange().getValues();
    const classHeaders = classes[0];
    const classIdIndex = classHeaders.indexOf('ClassID');
    const classNameIndex = classHeaders.indexOf('ClassName');
    const sectionIndex = classHeaders.indexOf('Section');

    if (assignStaffIdIndex === -1 || assignClassIdIndex === -1 || classIdIndex === -1 || classNameIndex === -1 || sectionIndex === -1) {
        Logger.log("Required columns missing in ClassSubjects or Classes sheet for teacher assignment lookup.");
        return []; // Return empty if essential headers are missing
    }

    // Find all class IDs assigned to this staff ID
    const assignedClassIds = assignments.slice(1)
                                     .filter(row => row[assignStaffIdIndex] == staffId)
                                     .map(row => row[assignClassIdIndex]);

    const uniqueClassIds = [...new Set(assignedClassIds)]; // Get unique class IDs

    // Create a map for quick lookup of class details by ClassID
    const classDetailsMap = classes.slice(1).reduce((map, row) => {
         // Ensure ClassID exists before adding to map
         if (row[classIdIndex]) {
             map[row[classIdIndex]] = {
                 classId: row[classIdIndex],
                 className: row[classNameIndex],
                 section: row[sectionIndex] || '' // Handle potentially empty section
             };
         }
        return map;
    }, {});

    // Map the unique assigned ClassIDs to their details
    const assignedClassInfo = uniqueClassIds
                                .map(id => classDetailsMap[id])
                                .filter(Boolean); // Filter out any undefined results (if ID wasn't in Classes sheet)

    Logger.log(`Found ${assignedClassInfo.length} assigned classes for teacher ${staffId}`);
    return assignedClassInfo; // Returns array of {classId, className, section}

  } catch (error) {
    Logger.log(`Error fetching assigned classes for teacher ${staffId} in ${spreadsheetId}: ${error}`);
    return []; // Return empty on error
  }
}


function getTeacherDashboardData(spreadsheetId, staffId) {
    try {
        const staffResult = getSchoolData(spreadsheetId, 'Staffs');
        const studentsResult = getSchoolData(spreadsheetId, 'Students');
        const attendanceResult = getSchoolData(spreadsheetId, 'Attendance');

         // Check for fetch errors
        if (!staffResult.success || !studentsResult.success || !attendanceResult.success) {
           const firstError = [staffResult, studentsResult, attendanceResult].find(r => !r.success);
           throw new Error(`Failed to fetch required teacher data: ${firstError?.message || 'Unknown data fetch error'}`);
        }

        const staffData = staffResult.data;
        const studentsData = studentsResult.data;
        const attendanceData = attendanceResult.data;

        let teacherProfile = staffData.find(staff => staff.StaffID == staffId);
         if (!teacherProfile) {
           // If profile not found, return error (shouldn't happen if login succeeded)
           return { success: false, message: "Teacher profile not found." };
         }

        const assignedClasses = getAssignedClassesForTeacher(spreadsheetId, staffId);
        const assignedClassIds = assignedClasses.map(c => c.classId);

        // Filter students belonging to assigned classes
        const studentsByClass = {};
         assignedClasses.forEach(cls => {
             // Assumes student.Class contains the ClassID
             studentsByClass[cls.classId] = studentsData.filter(student => student.Class == cls.classId);
         });


        // Filter attendance records for assigned classes
        const relevantAttendance = attendanceData.filter(att => assignedClassIds.includes(att.ClassID));

        return {
            success: true,
            profile: teacherProfile,
            assignedClasses: assignedClasses,
            // Send filtered students, grouped by class ID for easy access on frontend
            students: studentsByClass,
            // Send filtered attendance records
            attendanceSummary: relevantAttendance
        };

    } catch (error) {
        Logger.log(`Error fetching teacher dashboard data for staff ${staffId} in ${spreadsheetId}: ${error}`);
        return { success: false, message: `Error fetching teacher dashboard data: ${error.message}` };
    }
}

function getStudentsForClass(spreadsheetId, classId) {
    try {
        // Use getSchoolData which handles sheet existence and data formatting
        const studentsResult = getSchoolData(spreadsheetId, 'Students');

        if (!studentsResult.success) {
            // Propagate the error from getSchoolData
            return studentsResult;
        }

        const allStudents = studentsResult.data;

        // Filter students based on the ClassID (assuming 'Class' column holds ClassID)
        const classFilteredStudents = allStudents.filter(student => student.Class == classId);

        // Return success with the filtered data
        return { success: true, data: classFilteredStudents };

    } catch (error) {
        Logger.log(`Error fetching students for class ${classId} in ${spreadsheetId}: ${error}`);
        return { success: false, message: `Error fetching students: ${error.message}` };
    }
}


// --- Data Addition/Modification Functions (Unchanged logic) ---

function addStudent(spreadsheetId, studentInfo, imageInfo) {
  try {
    const studentSheet = getSheet(spreadsheetId, 'Students');
    if (!studentSheet) throw new Error("Students sheet not found.");

    let imageUrl = '';
    if (imageInfo && imageInfo.data) {
        // Fetch school name for GitHub path organization
        const mainData = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME)?.getDataRange().getValues();
        let schoolName = "UnknownSchool";
        if (mainData) {
            const ssIdCol = mainData[0].indexOf('SchoolSpreadsheetID');
            const schoolNameCol = mainData[0].indexOf('School Name');
            if (ssIdCol !== -1 && schoolNameCol !== -1) {
                for (let i = 1; i < mainData.length; i++) {
                    if (mainData[i][ssIdCol] == spreadsheetId) {
                        schoolName = mainData[i][schoolNameCol];
                        break;
                    }
                }
            }
        }
        // Image upload failure is logged but doesn't stop student addition
        imageUrl = uploadImageToGitHub(imageInfo.data, imageInfo.name, schoolName);
         if (!imageUrl) {
             Logger.log(`Proceeding to add student ${studentInfo.name} without image URL due to upload issue.`);
         }
    }

    const studentId = generateUUID();
    const registrationDate = new Date();

    const headers = studentSheet.getRange(1, 1, 1, studentSheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => {
        switch (header) {
            case 'StudentID': return studentId;
            case 'RollNumber': return studentInfo.rollNumber;
            case 'Name': return studentInfo.name;
            case 'Mobile': return studentInfo.mobile;
            case 'Gmail': return studentInfo.gmail;
            case 'Password': return studentInfo.password; // Plain text
            case 'FatherName': return studentInfo.fatherName;
            case 'MotherName': return studentInfo.motherName;
            case 'Class': return studentInfo.classId; // Expecting classId
            case 'Address': return studentInfo.address;
            case 'PhotoURL': return imageUrl; // Use potentially empty URL
            case 'Aadhar': return studentInfo.aadhar;
            case 'Gender': return studentInfo.gender;
            case 'RegistrationDate': return registrationDate;
            default: return '';
        }
    });

    studentSheet.appendRow(newRow);
    Logger.log(`Added student ${studentInfo.name} with ID ${studentId} to ${spreadsheetId}`);
    return { success: true, message: 'Student added successfully.', studentId: studentId };
  } catch (error) {
    Logger.log(`Error adding student in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to add student: ${error.message}` };
  }
}

function addStaff(spreadsheetId, staffInfo, imageInfo) {
  try {
    const staffSheet = getSheet(spreadsheetId, 'Staffs');
     if (!staffSheet) throw new Error("Staffs sheet not found.");

    let imageUrl = '';
    if (imageInfo && imageInfo.data) {
        // Fetch school name
        const mainData = getSheet(MAIN_SPREADSHEET_ID, MAIN_SHEET_NAME)?.getDataRange().getValues();
        let schoolName = "UnknownSchool";
         if (mainData) {
           const ssIdCol = mainData[0].indexOf('SchoolSpreadsheetID');
           const schoolNameCol = mainData[0].indexOf('School Name');
            if (ssIdCol !== -1 && schoolNameCol !== -1) {
               for(let i = 1; i < mainData.length; i++) {
                   if(mainData[i][ssIdCol] == spreadsheetId) {
                       schoolName = mainData[i][schoolNameCol];
                       break;
                   }
               }
           }
         }
       imageUrl = uploadImageToGitHub(imageInfo.data, imageInfo.name, schoolName);
        if (!imageUrl) {
            Logger.log(`Proceeding to add staff ${staffInfo.name} without image URL due to upload issue.`);
        }
    }

    const staffId = generateUUID();
    const joiningDate = new Date();

    const headers = staffSheet.getRange(1, 1, 1, staffSheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => {
        switch (header) {
            case 'StaffID': return staffId;
            case 'Name': return staffInfo.name;
            case 'Mobile': return staffInfo.mobile;
            case 'Gmail': return staffInfo.gmail;
            case 'Password': return staffInfo.password; // Plain text
            case 'JoiningDate': return joiningDate;
            case 'PhotoURL': return imageUrl;
            case 'SalaryAmount': return staffInfo.salaryAmount || 0;
            case 'TotalPaid': return 0;
            case 'TotalDues': return 0;
            case 'IsActive': return true; // Default active
            default: return '';
        }
    });

    staffSheet.appendRow(newRow);
    Logger.log(`Added staff ${staffInfo.name} with ID ${staffId} to ${spreadsheetId}`);
    return { success: true, message: 'Staff added successfully.', staffId: staffId };
  } catch (error) {
    Logger.log(`Error adding staff in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to add staff: ${error.message}` };
  }
}

function addFeeType(spreadsheetId, feeTypeInfo) {
  try {
    const feeTypeSheet = getSheet(spreadsheetId, 'FeeTypes');
     if (!feeTypeSheet) throw new Error("FeeTypes sheet not found.");

     const feeTypeId = generateUUID();
     const headers = feeTypeSheet.getRange(1, 1, 1, feeTypeSheet.getLastColumn()).getValues()[0];
     const newRow = headers.map(header => {
         switch(header) {
             case 'FeeTypeID': return feeTypeId;
             case 'FeeTypeName': return feeTypeInfo.name;
             case 'DefaultAmount': return feeTypeInfo.amount;
             case 'Frequency': return feeTypeInfo.frequency;
             default: return '';
         }
     });

     feeTypeSheet.appendRow(newRow);
     Logger.log(`Added Fee Type ${feeTypeInfo.name} with ID ${feeTypeId} to ${spreadsheetId}`);
     return { success: true, message: 'Fee Type added successfully.', feeTypeId: feeTypeId };
  } catch (error) {
     Logger.log(`Error adding Fee Type in ${spreadsheetId}: ${error.stack}`);
     return { success: false, message: `Failed to add Fee Type: ${error.message}` };
  }
}


function addStudentFee(spreadsheetId, feeInfo) {
  try {
    const feeSheet = getSheet(spreadsheetId, 'StudentsFees');
    if (!feeSheet) throw new Error("StudentsFees sheet not found.");

    const feeRecordId = generateUUID();
    const headers = feeSheet.getRange(1, 1, 1, feeSheet.getLastColumn()).getValues()[0];

    // Ensure dates are valid Date objects or null before appending
    const dueDate = feeInfo.dueDate ? new Date(feeInfo.dueDate) : null;
    const paidDate = feeInfo.paidDate ? new Date(feeInfo.paidDate) : null;
    // Validate dates if necessary
    if (feeInfo.dueDate && isNaN(dueDate.getTime())) throw new Error("Invalid Due Date format.");
    if (feeInfo.paidDate && isNaN(paidDate.getTime())) throw new Error("Invalid Paid Date format.");


    const newRow = headers.map(header => {
        switch(header) {
            case 'FeeRecordID': return feeRecordId;
            case 'StudentID': return feeInfo.studentId;
            case 'FeeTypeID': return feeInfo.feeTypeId;
            case 'Amount': return feeInfo.amount;
            case 'DueDate': return dueDate;
            case 'PaidDate': return paidDate;
            case 'Status': return feeInfo.status || 'Due';
            case 'AcademicYear': return feeInfo.academicYear;
            case 'Notes': return feeInfo.notes || '';
            default: return '';
        }
    });

    feeSheet.appendRow(newRow);
    Logger.log(`Added fee record ${feeRecordId} for student ${feeInfo.studentId} in ${spreadsheetId}`);
    return { success: true, message: 'Student fee record added successfully.', feeRecordId: feeRecordId };
  } catch (error) {
    Logger.log(`Error adding student fee in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to add student fee: ${error.message}` };
  }
}

function addStaffSalaryPayment(spreadsheetId, salaryInfo) {
  try {
    const paymentSheet = getSheet(spreadsheetId, 'StaffSalaryPayments');
    if (!paymentSheet) throw new Error("StaffSalaryPayments sheet not found.");

    const paymentId = generateUUID();
    const paymentDate = new Date();

    const headers = paymentSheet.getRange(1, 1, 1, paymentSheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => {
        switch(header) {
            case 'PaymentID': return paymentId;
            case 'StaffID': return salaryInfo.staffId;
            case 'PaymentDate': return paymentDate;
            case 'Amount': return salaryInfo.amount;
            case 'MonthYear': return salaryInfo.monthYear;
            case 'Notes': return salaryInfo.notes || '';
            default: return '';
        }
    });
    paymentSheet.appendRow(newRow);

    // Update Staffs sheet
    const staffSheet = getSheet(spreadsheetId, 'Staffs');
    if (staffSheet && staffSheet.getLastRow() > 1) {
        const staffData = staffSheet.getDataRange().getValues();
        const staffHeaders = staffData[0];
        const staffIdIndex = staffHeaders.indexOf('StaffID');
        const totalPaidIndex = staffHeaders.indexOf('TotalPaid');
        const totalDuesIndex = staffHeaders.indexOf('TotalDues'); // Assuming simple update for now

        if (staffIdIndex !== -1 && totalPaidIndex !== -1 && totalDuesIndex !== -1) {
            for (let i = 1; i < staffData.length; i++) {
                if (staffData[i][staffIdIndex] == salaryInfo.staffId) {
                    let currentPaid = parseFloat(staffData[i][totalPaidIndex]) || 0;
                    let currentDues = parseFloat(staffData[i][totalDuesIndex]) || 0; // Not used directly here, maybe complex logic
                    let paymentAmount = parseFloat(salaryInfo.amount) || 0;

                    let newPaid = currentPaid + paymentAmount;
                    // Simple dues reduction example (needs proper logic based on salary structure)
                    // let newDues = currentDues - paymentAmount;

                    staffSheet.getRange(i + 1, totalPaidIndex + 1).setValue(newPaid);
                    // staffSheet.getRange(i + 1, totalDuesIndex + 1).setValue(newDues); // Uncomment if simple dues logic applies
                    Logger.log(`Updated TotalPaid for staff ${salaryInfo.staffId} to ${newPaid}`);
                    break;
                }
            }
        } else {
            Logger.log("Could not find required columns (StaffID, TotalPaid, TotalDues) in Staffs sheet to update totals.");
        }
    }

    Logger.log(`Added salary payment ${paymentId} for staff ${salaryInfo.staffId} in ${spreadsheetId}`);
    return { success: true, message: 'Salary payment recorded successfully.', paymentId: paymentId };
  } catch (error) {
    Logger.log(`Error adding staff salary payment in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to add salary payment: ${error.message}` };
  }
}


function addExpense(spreadsheetId, expenseInfo) {
  try {
    const expenseSheet = getSheet(spreadsheetId, 'Expenses');
    if (!expenseSheet) throw new Error("Expenses sheet not found.");

    const expenseId = generateUUID();
    const expenseDate = new Date();

    const headers = expenseSheet.getRange(1, 1, 1, expenseSheet.getLastColumn()).getValues()[0];
     const newRow = headers.map(header => {
         switch(header) {
             case 'ExpenseID': return expenseId;
             case 'Date': return expenseDate;
             case 'Category': return expenseInfo.category;
             case 'Description': return expenseInfo.description;
             case 'Amount': return expenseInfo.amount;
             default: return '';
         }
     });

    expenseSheet.appendRow(newRow);
    Logger.log(`Added expense ${expenseId} for category ${expenseInfo.category} in ${spreadsheetId}`);
    return { success: true, message: 'Expense added successfully.', expenseId: expenseId };
  } catch (error) {
    Logger.log(`Error adding expense in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to add expense: ${error.message}` };
  }
}

function recordAttendance(spreadsheetId, attendanceInfo) {
  try {
    const attendanceSheet = getSheet(spreadsheetId, 'Attendance');
    if (!attendanceSheet) throw new Error("Attendance sheet not found.");

    const attendanceId = generateUUID();
    const attendanceDate = new Date();

    const headers = attendanceSheet.getRange(1, 1, 1, attendanceSheet.getLastColumn()).getValues()[0];
    const newRow = headers.map(header => {
        switch(header) {
            case 'AttendanceID': return attendanceId;
            case 'Date': return attendanceDate;
            case 'ClassID': return attendanceInfo.classId;
            case 'PresentStudentIDs': return attendanceInfo.presentStudentIds.join(',');
            case 'AbsentStudentIDs': return attendanceInfo.absentStudentIds.join(',');
            default: return '';
        }
    });

    attendanceSheet.appendRow(newRow);
    Logger.log(`Recorded attendance ${attendanceId} for class ${attendanceInfo.classId} on ${attendanceDate.toLocaleDateString()} in ${spreadsheetId}`);
    return { success: true, message: 'Attendance recorded successfully.', attendanceId: attendanceId };
  } catch (error) {
    Logger.log(`Error recording attendance in ${spreadsheetId}: ${error.stack}`);
    return { success: false, message: `Failed to record attendance: ${error.message}` };
  }
}
