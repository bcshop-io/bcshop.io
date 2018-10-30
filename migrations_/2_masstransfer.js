let fs = require("fs");
let Token = artifacts.require("BCSToken");
let MassTransfer = artifacts.require("MassTransfer");

module.exports = async function(deployer, network, accounts) { 
    // Deploy the Migrations contract as our only task
    let TokenCap = 10000000;
    let TokensToTransfer = 200000000000000000000000;

    let token = await Token.new(TokenCap, 18);
    let signers = [accounts[1], accounts[2]];
    let mt = await MassTransfer.new(token.address, signers);

    await token.setLockedState(false);
    await token.transfer(mt.address, TokensToTransfer);

    console.log(`Token address ${token.address}`);
    console.log(`MassTransfer address ${mt.address}`);

    fs.writeFileSync("bountytest.json", JSON.stringify({token:token.address, mt:mt.address}, null, '\t'));
  }; 