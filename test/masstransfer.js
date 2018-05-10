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
    it("create token for transfer", async function() {
        let tokenCap = 1000;
        token = await Token.new(tokenCap, 18);        
        await token.setLockedState(false);

        var users = [accounts[8], accounts[9], accounts[7], accounts[6], accounts[5]];
        massTransfer = await MassTransfer.new(token.address, users);
        console.log("MassTransfer creation gas: " + web3.eth.getTransactionReceipt(massTransfer.transactionHash).gasUsed);

        //assert.equal(await _TB(massTransfer.address), await _RT(tokenCap), "Invalid MassTransfer balance");
        assert.isTrue(await massTransfer.allowedUsers.call(accounts[0]), "Owner should be allowed now");
        assert.isTrue(await massTransfer.allowedUsers.call(accounts[7]), "Accounts[7] should be allowed now");
    });

    it("transfer initial tokens", async function() {
        // transfer initial tokens otherwise first transfer will require higher amount of gas
        for(let i = 1; i < 10; ++i) {
            await token.transfer(accounts[i], await _RT(1));
        }
        let tx = await token.transfer(massTransfer.address, (await _TB(accounts[0]))/2);
        console.log("Gas used for transfer: " + tx.receipt.gasUsed);
    })

    // it("!!!", async function() {
    //     let tx = await massTransfer.withdrawTokens(token.address, accounts[0], TokensToMint);
    //     console.log("Gas to withdraw: " + tx.receipt.gasUsed);
    // })

    it("try to mass transfer as not owner should fail", async function() {
        let tokens = [await _RT(1), await _RT(2), await _RT(3)];
        //console.log(tokens);
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

    it("mass transfer - everybody receives different", async function() {
        // let tokens = [await _RT(1), await _RT(2), await _RT(3)];
        // let receivers = [accounts[0],accounts[1],accounts[2]];
        // let oldTokens = [await _TB(accounts[0]), await _TB(accounts[1]), await _TB(accounts[2])];

        let tokens = [];
        let receivers = [];
        let oldTokens = [];
        for(let i = 0; i < 10; ++i) {
            tokens.push(await _RT(i));
            receivers.push(accounts[i]);
            oldTokens.push(await _TB(accounts[i]));
        }
        
        let tx = await massTransfer.transfer(receivers, tokens);        
        console.log("Gas used for not equal transfer: " + tx.receipt.gasUsed);
        for(let i = 0; i < 10; ++i) {
            assert.equal(await _TB(accounts[i]), oldTokens[i] + tokens[i], "Invalid tokens for #" + i);
        }
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
        tx = await massTransfer.transfer(
            receivers, 
            [tokens,tokens,tokens,tokens,tokens,tokens,tokens,tokens,tokens,tokens], 
            {from:accounts[7]}
        );
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

    it("withdraw remained tokens", async function() {
        let tokens = await _TB(massTransfer.address);
        let oldTokens = await _TB(accounts[0]);      
        assert.isAbove(tokens, 0, "MassTransfer token balance should be above 0");
        await massTransfer.withdrawTokens(token.address, accounts[0], tokens);
        
        assert.equal(await _TB(massTransfer.address), 0, "MassTransfer token balance should be equal 0");
        assert.equal(await _TB(accounts[0]), oldTokens + tokens, "MassTransfer token balance should be equal 0");
    });
});


contract("MassTransfer. Measure gas", function(accounts) {    
    
    beforeEach(async function() {
        let tokenCap = 100000;
        token = await Token.new(tokenCap, 18);        
        await token.setLockedState(false);

        var users = [accounts[8], accounts[9], accounts[7], accounts[6], accounts[5]];
        massTransfer = await MassTransfer.new(token.address, users);
                
        for(let i = 1; i < 10; ++i) {
            await token.transfer(accounts[i], await _RT(1));
        }
        let tx = await token.transfer(massTransfer.address, (await _TB(accounts[0]))/2);
    });

    async function transfer(count) {
        let tokens = [];
        let receivers = [];
        let oldTokens = [];
        for(let i = 0; i < count; ++i) {
            tokens.push(await _RT(i%10));
            receivers.push(accounts[i%10]);
            oldTokens.push(await _TB(accounts[i%10]));
        }
        
        let tx = await massTransfer.transfer(receivers, tokens, {gas:4200000, from:accounts[7]});        
        console.log(`Gas used for ${count} transactions: ${tx.receipt.gasUsed}`);
    }
    
    it("20 receivers", async function() {
        await transfer(20);
        //Gas used for 20 transactions: 427005
    });

    it("40 receivers", async function() {
        await transfer(40);
        //Gas used for 40 transactions: 830488
    });

    it("100 receivers", async function() {
        await transfer(100);
        //Gas used for 100 transactions: 2040973
    });

    it("200 receivers", async function() {
        await transfer(200);
        //Gas used for 200 transactions: 4058574
    });
});
