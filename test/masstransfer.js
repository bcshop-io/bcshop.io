var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let Token = artifacts.require("BCSPromoToken");
let token;

let MassTransfer = artifacts.require("MassTransfer");
let massTransfer;

const TokensToMint = 10000;


async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

//1 accounts ~ 35k gas
contract("MassTransfer", function(accounts) {
    it("create and mint tokens for transfer", async function() {
        token = await Token.new("Promo", "BCP", 0);
        console.log("Token creation gas: " + web3.eth.getTransactionReceipt(token.transactionHash).gasUsed);
        massTransfer = await MassTransfer.new(token.address);
        console.log("MassTrasnfer creation gas: " + web3.eth.getTransactionReceipt(massTransfer.transactionHash).gasUsed);
        let tx = await token.mint(massTransfer.address, TokensToMint);
        console.log("Gas used for mint: " + tx.receipt.gasUsed);

        assert.equal(await _TB(massTransfer.address), TokensToMint, "Invalid MassTransfer balance");
    });

    it("try to mass transfer as not owner should fail", async function() {
        let tokens = [1, 2, 3];
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
            await massTransfer.transferEqual(2, receivers, {from:accounts[2]});
        }catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("mass transfer equal - everybody receives 1 token", async function() {
        let receivers = [];
        let totalAccounts = 100;
        for(let i = 0; i < totalAccounts; ++i) {
            receivers.push(accounts[i%10]);
        }        

        let tokens = 2;
        let tx = await massTransfer.transferEqual(tokens, receivers);
        console.log("Gas used: " + tx.receipt.gasUsed);

        assert.equal(await _TB(accounts[2]), 10 * tokens, "");
    });

    it("mass transfer - everybody receives different", async function() {
        let tokens = [1, 2, 3];
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
