let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

let Token = artifacts.require("BCSToken");
let Wallet = artifacts.require("CustomTrancheWallet");
let utils = new (require("./timeutils.js"))(web3);

const TokenCap = 10000;
const Decimals = 0;

let wallet;
let token;

async function checkAvailableAmount(expected) {
    return new Promise(async function(resolve, reject) {
        assert.equal((await wallet.getAvailableAmount.call()).toNumber(), expected, "Invalild available amount");
        resolve (true);
    });        
}

async function _TB(_holder) {
    return new Promise(async (resolve, reject) =>{
        return resolve((await token.balanceOf.call(_holder)).toNumber());
    })
}

contract("CustomTrancheWallet. Normal usage. 3 periods. ", function(accounts) {

    let beneficiary;
    let owner;
    let amountToLock = 5000;
    let onePeriod = 86400; //1 day
    let unlockDates = [];
    let unlockAmounts = [500, 1300, 5000];

    before(async function() {
        owner = accounts[0];
        beneficiary = accounts[1];
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);

        let currentTime = utils.currentTime();
        unlockDates.push(currentTime + onePeriod);
        unlockDates.push(currentTime + onePeriod * 2);
        unlockDates.push(currentTime + onePeriod * 3);        

        wallet = await Wallet.new(token.address, beneficiary, unlockDates, unlockAmounts);
    });

    it("initial amount to withdraw should be 0", async function() {
        await checkAvailableAmount(0);        
    });
    
    it("deposit tokens and check available amount before lock", async function() {
        await token.transfer(wallet.address, amountToLock);        
        await checkAvailableAmount(amountToLock);
    });

    it("lock tokens, state should be 'locked'", async function() {
        await wallet.lock();
        assert.isTrue(await wallet.locked(), "Locked should be true");
    });

    it("amount to withdraw should be 0", async function() {
        await checkAvailableAmount(0);
    });

    it("one period passed, available amount should equal unlockAmounts[0]", async function() {
        await utils.timeTravelAndMine(onePeriod);
        await checkAvailableAmount(unlockAmounts[0]);
    });

    it("withdraw it and check amount withdrawn", async function() {        
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), unlockAmounts[0], "Invalid amount of tokens received");
        assert.equal(await wallet.alreadyWithdrawn.call(), unlockAmounts[0], "Invalid withdrawn amont");
    });

    it("less than period passed, available amount should be 0", async function() {
        await utils.timeTravelAndMine(onePeriod / 10);
        await checkAvailableAmount(0);
    });

    it("one period passed, available amount should equal unlockAmounts[1]-unlockAmounts[0]", async function() {
        await utils.timeTravelAndMine(onePeriod);
        await checkAvailableAmount(unlockAmounts[1]-unlockAmounts[0]);
    });

    it("withdraw it and check amount withdrawn", async function() {
        let oldBalance = await _TB(beneficiary);
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), unlockAmounts[1], "Invalid amount of tokens received");
        assert.equal(await wallet.alreadyWithdrawn.call(), unlockAmounts[1], "Invalid withdrawn amont");
    });

    it("complete lock period passed, amount should equal to all the balance - withdrawn", async function() {
        await utils.timeTravelAndMine(onePeriod);
        await checkAvailableAmount(unlockAmounts[2]-unlockAmounts[1]);
    });

    it("withdraw it, wallet should be empty", async function() {
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), amountToLock, "Invalid amount of tokens received");
        assert.equal(await _TB(wallet.address), 0, "Wallet should be empty");
    });
});



