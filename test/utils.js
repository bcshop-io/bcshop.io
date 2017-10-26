/*
String extension methods
*/

String.prototype.FromUTFBytes = function FromUTFBytes() {
	let bytesRes = this.slice(2);
	let converted = "";
	for(let i = 0; i < bytesRes.length; i+=2) {
		let char = "0x" + bytesRes.substr(i, 2);
		if(char == "0x00") break;		
		converted = converted + String.fromCharCode(char);
	}

	return converted;
};