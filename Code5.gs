// --- Global Configuration ---
const MAIN_SPREADSHEET_ID = '1PjNIMBpDWqU_Vj8SHnCG39mvAqjZ1S51lcLxK5Apzf8';
const MAIN_SHEET_NAME = 'Schools';

function doPost(e) {
  let response;
  try {
    Logger.log("Code5.gs doPost received data: " + e.postData.contents);
    const requestData = JSON.parse(e.postData.contents);
    const action = requestData.action;
    const payload = requestData.payload;

    if (!action) {
      throw new Error("Action parameter is missing in the request.");
    }

    switch (action) {
      case 'sendOtp':
        response = sendOtp(payload.gmail);
        break;
      case 'resetPassword':
        response = resetPassword(payload.gmail, payload.otp, payload.newPassword);
        break;
      default:
        response = { success: false, message: `Unknown action: ${action}` };
    }

  } catch (error) {
    Logger.log(`Error in Code5.gs doPost: ${error.stack}`);
    response = { success: false, message: `Server error: ${error.message}` };
  }

  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function findRowByValue(sheet, headerName, value) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIndex = headers.indexOf(headerName);
  if (colIndex === -1) {
    throw new Error(`Column "${headerName}" not found in the sheet.`);
  }

  for (let i = 1; i < data.length; i++) {
    if (data[i][colIndex].toString().trim().toLowerCase() === value.toString().trim().toLowerCase()) {
      return { rowIndex: i + 1, rowData: data[i], headers: headers };
    }
  }
  return null;
}

function sendOtp(gmail) {
  if (!gmail) {
    return { success: false, message: "Gmail address is required." };
  }

  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(MAIN_SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${MAIN_SHEET_NAME}" not found.`);
    }

    const userRowInfo = findRowByValue(sheet, "Gmail", gmail);
    if (!userRowInfo) {
      return { success: false, message: "This Gmail is not registered with any school." };
    }

    const headers = userRowInfo.headers;
    const otpColIndex = headers.indexOf("OTP");
    const timeColIndex = headers.indexOf("Time");
    const principalNameIndex = headers.indexOf("Principal Name");

    if (otpColIndex === -1 || timeColIndex === -1) {
      throw new Error("Required columns 'OTP' or 'Time' not found in the sheet. Please add them in columns S and T.");
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const timestamp = new Date();
    const principalName = userRowInfo.rowData[principalNameIndex] || 'Principal';

    sheet.getRange(userRowInfo.rowIndex, otpColIndex + 1).setValue(otp);
    sheet.getRange(userRowInfo.rowIndex, timeColIndex + 1).setValue(timestamp);

    const subject = "Your Password Reset OTP";
    const body = `Dear ${principalName},\n\nYour OTP for resetting your password is: ${otp}\n\nThis OTP is valid for 2 minutes.\n\nIf you did not request this, please ignore this email.\n\nRegards,\nSchool Management System`;
    
    MailApp.sendEmail(gmail, subject, body);
    Logger.log(`OTP sent to ${gmail}`);

    return { success: true, message: "OTP has been sent to your registered Gmail address." };

  } catch (error) {
    Logger.log(`Error in sendOtp: ${error.stack}`);
    return { success: false, message: error.message };
  }
}

function resetPassword(gmail, otp, newPassword) {
  if (!gmail || !otp || !newPassword) {
    return { success: false, message: "Gmail, OTP, and new password are required." };
  }

  try {
    const ss = SpreadsheetApp.openById(MAIN_SPREADSHEET_ID);
    const sheet = ss.getSheetByName(MAIN_SHEET_NAME);
    if (!sheet) {
      throw new Error(`Sheet "${MAIN_SHEET_NAME}" not found.`);
    }

    const userRowInfo = findRowByValue(sheet, "Gmail", gmail);
    if (!userRowInfo) {
      return { success: false, message: "Gmail not found." };
    }

    const headers = userRowInfo.headers;
    const otpColIndex = headers.indexOf("OTP");
    const timeColIndex = headers.indexOf("Time");
    const passwordColIndex = headers.indexOf("Password");

    if (otpColIndex === -1 || timeColIndex === -1 || passwordColIndex === -1) {
      throw new Error("Required columns 'OTP', 'Time', or 'Password' not found in the sheet.");
    }

    const storedOtp = userRowInfo.rowData[otpColIndex];
    const storedTime = new Date(userRowInfo.rowData[timeColIndex]);
    const currentTime = new Date();
    
    const timeDiffMinutes = (currentTime.getTime() - storedTime.getTime()) / (1000 * 60);

    const otpCell = sheet.getRange(userRowInfo.rowIndex, otpColIndex + 1);
    const timeCell = sheet.getRange(userRowInfo.rowIndex, timeColIndex + 1);

    if (otp.toString() !== storedOtp.toString()) {
      otpCell.clearContent();
      timeCell.clearContent();
      return { success: false, message: "Invalid OTP. Please try again." };
    }

    if (timeDiffMinutes > 2) {
      otpCell.clearContent();
      timeCell.clearContent();
      return { success: false, message: "OTP has expired. Please request a new one." };
    }

    // If everything is correct
    sheet.getRange(userRowInfo.rowIndex, passwordColIndex + 1).setValue(newPassword);
    otpCell.clearContent();
    timeCell.clearContent();
    
    Logger.log(`Password reset successfully for ${gmail}`);
    return { success: true, message: "Your password has been updated successfully. You can now log in with your new password." };

  } catch (error) {
    Logger.log(`Error in resetPassword: ${error.stack}`);
    return { success: false, message: error.message };
  }
}