contract("CustomTrancheWallet. Normal usage. 1 period. ", function(accounts) {
    
    let beneficiary;
    let owner;
    let amountToLock = 5000;
    let onePeriod = 86400; //1 day
    let unlockDates = [];
    let unlockAmounts = [5000];

    before(async function() {
        owner = accounts[0];
        beneficiary = accounts[1];
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);

        let currentTime = utils.currentTime();
        unlockDates.push(currentTime + onePeriod);
        
        wallet = await Wallet.new(token.address, beneficiary, unlockDates, unlockAmounts);
    });

    it("initial amount to withdraw should be 0", async function() {
        await checkAvailableAmount(0);        
    });
    
    it("deposit tokens and check available amount before lock", async function() {
        await token.transfer(wallet.address, amountToLock);        
        await checkAvailableAmount(amountToLock);
    });

    it("lock tokens, state should be 'locked'", async function() {
        await wallet.lock();
        assert.isTrue(await wallet.locked(), "Locked should be true");
    });

    it("amount to withdraw should be 0", async function() {
        await checkAvailableAmount(0);
    });   

    it("complete lock period passed, amount should equal to all the wallet balance", async function() {
        await utils.timeTravelAndMine(onePeriod);
        await checkAvailableAmount(amountToLock);
    });

    it("withdraw it, wallet should be empty", async function() {
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), amountToLock, "Invalid amount of tokens received");
        assert.equal(await _TB(wallet.address), 0, "Wallet should be empty");
    });
});

contract("CustomTrancheWallet. Creation constraints. ", function(accounts) {

    let owner = accounts[0];
    let beneficiary = accounts[1];
    let wallet;    
    let oneHour = 3600;

    beforeEach(async function() {
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);
    });

    function exceptionOnCreation(comment, _unlockDates, _unlockAmounts) {
        it(comment, async function() {
            try {
                wallet = await Wallet.new(token.address, beneficiary, _unlockDates, _unlockAmounts);
            } catch (e) {                
                if(e.toString().indexOf("VM Exception while processing transaction: revert") != -1) {
                    return true;
                }
            }
            throw "Should fail";
        });
    }
 

    exceptionOnCreation(
        "can't create wallet with no unlock dates", 
        [], 
        []);


    exceptionOnCreation(
        "can't create wallet with different dates and amounts length", 
        [+utils.currentTime() + oneHour],
        [100, 500]);


    exceptionOnCreation(
        "can't create wallet if dates are unordered",
        [+utils.currentTime() + 2 * oneHour, +utils.currentTime() + oneHour],
        [100, 500]);

    
    exceptionOnCreation(
        "can't create wallet if amounts are unordered",
        [+utils.currentTime() + oneHour, +utils.currentTime() + 2 * oneHour],
        [1100, 500]);    
});



contract("CustomTrancheWallet. SetParams constraints. ", function(accounts) {

    let owner = accounts[0];
    let beneficiary = accounts[1];
    let wallet;    
    let oneHour = 3600;

    beforeEach(async function() {
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);

        wallet = await Wallet.new(token.address, beneficiary, [utils.currentTime() + oneHour], [1000]);
    });

    function exceptionOnSetParams(comment, _unlockDates, _unlockAmounts) {
        it(comment, async function() {
            try {
                await wallet.setParams(beneficiary, _unlockDates, _unlockAmounts);
            } catch (e) {                
                if(e.toString().indexOf("VM Exception while processing transaction: revert") != -1) {
                    return true;
                }
            }
            throw "Should fail";
        });
    }
 

    exceptionOnSetParams(
        "can't set params with no unlock dates", 
        [], 
        []);


    exceptionOnSetParams(
        "can't set params with different dates and amounts length", 
        [+utils.currentTime() + oneHour],
        [100, 500]);


    exceptionOnSetParams(
        "can't set params if dates are unordered",
        [+utils.currentTime() + 2 * oneHour, +utils.currentTime() + oneHour],
        [100, 500]);

    
    exceptionOnSetParams(
        "can't set params if amounts are unordered",
        [+utils.currentTime() + oneHour, +utils.currentTime() + 2 * oneHour],
        [1100, 500]);

    it("can't setParams as not owner", async function() {
        try {
            let currentTime = utils.currentTime();
            await wallet.setParams(
                beneficiary, 
                [currentTime + oneHour, currentTime + 2 * oneHour, currentTime + 3 * oneHour],
                [100, 500, 2000],
                {from:accounts[2]});
        } catch (e) {                
            if(e.toString().indexOf("VM Exception while processing transaction: revert") != -1) {
                return true;
            }
        }
        throw "Should fail";
    });

    it("setParams successfully", async function() {
        let currentTime = utils.currentTime();
        await wallet.setParams(
            beneficiary, 
            [currentTime + oneHour, currentTime + 2 * oneHour, currentTime + 3 * oneHour],
            [100, 500, 2000]);

        assert.equal(await wallet.unlocksCount.call(), 3, "Unlocks count should be changed");
        assert.equal(await wallet.unlockDates.call(1), currentTime + 2 * oneHour, "Invalid unlock dates");
        assert.equal(await wallet.unlockAmounts.call(2), 2000, "Invalid unlock amounts");
    });
});



