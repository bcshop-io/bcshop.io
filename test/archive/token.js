var Token = artifacts.require("BCSToken");
var token;

var TokenCap = 1000;
var owner, user1, user2;

//returns real tokens amount considering token decimals
async function _RT(_tokens) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.getRealTokenAmount.call(_tokens)).toNumber());
    })
}

//returns specifeid token's real balance
async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

contract("BCSToken", function(accounts) {
        
    it("create token", async function() {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        token = await Token.new(TokenCap, 18);
        await token.setLockedState(false);
        assert.equal(await _TB(owner), await _RT(1000), "Owner shoudl have all the tokens");
        assert.equal(await token.name.call(), "BCShop.io Token", "Invalid token name");
        assert.equal(await token.symbol.call(), "BCS", "Invalid token symbol");
    })

    it("transfer tokens", async function() {
        var tresult1 =await token.transfer(user1, await _RT(200));        
        var tresult2 =await token.transfer(user2, await _RT(300));

        assert.equal(await _TB(user1), await _RT(200), "user1 should have 200 tokens");
        assert.equal(tresult1.logs[0].event, "Transfer", "Should fire Transfer event");
    })

    it("transfer 0 tokens", async function() {
        await token.transfer(user2, 0);
        assert.equal(await _TB(user2), await _RT(300), "user2 should have 300 tokens");
    })

    it("transfer too much tokens", async function() {
        try {
            await token.transfer(user1, await _RT(TokenCap));            
        } catch(e) {
            return true;
        }
        assert.isTrue("Transfer should fail");
    })

    it("approve transfer", async function() {
        var tresult1 = await token.approve(user1, await _RT(50), {from:user2});
        assert.equal(await token.allowance.call(user2, user1), await _RT(50), "Allowance should be 50");
        assert.equal(tresult1.logs[0].event, "Approval", "Should fire Approval event");
    })

    it("transfer from", async function() {
        await token.transferFrom(user2, owner, await _RT(10), {from:user1});
        assert.equal(await _TB(owner), await _RT(510), "Owner should get 10 tokens");        
        assert.equal(await token.allowance.call(user2, user1), await _RT(40), "Allowance should be 40");
        assert.equal(await _TB(user2), await _RT(290), "User2 should get 290 tokens");        
    })

    it("try transfer from too much, should fail", async function() {
        try {
            await token.transferFrom(user2, owner, await _RT(45), {from:user1});
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "TransferFrom should fail");
    })

    it("user2 tries to burn, should fail", async function() {
        var tb = await _RT(1);
        assert.isAbove(await _TB(user2), tb, "User2 should get at least 1 tokens"); 
        try {
            await token.burn(tb, {from:user2});
        } catch (e) {
            return true;
        }
        assert.isTrue(false, "burn should fail");
    })

    it("owner burns tokens", async function() {
        var tb = await _RT(10);        
        await token.burn(tb, {from:owner});
        assert.equal(await _TB(owner), await _RT(500), "Invalid owner balance, should be 500 tokens");
    })
})

contract("BCSToken. try to call internal methods", function(accounts) {
    var ErrorTokenInternalTransfer = artifacts.require("ErrorTokenInternalTransfer");
    var villain;

    it("create token", async function() {
        owner = accounts[0];
        user1 = accounts[1];
        user2 = accounts[2];

        token = await Token.new(TokenCap, 18);
        await token.setLockedState(false);
        assert.equal(await _TB(owner), await _RT(1000), "Owner shoudl have all the tokens");
        villain = await ErrorTokenInternalTransfer.new();
    })

    it("transfer tokens", async function() {
        var tresult1 = await token.transfer(user1, await _RT(200));        
        var tresult2 = await token.transfer(user2, await _RT(300));
        await token.transfer(villain.address, await _RT(100));
        
        assert.equal(await _TB(user1), await _RT(200), "user1 should have 200 tokens");
        assert.equal(tresult1.logs[0].event, "Transfer", "Should fire Transfer event");
    })

    it("make legal transfer", async function() {
        await villain.makeLegalTransfer(token.address, user1, await _RT(50));
        assert.equal(await _TB(user1), await _RT(250), "Legal transfer should be OK");
    })

    it("make illegal transferFrom. should fail", async function() {
        try {
            await villain.makeErrorTransfer(token.address, user1, 0);
        } catch(e) {
            return true;
        }
        assert.isTrue(false, "Illegal transfer should fail");
    })
})

contract("BCSToken. setReserved manipulations. ", function(accounts) {
    
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    TokenCap = 1000;
    
    before(async function() {
        token = await Token.new(TokenCap, 0);
        await token.setLockedState(false);

        await token.transfer(user1, 300);
        await token.transfer(user2, 500);
    });

    it("valuable token amount should equal total supply", async function() {
        assert.equal((await token.getValuableTokenAmount.call()).toNumber(), (await token.totalSupply.call()).toNumber());
    });

    it("can't setReserved as not owner", async function() {
        try {
            await token.setReserved(user1, true, {from:accounts[4]});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    })

    it("setReserved user1. valuable token amount should decrease", async function() {
        await token.setReserved(user1, true);
        assert.equal(await token.getValuableTokenAmount.call(), 700, "Valuable amount should equal 700");
    });
    
    it("setReserved user1 again. amount decreases again :(", async function() {
        await token.setReserved(user1, true);
        assert.equal(await token.getValuableTokenAmount.call(), 400, "Valuable amount should equal 400");
    });

    it("setReserved user2. amount decreases < 0 :(", async function() {
        await token.setReserved(user2, true);
        console.log(await token.getValuableTokenAmount.call());
        console.log(await token.reservedAmount.call());
    });

    it("cancel setReserved user1 one time", async function() {
        await token.setReserved(user1, false);
        console.log(await token.getValuableTokenAmount.call());
        console.log(await token.reservedAmount.call());
    });
    
    it("multiple cancel setReserved user2", async function() {
        await token.setReserved(user2, false);
        console.log(await token.getValuableTokenAmount.call());
        console.log(await token.reservedAmount.call());  
        //this transaction fails as reserved can't be less than zero
        try {
            await token.setReserved(user2, false);
        } catch(e) {
            return true;
        }
        throw "should fail";
    });

    it("set reservedAmount to 0", async function() {
        await token.setReserved(user1, false);
        assert.equal((await token.getValuableTokenAmount.call()).toNumber(), (await token.totalSupply.call()).toNumber());
    });

    it("set user1 and user2 as reserved, transfer tokens between them", async function() {
        await token.setReserved(user2, true);
        await token.setReserved(user1, true);

        let reserved = (await token.reservedAmount.call()).toNumber();
        await token.transfer(user1, 500, {from:user2});
        assert.equal((await token.reservedAmount.call()).toNumber(), reserved);        
    });

    it("transfer from reserved to unreserved", async function() {
        await token.transfer(owner, 200, {from:user1});
        assert.equal((await token.reservedAmount.call()).toNumber(), 600);   
    });

    it("cancel setReserved from user1, reserved shoiuld be 0", async function() {
        await token.setReserved(user1, false);
        assert.equal((await token.reservedAmount.call()).toNumber(), 0);   
    })
});
