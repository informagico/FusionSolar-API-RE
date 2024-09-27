const axios = require("axios");
require("dotenv").config();
const rs = require("jsrsasign");
const crypto = require("crypto").webcrypto;

function initParam(submitUserName, nationCode) {
  // var orgName = submitUserName ? encodeURIComponent(transfer($("#organization").val())) : '';
  // var usernameInp = encodeURIComponent(transfer($("#username").val()));
  // if (nationCode) {
  //   usernameInp = nationCode + '-' + usernameInp;
  // }
  // var valueInp = $("#value").val();
  // var verifycodeInp;
  // if (!(typeof ($("#verificationCode").val()) == "undefined")) {
  //   verifycodeInp = $("#verificationCode").val();
  // }
  // var search = window.location.search;
  // if (isTwoFactorView) {
  //   verifycodeInp = $("#twoFactorCode").val();
  //   search = window.location.search ? window.location.search + "&step=twoFactor" : "?step=twoFactor";
  // }
  return {
    orgName: process.env.HFS_ORG_NAME || undefined,
    usernameInp: process.env.HFS_USERNAME || undefined,
    valueInp: process.env.HFS_PASSWORD || undefined,
    verifycodeInp: process.env.HFS_VERIFY_CODE_INP || undefined,
    search: process.env.HFS_SEARCH || undefined,
  };
}

function initLoginUserInfo() {
  return {
    organizationName: process.env.HFS_ORG_NAME || undefined,
    username: process.env.HFS_USERNAME || undefined,
    password: process.env.HFS_PASSWORD || undefined,
    verifycode: process.env.HFS_VERIFY_CODE_INP || undefined,
    multiRegionName: process.env.HFS_SEARCH || undefined,
  };
}

async function getPubKey() {
  const response = await axios.get(
    process.env.HFS_BASE_ADDRESS + process.env.HFS_EP_PUBKEY
  );
  return response.data;
}

function getSecureRandom() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  var result = "";
  for (var i = 0; i < arr.length; i++) {
    result = result + arr[i].toString(16);
  }
  return result;
}

async function main() {
  // get publick key for user data encryption
  const result = await getPubKey();

  // encrypt user data with public key
  var data = initLoginUserInfo();
  if (result.enableEncrypt) {
    var pubKey = rs.KEYUTIL.getKey(result.pubKey);
    var valueEncode = encodeURIComponent(data.password);
    var encryptValue = "";
    for (var i = 0; i < valueEncode.length / 270; i++) {
      var currntValue = valueEncode.substr(i * 270, 270);
      var encryptValueCurrent = rs.KJUR.crypto.Cipher.encrypt(
        currntValue,
        pubKey,
        "RSAOAEP384"
      );
      encryptValue = encryptValue == "" ? "" : encryptValue + "00000001";
      encryptValue = encryptValue + rs.hextob64(encryptValueCurrent);
    }
    data.password = encryptValue + result.version;
  }

  // validate user
  var URL = "/unisso/v2/validateUser.action";
  if (result.enableEncrypt) {
    URL =
      "/unisso/v3/validateUser.action" +
      "?timeStamp=" +
      result.timeStamp +
      "&nonce=" +
      getSecureRandom();
  }

  var loginUserInfo = JSON.stringify(data);

  var axiosResult = await axios.get(
    process.env.HFS_BASE_ADDRESS +
      "/rest/pvms/web/publicapp/v1/download-qr-code?appType=3&sizeType=1"
  );
  console.log(axiosResult);

  var cookies = axiosResult.headers["set-cookie"][0];

  axiosResult = await axios.post(
    process.env.HFS_BASE_ADDRESS + URL,
    loginUserInfo,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies,
      },
    }
  );
  console.log(axiosResult);

  cookies += "; " + axiosResult.headers["set-cookie"][0];

  axiosResult = await axios
    .get(
      process.env.HFS_BASE_ADDRESS + axiosResult.data.respMultiRegionName[1],
      {
        headers: {
          Cookie: cookies,
        },
        maxRedirects: 0,
        redirect: "manual",
      }
    )
    .catch((reason) => {
      if (reason.status == 302) {
        cookies += "; " + reason.response.headers["set-cookie"][0];
      } else {
        console.log(reason);
      }
    });

  // TODO: implement getPlansList
  await getPlantsList();
}

main();
