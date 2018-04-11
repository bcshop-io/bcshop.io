let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

let Active = artifacts.require("TestActive");
let Owned = artifacts.require("Owned");
let Manageable = artifacts.require("Manageable");


contract("Active", function(accounts) {
    let testObject;
    let owner = accounts[1];
    let user = accounts[2];

    before(async function() {
        testObject = await Active.new({from:owner});
    });

    it("verifies that initially activeState is true", async function() {
        assert.isTrue(await testObject.activeState.call(), "Initially should be active");
        assert.equal(await testObject.data.call(), 0, "Data should be 0");
    });

    it("activeOnly methods can be called", async function() {
        await testObject.callWhenActive();
        assert.equal(await testObject.data.call(), 1, "Data should be 1");
    });

    it("inactiveOnly methods can't be called", async function() {
        await utils.expectContractException(async function() {
            await testObject.callWhenInactive();
        });       
    });

    it("toggle activeState and verifies that it is false", async function() {
        await testObject.setActive(false, {from:owner});
        assert.isFalse(await testObject.activeState.call());
    });

    it("now inactiveOnly methods can be called", async function() {
        await testObject.callWhenInactive();
        assert.equal(await testObject.data.call(), 2, "Data should be 1");
    });

    it("now activeOnly methods can't be called", async function() {
        await utils.expectContractException(async function() {
            await testObject.callWhenActive();
        });       
    });

    it("toggle activeState back to true and verifies that it is true", async function() {
        await testObject.setActive(true, {from:owner});
        assert.isTrue(await testObject.activeState.call());
    });
    
    it("can't call setActive as not an owner", async function() {
        await utils.expectContractException(async function() {
            await testObject.setActive(true, {from:user});
        });
    });
});


contract("Owned", function(accounts) {

    let testObject;
    let owner = accounts[1];
    let user = accounts[2];
    let newOwner = accounts[3];

    before(async function() {
        testObject = await Owned.new({from:owner});
    });

    it("verify owner after creation", async function() {
        assert.equal(owner, await testObject.owner.call(), "Invalid owner");
    });

    it("try to change owner as not current owner, should fail", async function() {
        try {
            await testObject.transferOwnership(newOwner, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    it("change owner and verify new owner", async function() {
        await testObject.transferOwnership(newOwner, {from:owner});
        assert.equal(newOwner, await testObject.owner.call(), "Invalid new owner");
    });
});


contract("Manageable", function(accounts) {
    
    let testObject;
    let owner = accounts[1];
    let user = accounts[2];
    let manager = accounts[3];
    let newOwner = accounts[4];

    before(async function() {
        testObject = await Manageable.new({from:owner});
    });

    it("verify owner is manager after creation", async function() {
        assert.isTrue(await testObject.managers.call(owner), "Owner should be manager as well");
    }); 

    it("verify that any address is not a manager by default", async function() {
        assert.isFalse(await testObject.managers.call(user), "User should be manager as well");
    }); 

    it("try to set manager as not owner or manager, should fail", async function() {
        try {
            await testObject.setManager(manager, true, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    it("set manager and verify it", async function() {
        await testObject.setManager(manager, true, {from:owner});
        assert.isTrue(await testObject.managers.call(manager), "Invalid manager");
    });

    it("try to set manager as a manager, should fail", async function() {
        try {
            await testObject.setManager(user, true, {from:manager});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    it("set manager to false, verify it is not a manager", async function() {
        await testObject.setManager(manager, false, {from:owner});
        assert.isFalse(await testObject.managers.call(manager), "Invalid manager");
    });

    it("try to change owner as not current owner, should fail", async function() {
        try {
            await testObject.transferOwnership(newOwner, {from:user});
        } catch (e) {
            return true;
        }
        throw "Should fail";
    });

    it("verify new owner is manager after owner change, old owner is not manager", async function() {
        await testObject.transferOwnership(newOwner, {from:owner});

        assert.equal(newOwner, await testObject.owner.call(), "Invalid new owner");
        assert.isFalse(await testObject.managers.call(owner), "Old owner should not be manager");
        assert.isTrue(await testObject.managers.call(newOwner), "New owner should be manager");
    });
});


contract("EtherHolder", function (accounts) {

    let EtherHolder = artifacts.require("EtherHolder");
    let testObject;
    let amount = utils.toWei(1);
    let owner = accounts[0];
    let user = accounts[1];
    let manager = accounts[2];

    beforeEach(async function() {
        testObject = await EtherHolder.new();
        await testObject.setManager(manager, true);
        await utils.sendEther(owner, testObject.address, amount);
    });
    
    it("withdraw to user a part of balance", async function() {        
        let oldBalance = await utils.getBalance(user);
        await testObject.withdrawEtherTo(amount*0.4, user);
        let newBalance = await utils.getBalance(user);

        assert.equal(newBalance.minus(oldBalance), amount*0.4, "Invalid amount withdrawn");
        assert.equal(await utils.getBalance(testObject.address), amount*0.6, "Holder should contain the remaining");
    });

    it("withdraw to user the whole balance as manager", async function() {        
        let oldBalance = await utils.getBalance(user);
        await testObject.withdrawEtherTo(amount, user, {from: manager});
        let newBalance = await utils.getBalance(user);

        assert.equal(newBalance.minus(oldBalance), amount, "Invalid amount withdrawn");
        assert.equal(await utils.getBalance(testObject.address), 0, "Holder should be empty");
    });

    it("can't withdraw more than balance", async function() {
        await utils.expectContractException(async function() {
            await testObject.withdrawEtherTo(amount * 2, user);
        });
    });

    it("can't withdraw as not an owner or manager", async function() {
        await utils.expectContractException(async function() {
            await testObject.withdrawEtherTo(amount, user, {from:user});
        });
    });
});