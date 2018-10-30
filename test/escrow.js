let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

let users;
let escrowStorage;
let escrow;
let legacyHoldTimeSeconds = 86400;
let legacyFee = 30;
let invalidFee = 1001;

async function prepare(accounts) {
    users = utils.makeRoles(accounts);
    escrowStorage = await utils.createEscrowStorage(users.owner);
    escrow = await utils.createEscrowProvider(escrowStorage, users.owner, legacyHoldTimeSeconds, legacyFee); 
    await escrow.setManager(users.manager, true);    
}

contract("Escrow. creation and setParams", function(accounts) {

    let invalidFee = 1100;
    let validFee = 10;

    beforeEach(async function() {
        await prepare(accounts);
        await escrowStorage.addEscrow(users.user1, 100);
    });

    it("verify data after creation", async function() {
        assert.equal(await escrow.escrowStorage.call(), escrowStorage.address, "Invalid escrow storage");
        assert.equal(await escrow.legacyHoldTime.call(), legacyHoldTimeSeconds, "Invalid legacy time");
        assert.equal(await escrow.legacyEscrowFee.call(), legacyFee, "Invalid legacy fee");
        assert.equal(await escrow.defaultEscrow.call(), users.owner, "Invalid default escrow");
    });

    it("verify data after setParams", async function() {
        await escrow.setParams(users.user1, 1, validFee, {from:users.manager});

        assert.equal(await escrow.escrowStorage.call(), escrowStorage.address, "Invalid escrow storage");
        assert.equal(await escrow.legacyHoldTime.call(), 1, "Invalid legacy time");
        assert.equal(await escrow.legacyEscrowFee.call(), validFee, "Invalid legacy fee");
        assert.equal(await escrow.defaultEscrow.call(), users.user1, "Invalid default escrow");

    });

    it("can't setParams as non-manager", async function() {
        await utils.expectContractException(async function () {
            await escrow.setParams(users.user1, 1, validFee, {from:users.user1});
        });
    });    

    //create with non-escrow
    it("can't create if default escrow is not set in storage", async function() {
        await utils.expectContractException(async function() {
            await utils.createEscrowProvider(escrowStorage, users.manager, legacyHoldTimeSeconds, legacyFee); 
        });
    });
    //setParams non-escrow
    it("can't setParams if default escrow is not set in storage", async function() {
        await utils.expectContractException(async function() {
            await escrow.setParams(users.manager, 1, validFee, {from:users.manager});
        });
    });

    it("can't create with legacyFee > 1000", async function() {
        await utils.expectContractException(async function() {
            await utils.createEscrowProvider(escrowStorage, users.owner, legacyHoldTimeSeconds, invalidFee); 
        });
    });
    it("can't setParams with legacyFee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrow.setParams(users.user1, 1, invalidFee, {from:users.manager});
        });
    });
});

contract("Escrow. Register as escrow and change info", function(accounts) {
    let initialFee = 20;
    let newFee = 25;

    async function verifyEscrow(escrow, expectedSet, expectedActive, expectedFee) {
        assert.equal(await escrowStorage.isEscrow.call(escrow), expectedSet, "Invalild 'isSet' flag");
        assert.equal(await escrowStorage.isEscrowActive.call(escrow), expectedActive, "Invalid 'active' flag");
        assert.equal(
            (await escrowStorage.getEscrowCurrentFee.call(escrow)).toNumber(), 
            expectedFee, 
            "Invalid escrow fee"
        );
    }

    before(async function() {
        await prepare(accounts);
    });

    it("register as new escrow, verify data", async function() {
        await escrow.update(initialFee, {from:users.escrow});
        await verifyEscrow(users.escrow, true, true, initialFee);
        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "Invalid escrow agents");
    });

    it("edit escrow info, verify data", async function() {
        await escrow.update(newFee, {from:users.escrow});
        await verifyEscrow(users.escrow, true, true, newFee);
    });

    it("verify that new escrow wasn't added", async function() {
        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "Invalid escrow agents");
    });

    it("can't register with fee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrow.update(invalidFee, {from:users.user1});
        });
    });

    it("can't set fee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrow.update(invalidFee, {from:users.escrow});
        });
    }); 

    it("can't register if contract inactive", async function() {
        await escrow.setActive(false);
        await utils.expectContractException(async function() {
            await escrow.update(initialFee, {from:users.user1}); 
        });
    });
});

