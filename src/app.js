const axios = require('axios');
require('dotenv').config()
const rs = require('jsrsasign');
const crypto = require('crypto').webcrypto;

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
		'orgName': process.env.HFS_ORG_NAME || undefined,
		'usernameInp': process.env.HFS_USERNAME || undefined,
		'valueInp': process.env.HFS_PASSWORD || undefined,
		'verifycodeInp': process.env.HFS_VERIFY_CODE_INP || undefined,
		'search': process.env.HFS_SEARCH || undefined,
	}
}

function submitData(submitUserName, nationCode, multiregion) {
	// preSubmit()
	var params = initParam(submitUserName, nationCode);
	var orgName = params.orgName;
	var usernameInp = params.usernameInp;
	var valueInp = params.valueInp;
	var verifycodeInp = params.verifycodeInp;
	var search = params.search;
	$.ajax({
		type: 'GET',
		url: "/unisso/pubkey",
		contentType: "application/json",
		dataType: "json",
		success: function (result, request) {
			if (result) {
				var data = initLoginUserInfo(orgName, usernameInp, valueInp, verifycodeInp, multiregion);
				if (result.enableEncrypt) {
					var pubKey = KEYUTIL.getKey(result.pubKey);
					var valueEncode = encodeURIComponent(valueInp);
					var encryptValue = "";
					for (var i = 0; i < valueEncode.length / 270; i++) {
						var currntValue = valueEncode.substr(i * 270, 270);
						var encryptValueCurrent = KJUR.crypto.Cipher.encrypt(currntValue, pubKey, "RSAOAEP384");
						encryptValue = encryptValue == "" ? "" : encryptValue + "00000001";
						encryptValue = encryptValue + hextob64(encryptValueCurrent);
					}
					data.password = encryptValue + result.version;
				}
				if ($('#loginWithMessage').is(':visible')) {
					if (search === "") {
						search = "?step=phoneAndSmsLogin";
					} else {
						search = search + "&step=phoneAndSmsLogin";
					}
					data = dealLoginUserInfo(result, data, nationCodeSelect)
				}
				var URL = '/unisso/v2/validateUser.action' + search;
				if (result.enableEncrypt) {
					if (search === "") {
						URL = '/unisso/v3/validateUser.action'
							+ "?timeStamp=" + result.timeStamp + "&nonce="
							+ getSecureRandom();
					} else {
						URL = '/unisso/v3/validateUser.action' + search
							+ "&timeStamp=" + result.timeStamp + "&nonce="
							+ getSecureRandom();
					}
				}
			} else {
				var data = initLoginUserInfo(orgName, usernameInp, valueInp, verifycodeInp, multiregion);
				if ($('#loginWithMessage').is(':visible')) {
					search = search + "&step=phoneAndSmsLogin";
					data = dealLoginUserInfo(result, data, nationCodeSelect)
				}
				var URL = '/unisso/validateUser.action' + search;
			}
			var loginUserInfo = JSON.stringify(data);
			ajaxPost(URL, loginUserInfo, true);
		},
		error: function (xhr, ajaxOptions, thrownError) {
			enableBtn();
			showErrorMessage(connectionErrorMsg);
		}
	});
}

function initLoginUserInfo() {
	return {
		"organizationName": process.env.HFS_ORG_NAME || undefined,
		"username": process.env.HFS_USERNAME || undefined,
		"password": process.env.HFS_PASSWORD || undefined,
		"verifycode": process.env.HFS_VERIFY_CODE_INP || undefined,
		"multiRegionName": process.env.HFS_SEARCH || undefined,
	};
}

async function getPubKey() {
	const response = await axios.get(process.env.HFS_BASE_ADDRESS + process.env.HFS_EP_PUBKEY)
	return response.data;
}

function getSecureRandom() {
	var arr = new Uint8Array(16);
	crypto.getRandomValues(arr);
	var result = '';
	for (var i = 0; i < arr.length; i++) {
		result = result + arr[i].toString(16);
	}
	return result;
}

async function axiosPost(URL, loginUserInfo) {
	axios
		.post(process.env.HFS_BASE_ADDRESS + URL,
			loginUserInfo,
			{
				headers: {
					'Content-Type': 'application/json'
				},
				withCredentials: true
			})
		.then(response =>
			console.log(response)
		)
		.catch(error =>
			console.log(error)
		);
}

async function main() {
	const result = await getPubKey()
	var data = initLoginUserInfo()

	if (result.enableEncrypt) {
		var pubKey = rs.KEYUTIL.getKey(result.pubKey);
		var valueEncode = encodeURIComponent(data.password);
		var encryptValue = "";
		for (var i = 0; i < valueEncode.length / 270; i++) {
			var currntValue = valueEncode.substr(i * 270, 270);
			var encryptValueCurrent = rs.KJUR.crypto.Cipher.encrypt(currntValue, pubKey, "RSAOAEP384");
			encryptValue = encryptValue == "" ? "" : encryptValue + "00000001";
			encryptValue = encryptValue + rs.hextob64(encryptValueCurrent);
		}
		data.password = encryptValue + result.version;
	}

	var URL = '/unisso/v2/validateUser.action';
	if (result.enableEncrypt) {
		URL = '/unisso/v3/validateUser.action'
			+ "?timeStamp=" + result.timeStamp + "&nonce="
			+ getSecureRandom();
	}

	var loginUserInfo = JSON.stringify(data);
	await axiosPost(URL, loginUserInfo);
}

main()
