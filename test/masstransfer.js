var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let Token = artifacts.require("BCSToken");
let token;

let MassTransfer = artifacts.require("MassTransfer");
let massTransfer;

const TokensToMint = 10000;


//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

//1 accounts ~ 37k gas
contract("MassTransfer", function(accounts) {
    it("create and mint tokens for transfer", async function() {
        let tokenCap = 1000;
        token = await Token.new(tokenCap, 18);        
        console.log("Token creation gas: " + web3.eth.getTransactionReceipt(token.transactionHash).gasUsed);

        var users = [accounts[8], accounts[9], accounts[7], accounts[6], accounts[5]];
        massTransfer = await MassTransfer.new(token.address, users);
        console.log("MassTransfer creation gas: " + web3.eth.getTransactionReceipt(massTransfer.transactionHash).gasUsed);
        // let tx = await token.mint(massTransfer.address, TokensToMint);
        // console.log("Gas used for mint: " + tx.receipt.gasUsed);
        await token.transfer(massTransfer.address, await _TB(accounts[0]));
        await token.allowTransferFor(massTransfer.address, true);
        assert.equal(await _TB(massTransfer.address), await _RT(tokenCap), "Invalid MassTransfer balance");

        assert.isTrue(await massTransfer.allowedUsers.call(accounts[0]), "Owner should be allowed now");
    });

    // it("!!!", async function() {
    //     let tx = await massTransfer.withdrawTokens(token.address, accounts[0], TokensToMint);
    //     console.log("Gas to withdraw: " + tx.receipt.gasUsed);
    // })

    it("try to mass transfer as not owner should fail", async function() {
        let tokens = [await _RT(1), await _RT(2), await _RT(3)];
        console.log(tokens);
        let receivers = [accounts[0],accounts[1],accounts[2]];
        try {            
            await massTransfer.transfer(receivers, tokens, {from:accounts[2]});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    });
    
    it("try to mass transfer equal amount as not owner, should fail", async function() {        
        let receivers = [accounts[0],accounts[1],accounts[2]];
        try {            
            await massTransfer.transferEqual(await _RT(2), receivers, {from:accounts[2]});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("mass transfer equal - everybody receives 1 token", async function() {
        let receivers = [];
        let totalAccounts = 10;
        for(let i = 0; i < totalAccounts; ++i) {
            receivers.push(accounts[i%10]);
        }        

        let tokens = await _RT(2);
        let tx = await massTransfer.transferEqual(tokens, receivers);
        console.log("Gas used: " + tx.receipt.gasUsed);

  //      assert.equal(await _TB(accounts[2]), totalAccounts / 10 * tokens, "");
    });

    it("mass transfer equal - everybody receives 1 token, as allowed user", async function() {
        let receivers = [];
        let totalAccounts = 10;
        for(let i = 0; i < totalAccounts; ++i) {
            receivers.push(accounts[i%10]);
        }        

        let tokens = await _RT(2);
        let tx = await massTransfer.transferEqual(tokens, receivers, {from:accounts[8]});
        console.log("Gas used: " + tx.receipt.gasUsed);

  //      assert.equal(await _TB(accounts[2]), totalAccounts / 10 * tokens, "");
    });

    it("change user state", async function() {
        await massTransfer.changeUser(accounts[7], true);
        assert.isTrue(await massTransfer.allowedUsers.call(accounts[7]), "7 should be true now");

        await massTransfer.changeUser(accounts[8], false);
        assert.isFalse(await massTransfer.allowedUsers.call(accounts[8]), "8 should be false now");
    });

    it("new user should be able to transfer", async function() {
        let receivers = [];
        let totalAccounts = 10;
        for(let i = 0; i < totalAccounts; ++i) {
            receivers.push(accounts[i%10]);
        }        

        let tokens = await _RT(2);
        let tx = await massTransfer.transferEqual(tokens, receivers, {from:accounts[7]});
        console.log("Gas used: " + tx.receipt.gasUsed);
    })

    it("try to mass transfer equal amount as nonactive now user, should fail", async function() {        
        let receivers = [accounts[0],accounts[1],accounts[2]];
        try {            
            await massTransfer.transferEqual(await _RT(2), receivers, {from:accounts[8]});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("mass transfer - everybody receives different", async function() {
        let tokens = [await _RT(1), await _RT(2), await _RT(3)];
        let receivers = [accounts[0],accounts[1],accounts[2]];
        let oldTokens = [await _TB(accounts[0]), await _TB(accounts[1]), await _TB(accounts[2])];
        
        let tx = await massTransfer.transfer(receivers, tokens);

        for(let i = 0; i < 3; ++i) {
            assert.equal(await _TB(accounts[i]), oldTokens[i] + tokens[i], "Invalid tokens for #" + i);
        }
    });
    

    it("withdraw remained tokens", async function() {
        let tokens = await _TB(massTransfer.address);
        let oldTokens = await _TB(accounts[0]);      
        assert.isAbove(tokens, 0, "MassTransfer token balance should be above 0");
        await massTransfer.withdrawTokens(token.address, accounts[0], tokens);
        
        assert.equal(await _TB(massTransfer.address), 0, "MassTransfer token balance should be equal 0");
        assert.equal(await _TB(accounts[0]), oldTokens + tokens, "MassTransfer token balance should be equal 0");
    });
});
