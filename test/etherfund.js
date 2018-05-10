var Web3 = require("web3");
var web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

var Fund = artifacts.require("EtherFund");

var OneEther = 1000000000000000000;
var tranche1 = OneEther;
var tranche2 = OneEther;
var tranche3 = OneEther;

var gasPrice = 20000000000;

contract("EtherFund", function(accounts) {
    var share1 = 200;
    var share2 = 800;
    var share3 = 0;
    var owner = accounts[0];
    var user1 = accounts[1];
    var user2 = accounts[2];
    var user3 = accounts[3];
    var user4 = accounts[4];
    var fund;
    var newFund;
    var lastBalance1;
    var lastBalance2;
    var amountUser1;
    var amountUser2;

    it("creates fund with invalid shares (overflow test), should fail", async function() {
        await utils.expectContractException(async function() {
            fund = await Fund.new(user1, 65535, user2, 1001);
            console.log(await fund.sharePermille.call(user1));
            console.log(await fund.sharePermille.call(user2));
        });
    });

    it("creates fund with 20/80 distribution", async function() {
        fund = await Fund.new(user1, share1, user2, share2);

        assert.equal(await fund.sharePermille.call(user1), share1, "Invalid share of user1");
        assert.equal(await fund.sharePermille.call(user2), share2, "Invalid share of user2");        
        assert.equal(await fund.etherBalanceOf.call(user1), 0, "Initial user1 balance should be 0");
    });


    it("try to create fund with invalid distribution 60/60, should fail", async function() {
        try {
            fund = await Fund.new(user1, 600, user2, 600);
        } catch(e) {            
            return true;
        }
        throw "creation should fail";
    })

    it("transfer 1 ether to fund and check available bonus", async function() {        
        await web3.eth.sendTransaction({from:owner, to:fund.address, value:tranche1});
        
        assert.equal(await fund.etherBalanceOf.call(user1), tranche1 * share1 / 1000, "Invalid user1 balance");
        assert.equal(await fund.etherBalanceOf.call(user2), tranche1 * share2 / 1000, "Invalid user2 balance");
    })

    it("user1 withdraws his share, check fund balances after that", async function() {
        var oldBalance = await web3.eth.getBalance(user1);
        var amount = tranche1 * share1 / 1000;
        var txr = await fund.withdraw(amount, {from:user1, gasPrice:gasPrice});
        var newBalance = await web3.eth.getBalance(user1);        
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;

        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amount, "User1 should receive all its share");
    })

    it("check fund balances after withdraw", async function() {
        assert.equal(await fund.etherBalanceOf.call(user1), 0, "Invalid user1 balance");
        assert.equal(await fund.etherBalanceOf.call(user2), tranche1 * share2 / 1000, "Invalid user2 balance");
    })

    it("transfer 1 ether to fund", async function() {
        await web3.eth.sendTransaction({from:owner, to:fund.address, value:tranche2});
        
        assert.equal(await fund.etherBalanceOf.call(user1), tranche2 * share1 / 1000, "Invalid user1 balance");
        var user2share = (tranche1 + tranche2) * share2/1000;        
        assert.equal(await fund.etherBalanceOf.call(user2), user2share, "Invalid user2 balance");
    })
    
    it("user2 withdraws a part of his share", async function() {
        amountUser2 = (await fund.etherBalanceOf.call(user2)) / 10;

        var oldBalance = await web3.eth.getBalance(user2);        
        var txr = await fund.withdraw(amountUser2, {from:user2, gasPrice:gasPrice});                
        var newBalance = await web3.eth.getBalance(user2);        
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;

        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amountUser2, "User2 should receive its amount");
    })

    it("user1 withdraws a part of his share", async function() {
        amountUser1 = (await fund.etherBalanceOf.call(user1)) / 2;
        
        var oldBalance = await web3.eth.getBalance(user1);        
        var txr = await fund.withdraw(amountUser1, {from:user1, gasPrice:gasPrice});                
        var newBalance = await web3.eth.getBalance(user1);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;
        
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amountUser1, "User1 should receive its amount");
    })

    it("check available balances now", async function() {        
        lastBalance1 = (tranche2) * share1/1000 - amountUser1;        
        assert.equal(await fund.etherBalanceOf.call(user1), lastBalance1, "Invalid user1 balance");

        lastBalance2 = (tranche1 + tranche2) * share2/1000 - amountUser2;        
        assert.equal(await fund.etherBalanceOf.call(user2), lastBalance2, "Invalid user2 balance");
    })

    it("try to withdraw 0 as a non-receiver, should get 0", async function() {
        amountUser1 = (await fund.etherBalanceOf.call(user1)) / 2;
        
        var oldBalance = await web3.eth.getBalance(owner);        
        var txr = await fund.withdraw(0, {from:owner, gasPrice:gasPrice});                
        var newBalance = await web3.eth.getBalance(owner);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;
        
        assert.equal(newBalance.plus(gasUsedCost).toNumber(), oldBalance.toNumber(), "Owner should receive 0");
    })

    it("balances of receivers shouldn't get changed", async function() {
        assert.equal(await fund.etherBalanceOf.call(user1), lastBalance1, "Invalid user1 balance");                
        assert.equal(await fund.etherBalanceOf.call(user2), lastBalance2, "Invalid user2 balance");
    })

    it("try to withdraw something as a non-receiver, should fail", async function() {
        try {
            await fund.withdraw(1, {from:owner});
        } catch(e) {
            return true;
        }
        throw "withdraw should fail";
    })

    it("try to withdraw more than it is possible as a user1, should fail", async function() {
        try {           
            await fund.withdraw(lastBalance1 + 10, {from:user1});
        } catch(e) {
            return true;
        }
        throw "withdraw should fail";
    })

    it("try to change shares to invalid values (overflow test). should fail", async function() {
        try {
            await fund.changeShares(user1, 65535, user2, 1001);
            console.log(await fund.sharePermille.call(user1));
            console.log(await fund.sharePermille.call(user2));
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares to invalid 20/30. should fail", async function() {
        try {
            await fund.changeShares(user1, 200, user2, 300);
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares to invalid users. should fail", async function() {
        try {
            await fund.changeShares(accounts[7], 300, accounts[8], 700);
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares as not owner. should fail", async function() {
        try {
            await fund.changeShares(user1, 600, user2, 400, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })
    
    it("transfer ether to fund, change shares to 30/70. it shouldn't affect current balances", async function() {
        await web3.eth.sendTransaction({from:owner, to:fund.address, value:tranche3});
        lastBalance1 = lastBalance1 + tranche3 * share1 / 1000;
        lastBalance2 = lastBalance2 + tranche3 * share2 / 1000;

        share1 = 300;
        share2 = 700;
        var txr = await fund.changeShares(user1, share1, user2, share2);        

        assert.equal(await fund.sharePermille.call(user1), share1, "Invalid share of user1");
        assert.equal(await fund.sharePermille.call(user2), share2, "Invalid share of user2");
        
        assert.equal((await fund.etherBalanceOf.call(user1)).toNumber(), lastBalance1, "Invalid user1 balance");                
        assert.equal((await fund.etherBalanceOf.call(user2)).toNumber(), lastBalance2, "Invalid user2 balance");
    })

    it("transfer 1 ether to fund, new shares should be distributed", async function() {
        await web3.eth.sendTransaction({from:owner, to:fund.address, value:tranche3});
                
        assert.equal(await fund.etherBalanceOf.call(user1), lastBalance1 + tranche3 * share1 / 1000, "Invalid user1 balance");        
        assert.equal(await fund.etherBalanceOf.call(user2), lastBalance2 + tranche3 * share2 / 1000, "Invalid user2 balance");      

        lastBalance1 = lastBalance1 + tranche3 * share1 / 1000;
        lastBalance2 = lastBalance2 + tranche3 * share2 / 1000;
    })

    it("change receiver as not owner, should fail", async function() {
        try {
            await fund.changeReceiver(user2, user3, {from:user1});        
        } catch (e) {
            return true;
        }
        throw "Function should fail";
    })

    it("change receiver from user2 to user3", async function() {
        await fund.changeReceiver(user2, user3, {from:owner});

        assert.equal(await fund.etherBalanceOf(user2), 0, "User2 balance should be 0");
        assert.equal(await fund.etherBalanceOf(user3), lastBalance2, "User3 balance should be equal to old User2");

        assert.equal(await fund.sharePermille.call(user2), 0, "Invalid share of user2");
        assert.equal(await fund.sharePermille.call(user3), share2, "Invalid share of user3");
    })

    it("try to migrate to another fund as not an owner, should fail", async function() {
        try {
            newFund = await Fund.new(user1, share1, user3, share2);
            await fund.migrate(newFund.address, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Migrate should fail";
    })

    it("try to copy state as not an owner", async function() {
        newFund = await Fund.new(user1, share1, user3, share2);
        await utils.expectContractException(async function() {
            await newFund.copyStateFor(fund.address, [user1, user3], {from:user2});
        });
    })

    it("migrate to another fund", async function() {
        newFund = await Fund.new(user1, share1, user3, share2);
        await fund.migrate(newFund.address);
        let tx = await newFund.copyStateFor(fund.address, [user1, user3]);

        assert.equal(await newFund.etherBalanceOf(user1), lastBalance1, "User1 balance should be equal to old User1");
        assert.equal(await newFund.etherBalanceOf(user3), lastBalance2, "User3 balance should be equal to old User3");

        assert.equal(await newFund.sharePermille.call(user1), share1, "Invalid share of user1");
        assert.equal(await newFund.sharePermille.call(user3), share2, "Invalid share of user3");
    })

    it("withdraw from new fund", async function() {
        var amountUser1 = lastBalance1 / 4;      
        var oldBalance = await web3.eth.getBalance(user1);        
        var txr = await newFund.withdraw(amountUser1, {from:user1, gasPrice:gasPrice});                
        var newBalance = await web3.eth.getBalance(user1);
        var gasUsedCost = txr.receipt.gasUsed*gasPrice;        
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amountUser1, "User1 should receive its amount");
        lastBalance1 -= amountUser1;
        assert.equal(await newFund.etherBalanceOf.call(user1), lastBalance1, "Invalid user1 claiamble ether")

        var amountUser2 = lastBalance2 / 2;      
        oldBalance = await web3.eth.getBalance(user3);
        txr = await newFund.withdraw(amountUser2, {from:user3, gasPrice:gasPrice});
        newBalance = await web3.eth.getBalance(user3);
        gasUsedCost = txr.receipt.gasUsed*gasPrice;
        lastBalance2 = lastBalance2 - amountUser2;
        assert.equal(newBalance.minus(oldBalance).toNumber() + gasUsedCost, amountUser2, "User3 should receive its amount");
        assert.equal(await newFund.etherBalanceOf.call(user3), lastBalance2, "Invalid user3 claiamble ether")        
    })

    it("try to change shares to invalid (overflow test). should fail", async function() {
        try {
            let tx = await fund.changeShares3(user1, 65535, user3, 301, user4, 700);
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares to invalid 20/30/70. should fail", async function() {
        try {
            await fund.changeShares3(user1, 200, user3, 300, user4, 700);
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares to invalid users. should fail", async function() {
        try {
            await fund.changeShares3(user1, 300, user2, 500, user4, 200);
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })

    it("try to change shares as not owner. should fail", async function() {
        try {
            await fund.changeShares3(user1, 300, user3, 400, user4, 300, {from:user1});
        } catch(e) {
            return true;
        }
        throw "Function should fail";
    })
    
    it("transfer 1 ether and add 3rd receiver", async function() {
        await web3.eth.sendTransaction({from:owner, to:newFund.address, value:tranche3});
        
        lastBalance1 += tranche3 * share1/1000;
        lastBalance2 += tranche3 * share2/1000;

        share1 = 200;
        share2 = 700;
        share3 = 100;
        await newFund.changeShares3(user1, share1, user3, share2, user4, share3);

        assert.equal(await newFund.sharePermille.call(user1), share1, "Invalid share of user1");
        assert.equal(await newFund.sharePermille.call(user3), share2, "Invalid share of user3");
        assert.equal(await newFund.sharePermille.call(user4), share3, "Invalid share of user4");
        
        assert.equal((await newFund.etherBalanceOf.call(user1)).toNumber(), lastBalance1, "Invalid user1 balance");                
        assert.equal((await newFund.etherBalanceOf.call(user3)).toNumber(), lastBalance2, "Invalid user3 balance");
        assert.equal((await newFund.etherBalanceOf.call(user4)).toNumber(), 0, "Invalid user4 balance");
    })    

    it("transfer 1 ether to fund, new shares should be distributed", async function() {
        await web3.eth.sendTransaction({from:owner, to:newFund.address, value:tranche3});

        assert.equal((await newFund.etherBalanceOf.call(user1)).toNumber(), lastBalance1 +  tranche3 * share1/1000, "Invalid user1 balance");                
        assert.equal((await newFund.etherBalanceOf.call(user3)).toNumber(), lastBalance2 +  tranche3 * share2/1000, "Invalid user3 balance");
        assert.equal((await newFund.etherBalanceOf.call(user4)).toNumber(), tranche3 * share3/1000, "Invalid user4 balance");
    })

    it("withdraw to another user", async function() {
        var currentBalance = (await newFund.etherBalanceOf.call(user4)).toNumber();
        var amount = currentBalance / 4;

        var oldBalance = await web3.eth.getBalance(user1);
        await newFund.withdrawTo(user1, amount, {from:user4});
        var newBalance = await web3.eth.getBalance(user1);

        assert.equal(await newFund.etherBalanceOf.call(user4), currentBalance - amount, "Ether balance of user4 should be decreased");
        assert.equal(newBalance.minus(oldBalance).toNumber(), amount, "Invalid amount received by user1");
    })
})

contract("measure gas", function(accounts) {
    var share1 = 200;
    var share2 = 800;
    var owner = accounts[0];
    var user1 = accounts[1];
    var user2 = accounts[2];
    var user3 = accounts[3];
    var fund;
    var lastBalance1;
    var lastBalance2;
    var amountUser1;
    var amountUser2;

    it("test", async function() {
        fund = await Fund.new(user1, share1, user2, share2);
        console.log("Fund: " + web3.eth.getTransactionReceipt(fund.transactionHash).gasUsed);

        await web3.eth.sendTransaction({from:owner, to:fund.address, value:tranche1});
        var amount = (await fund.etherBalanceOf.call(user1)) / 3;
        var txr = await fund.withdraw(amount, {from:user1});
        console.log("Withdraw user1 " + txr.receipt.gasUsed);

        txr = await fund.withdraw(amount, {from:user2});
        console.log("Withdraw user2 " + txr.receipt.gasUsed);

        txr = await fund.withdraw(amount, {from:user1});
        console.log("Withdraw user1 again " + txr.receipt.gasUsed);

        txr = await fund.withdraw(amount, {from:user2});
        console.log("Withdraw user2 again " + txr.receipt.gasUsed);
    })
})