contract("CustomTrancheWallet. Lock constraints. ", function(accounts) {
    let owner = accounts[0];
    let beneficiary = accounts[1];
    let wallet;    
    let oneHour = 3600;

    beforeEach(async function() {
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);

        wallet = await Wallet.new(
            token.address, 
            beneficiary, 
            [utils.currentTime() + oneHour/2, utils.currentTime() + oneHour], 
            [100, 1000]);
    });

    it("can't lock wallet with amount less than in unlockAmounts", async function() {
        await token.transfer(wallet.address, 600);
        try {
            await wallet.lock();
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("can't lock wallet with amount greater than in unlockAmounts", async function() {
        await token.transfer(wallet.address, 1600);
        try {
            await wallet.lock();
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("can't lock as not owner", async function() {
        try {          
            await token.transfer(wallet.address, 1000);  
            await wallet.lock({from:accounts[2]});
        } catch (e) {            
            if(e.toString().indexOf("VM Exception while processing transaction: revert") != -1) {
                return true;
            }
        }
        throw "Should fail";
    });

    it("can't lock after lock", async function() {
        await token.transfer(wallet.address, 1000);
        await wallet.lock();

        try {
            await wallet.lock();
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });

    it("can't setparams after lock", async function() {
        await token.transfer(wallet.address, 1000);
        await wallet.lock();
        let currentTime = utils.currentTime();

        try {
            await wallet.setParams(
                beneficiary, 
                [currentTime + oneHour, currentTime + 2 * oneHour, currentTime + 3 * oneHour],
                [100, 500, 2000]);
        } catch(e) {
            return true;
        }
        throw "Should fail";
    });
});

contract("CustomTrancheWallet. Miss withdraw case", function(accounts) {
    
    let beneficiary;
    let owner;
    let amountToLock = 5000;
    let onePeriod = 86400; //1 day
    let unlockDates = [];
    let unlockAmounts = [500, 1300, 2800, 5500];

    before(async function() {
        owner = accounts[0];
        beneficiary = accounts[1];
        token = await Token.new(TokenCap, Decimals);
        await token.setLockedState(false);

        let currentTime = utils.currentTime();
        unlockDates.push(currentTime + onePeriod);
        unlockDates.push(currentTime + onePeriod * 2);
        unlockDates.push(currentTime + onePeriod * 3);        
        unlockDates.push(currentTime + onePeriod * 4);        

        wallet = await Wallet.new(token.address, beneficiary, unlockDates, unlockAmounts);
        await token.transfer(wallet.address, 5500);
        await wallet.lock();
    });

    it("one periods passed, withdraw", async function() {
        await utils.timeTravelAndMine(+onePeriod + 100);
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), 500, "Beneficiary should get first tranche");
        assert.equal(await wallet.getAvailableAmount.call(), 0, "Invalid available amount");
    });

    it("two periods passed, available amount should equal first+second tranches", async function() {
        await utils.timeTravelAndMine(onePeriod*2);
        assert.equal(await wallet.getAvailableAmount.call(), 2800-500, "Invalid available amount");    
    });

    it("withdraw it, check the balance", async function (){
        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), 2800, "Beneficiary should get three tranches");
        assert.equal(await wallet.getAvailableAmount.call(), 0, "Invalid available amount");
    });

    it("complete unlock time passed, withdraw tokens, wallet should be empty", async function() {
        await utils.timeTravelAndMine(onePeriod);

        await wallet.sendToBeneficiary();
        assert.equal(await _TB(beneficiary), 5500, "Invalid token balance of beneficiary");
        assert.equal(await _TB(wallet.address), 0, "Wallet should be empty");
    });
});