contract("Escrow. activate/deactivate self", function(accounts) {
    let fee = 20;
    users = utils.makeRoles(accounts);
    
    beforeEach(async function() {
        await prepare(accounts);
        await escrow.update(fee, {from:users.escrow});                
    });

    it("verify data and event after deactivate", async function() {
        let tx = await escrow.activate(false, {from:users.escrow});
        assert.isFalse(await escrowStorage.isEscrowActive.call(users.escrow), "Should be inactive");

        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "Should be 2 escrows still");

        let event = tx.logs[0];

        assert.equal(event.event, "EscrowActivated", "Invalid event name");
        assert.equal(event.args.escrow, users.escrow, "Invalid event parameter 1");
        assert.equal(event.args.state, false, "Invalid event parameter 2");
    });

    it("verify data and event after reactivate", async function() {
        await escrow.activate(false, {from:users.escrow});
        let tx = await escrow.activate(true, {from:users.escrow});
        assert.isTrue(await escrowStorage.isEscrowActive.call(users.escrow), "Should be active");
        assert.equal(await escrowStorage.getEscrowCurrentFee.call(users.escrow), fee, "Fee should not be changed");

        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "Should be 2 escrows still");

        let event = tx.logs[0];

        assert.equal(event.event, "EscrowActivated", "Invalid event name");
        assert.equal(event.args.escrow, users.escrow, "Invalid event parameter 1");
        assert.equal(event.args.state, true, "Invalid event parameter 2");
    });

    it("can't activate non-set escrow", async function() {
        await utils.expectContractException(async function() {
            await escrow.activate(false, {from:users.manager});
        });
    });

    it("cant deactivate if contract not active", async function() {
        await escrow.setActive(false);
        await utils.expectContractException(async function() {
            await escrow.activate(false, {from:users.escrow});
        });
    });    
});
contract("Escrow. Product data", function(accounts) {
    let legacyProductId = 0;
    let bannedProductId = 1;
    let inactiveProductId = 2;
    let productId = 10;

    let fee1 = 20;
    let fee2 = 30;
    let fee3 = 15;
    let time1 = 100000;
    let time2 = 200000;
    let time3 = 300000;

    async function verifyProduct(pid, expectedEscrow, expectedFee, expectedTime) {
        assert.equal(
            await escrow.getProductEscrow.call(pid),
            expectedEscrow,
            "Invalid escrow"
        );

        assert.equal(
            (await escrow.getProductEscrowFee.call(pid)).toNumber(),
            expectedFee,
            "Invalid escrow fee"
        );

        assert.equal(
            (await escrow.getProductEscrowHoldTime.call(pid)).toNumber(),
            expectedTime,
            "Invalid escrow hold time"
        );
    }

    before(async function() {
        /*
        Set default + 3 other escrows
        Assign 3 products to these other escrows
        Make one escrow inactive, other one - banned
        */
        await prepare(accounts);
        await escrow.update(fee1, {from: users.escrow});
        await escrow.update(fee2, {from: users.user1}); //banned
        await escrow.update(fee3, {from: users.user2}); //inactive

        await escrowStorage.setProductEscrow(productId, users.escrow, fee1, time1);
        await escrowStorage.setProductEscrow(bannedProductId, users.user1, fee2, time2);
        await escrowStorage.setProductEscrow(inactiveProductId, users.user2, fee3, time3);

        //await escrowStorage.editEscrow(users.user1, false, fee2);
        await escrowStorage.banEscrow(users.user1, true);
        await escrow.activate(false, {from: users.user2});
    });

    it("check normal product data", async function() {
        await verifyProduct(productId, users.escrow, fee1, time1);
    });

    it("check legacy product data", async function() {
        await verifyProduct(legacyProductId, users.owner, legacyFee, legacyHoldTimeSeconds);
    });

    it("check inactive escrow's product data", async function() {
        await verifyProduct(inactiveProductId, users.owner, fee3, time3);
    });

    it("check banned escrow's product data", async function() {
        await verifyProduct(bannedProductId, users.owner, fee2, time2);
    });

    it("changing the escrow fee doesn't affect already assigned producuts", async function() {
        await escrow.update(fee2 + fee1, {from: users.escrow});
        await verifyProduct(productId, users.escrow, fee1, time1);
    });

    it("after reactivation of escrow it should control products again", async function() {
        await escrow.activate(true, {from:users.user2});
        await verifyProduct(inactiveProductId, users.user2, fee3, time3);
    });

    it("after unban of escrow it should control products again", async function() {
        await escrowStorage.banEscrow(users.user1, false);
        await verifyProduct(bannedProductId, users.user1, fee2, time2);
    });
});

contract("Escrow. Measure gas", function(accounts) {
    users = utils.makeRoles(accounts);
    before(async function() {
        await prepare(accounts);
    });

    it("constructor", async function() {
        console.log(`Gas used ${utils.gasUsedDeploy(escrow)}`);
    });
});