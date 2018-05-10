let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let timeutils = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

let ProxyFund = artifacts.require("ProxyFund");
let EtherFund = artifacts.require("EtherFund");

const gasPrice = 1000000000;
const OneEther = 1000000000000000000;

contract("ProxyFund. General usage", function(accounts) {

    let owner = accounts[0];
    let manager = accounts[1];
    let user = accounts[2];
    let proxy;
    let baseFund;

    before(async function() {
        proxy = await ProxyFund.new();
        //set proxy's share to 100%, the second address parameter here is just for compatibility
        baseFund = await EtherFund.new(proxy .address, 1000, owner, 0);
        await proxy.setBaseFund(baseFund.address);
        await proxy.setManager(manager, true);
    });

    it("transfer 1 ETH to base fund, verify proxy's balance is 1 ETH now", async function() {
        await utils.sendEther(owner, baseFund.address, OneEther);
        assert.equal(await proxy.getBalance.call(), OneEther);
    });
    
    it("withdraw 0.5 ETH to sender, check sender's balance", async function() {
        let balance = await web3.eth.getBalance(owner);
        let tx = await proxy.withdraw(OneEther / 2, {from:owner, gasPrice:gasPrice});
        let newBalance = await web3.eth.getBalance(owner);
        assert.equal(OneEther/2, newBalance.plus(tx.receipt.gasUsed*gasPrice).minus(balance), "Invalid amount withdrawn"); 
    });

    it("check proxy and fund balances. expect proxy:0.5, fund:0", async function() {
        assert.equal(OneEther/2, await web3.eth.getBalance(proxy.address), "Invalid proxy's balance");
        assert.equal(0, await web3.eth.getBalance(baseFund.address), "Invalid fund's balance");
    });
    
    it("send another 1 ETH to the base fund. expected proxy's available: 1.5, balance: 0.5", async function() {
        await utils.sendEther(owner, baseFund.address, OneEther);
        assert.equal(await proxy.getBalance.call(), OneEther*1.5, "Invalid proxy's available balance");
        assert.equal(OneEther/2, (await web3.eth.getBalance(proxy.address)).toNumber(), "Invalid proxy's balance");
        assert.equal(OneEther, await web3.eth.getBalance(baseFund.address), "Invalid fund's balance");
    });

    it("withdraw 0.2 ETH to user, check user and sender's balances", async function() {
        let ownerBalance = await web3.eth.getBalance(owner);
        let userBalance = await web3.eth.getBalance(user);
        
        let tx = await proxy.withdrawTo(user, OneEther/5, {from:owner, gasPrice:gasPrice});
        
        let newOwnerBalance = await web3.eth.getBalance(owner);
        let newUserBalance = await web3.eth.getBalance(user);

        assert.equal((newOwnerBalance.plus(tx.receipt.gasUsed*gasPrice)).toNumber(), ownerBalance.toNumber(), "Invalid sender's balance"); 
        assert.equal(newUserBalance.toNumber(), (userBalance.plus(OneEther/5)).toNumber(), "Invalid user's balance");
    });

    it("check proxy and fund balances. expect proxy:0.3, fund:1", async function() {
        assert.equal(300000000000000000, await web3.eth.getBalance(proxy.address), "Invalid proxy's balance");
        assert.equal(OneEther, await web3.eth.getBalance(baseFund.address), "Invalid fund's balance");
    });

    it("try to withdraw 2 ETH, should fail", async function() {
        try {
            await proxy.withdraw(2*OneEther); 
        } catch(e) {
            return true;
        }
        throw "Should fail";
     });

    it("withdraw 0.5 ETH to sender, expect proxy's balance: 0.8, fund:0", async function() {
        let tx = await proxy.withdraw(OneEther/2);
        let newBalance = await web3.eth.getBalance(owner);
        assert.equal(800000000000000000, await web3.eth.getBalance(proxy.address), "Invalid proxy's balance");
        assert.equal(0, await web3.eth.getBalance(baseFund.address), "Invalid fund's balance");
    });

    it("send 1 ETH directly to proxy. expected balance and available funds: 1.8", async function() {
        await utils.sendEther(owner, proxy.address, OneEther);
        assert.equal(await proxy.getBalance.call(), OneEther*1.8, "Invalid proxy's available balance");
        assert.equal(OneEther*1.8, (await web3.eth.getBalance(proxy.address)).toNumber(), "Invalid proxy's balance");
    });
});

contract("ProxyFund. Access", function(accounts) {

    let owner = accounts[0];
    let manager = accounts[1];
    let user = accounts[2];
    let proxy;
    let baseFund;
    let amount = OneEther/2;

    beforeEach(async function() {
        proxy = await ProxyFund.new();
        baseFund = await EtherFund.new(proxy .address, 1000, owner, 0);
        await proxy.setBaseFund(baseFund.address);
        await utils.sendEther(owner, baseFund.address, amount*2);
        await proxy.setManager(manager, true);
    });

    it("can't setBaseFund as not owner or manager", async function() {
        try {
            await proxy.setBaseFund(0, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";        
    });

    it("can't setBaseFund as manager", async function() {
        try {
            await proxy.setBaseFund(0, {from:manager});
        } catch (e) {
            return true;
        }
        throw "Should fail";        
    });

    it("setBaseFund as owner", async function() {
        await proxy.setBaseFund(accounts[5], {from:owner});
        assert.equal(accounts[5], await proxy.baseFund.call(), "invalid base fund changed");
    });
    
    it("can't withdraw as not manager or owner", async function() {
        try {
            await proxy.withdraw(amount, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";        
    });

    it("can withdraw as manager", async function() {
        assert.equal(await proxy.getBalance.call(), amount*2, "Invalid amount");
        await proxy.withdraw(amount, {from:manager});
        assert.equal(await proxy.getBalance.call(), amount, "Invalid amount left");
    });

    it("can withdraw as owner", async function() {
        assert.equal(await proxy.getBalance.call(), amount*2, "Invalid amount");
        await proxy.withdraw(amount, {from:owner});
        assert.equal(await proxy.getBalance.call(), amount, "Invalid amount left");
    });

    it("can't withdrawTo as not manager or owner", async function() {
        try {
            await proxy.withdrawTo(owner, amount, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";        
    });

    it("can withdrawTo as manager", async function() {
        assert.equal(await proxy.getBalance.call(), amount*2, "Invalid amount");
        await proxy.withdrawTo(user, amount, {from:manager});
        assert.equal(await proxy.getBalance.call(), amount, "Invalid amount left");
    });

    it("can withdrawTo as owner", async function() {
        assert.equal(await proxy.getBalance.call(), amount*2, "Invalid amount");
        await proxy.withdrawTo(user, amount, {from:owner});
        assert.equal(await proxy.getBalance.call(), amount, "Invalid amount left");
    });
});

contract("ProxyFund. measure gas", function(accounts) {
    it("crate proxy fund", async function() {
        proxy = await ProxyFund.new();
        console.log("Fund: " + web3.eth.getTransactionReceipt(proxy.transactionHash).gasUsed);
    });
});