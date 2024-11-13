const axios = require("axios");
const { config } = require("dotenv");
require("dotenv").config();
const rs = require("jsrsasign");
const crypto = require("crypto").webcrypto;

global.Configuration = {
  PUB_KEY: "",
  LOGIN_URL: "",
  LOGIN_USER_INFO: Object,
  JSESSIONID: "",
  UNISSO_V_C_S: "",
  DP_SESSION_TOKEN: "",
  MULTI_REGION_NAME: "",
};

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

  Configuration.PUB_KEY = response.data;
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

function getLoginUserInfo() {
  var loginUserInfo = initLoginUserInfo();

  if (Configuration.PUB_KEY.enableEncrypt) {
    var pubKey = rs.KEYUTIL.getKey(Configuration.PUB_KEY.pubKey);
    var valueEncode = encodeURIComponent(loginUserInfo.password);
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
    loginUserInfo.password = encryptValue + Configuration.PUB_KEY.version;
  }

  Configuration.LOGIN_USER_INFO = loginUserInfo;
}

function getLoginUrl() {
  var url = "/unisso/v2/validateUser.action";
  if (Configuration.PUB_KEY.enableEncrypt) {
    url =
      "/unisso/v3/validateUser.action" +
      "?timeStamp=" +
      Configuration.PUB_KEY.timeStamp +
      "&nonce=" +
      getSecureRandom();
  }

  Configuration.LOGIN_URL = url;
}

async function getJSessionId() {
  var axiosResult = await axios.get(
    process.env.HFS_BASE_ADDRESS +
      "/rest/pvms/web/publicapp/v1/download-qr-code?appType=3&sizeType=1"
  );

  Configuration.JSESSIONID =
    axiosResult.headers["set-cookie"][0].split(";")[0] + ";";
}

async function getUniSSOToken() {
  axiosResult = await axios.post(
    process.env.HFS_BASE_ADDRESS + Configuration.LOGIN_URL,
    Configuration.LOGIN_USER_INFO,
    {
      headers: {
        "Content-Type": "application/json",
        Cookie: Configuration.JSESSIONID,
      },
    }
  );

  Configuration.UNISSO_V_C_S =
    axiosResult.headers["set-cookie"][0].split(";")[0] + ";";

  Configuration.MULTI_REGION_NAME = axiosResult.data.respMultiRegionName[1];
}

async function getDpSessionToken() {
  var cookies;

  axiosResult = await axios
    .get(process.env.HFS_BASE_ADDRESS + Configuration.MULTI_REGION_NAME, {
      headers: {
        Cookie: Configuration.JSESSIONID + Configuration.UNISSO_V_C_S,
      },
      maxRedirects: 0,
      redirect: "manual",
    })
    .catch((reason) => {
      if (reason.status == 302) {
        cookies = reason.response.headers["set-cookie"][0];
      } else {
        console.log(reason);
      }
    });

  Configuration.DP_SESSION_TOKEN = cookies.split(";")[0] + ";";
}

async function main() {
  // get publick key for user data encryption
  await getPubKey();

  // get login user info
  getLoginUserInfo();

  // validate user
  getLoginUrl();

  // get JSESSIONID
  await getJSessionId();

  // get UNISSO_V_C_S
  await getUniSSOToken();

  // get dp-session token
  await getDpSessionToken();

  // get plants list
  //await getPlantsList();
}

main();
