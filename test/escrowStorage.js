let EscrowStorage = artifacts.require("EscrowStorage");

let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);

let users;
let escrowStorage;

let initialFee = 120;
let validFee = 459;
let invalidFee = 1200;

async function prepare(accounts) {
    users = utils.makeRoles(accounts);
}

async function verifyEscrow(escrow, expectedSet, expectedActive, expectedFee) {
    assert.equal(await escrowStorage.isEscrow.call(escrow), expectedSet, "Invalild 'isSet' flag");
    assert.equal(await escrowStorage.isEscrowActive.call(escrow), expectedActive, "Invalid 'active' flag");
    assert.equal(
        (await escrowStorage.getEscrowCurrentFee.call(escrow)).toNumber(), 
        expectedFee, 
        "Invalid escrow fee"
    );
}

contract("EscrowStorage. Create with 2 escrows", function(accounts) {
    
    let fees = [400, 600];

    before(async function() {
        await prepare(accounts);
        escrowStorage = await EscrowStorage.new([users.provider, users.owner], fees);
    })

    it("verify total escrows", async function() {
        assert.equal((await escrowStorage.getTotalEscrowAgents.call()).toNumber(), 2, "Invalid total escrows");        
    });

    it("verify first escrow set", async function() {
        await verifyEscrow(users.provider, true, true, fees[[0]]);
    });

    it("verify second escrow set", async function() {
        await verifyEscrow(users.owner, true, true, fees[[1]]);
    });

    it("verify that no other escrow is set", async function() {
        assert.isFalse(await escrowStorage.isEscrow.call(users.user1), "Escrow should not be set");
    }); 
    
    it("verify getEscrowInfo results", async function() {
        let result1 = await escrowStorage.getEscrowInfo.call(1);
        assert.equal(result1[0], users.owner, "Invalid address");
        assert.equal(result1[1], true, "Invalid active flag");
        assert.equal(result1[2], false, "Invalid banned flag");
        assert.equal(result1[3], fees[1], "Invalid fee");
    });
});

contract("EscrowStorage. Exceptions", function(accounts) {
    before(async function() {
        users = utils.makeRoles(accounts);
    });

    it("can't create if initial escrows is more than 4", async function() {
        await utils.expectContractException(async function() {
            await EscrowStorage.new(
                [accounts[0],accounts[1],accounts[2], accounts[3],accounts[5]],
                [100, 200, 300, 400, 500]
            );
        });
    });

    it("can't create if input arrays' lengths are not equal", async function() {
        await utils.expectContractException(async function() {
            await EscrowStorage.new(
                [accounts[0],accounts[3],accounts[4]],
                [100, 200]
            );
        });
    });
});

contract("EscrowStorage. Add escrow", function(accounts) {
    let fee = 455;

    beforeEach(async function() {
        users = utils.makeRoles(accounts);
        escrowStorage = await utils.createEscrowStorage(users.owner);
        await escrowStorage.setManager(users.manager, true);
    });

    it("verify data after new escsrow added with 'addEscrow' as manager", async function() {
        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 1, "Initially there should be 1 escrow");
        await escrowStorage.addEscrow(users.user1, fee, {from:users.manager});

        await verifyEscrow(users.user1, true, true, fee);
        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "There should be 2 escrows");
    });

    it("verify event emitted after escrow added", async function() {
        let tx = await escrowStorage.addEscrow(users.user1, fee);
        let event = tx.logs[0];        
        assert.equal(event.event, "NewEscrowSet", "Invalid event name");
        assert.equal(event.args.escrow, users.user1, "Invalid event parameter");        
    });

    it("can't add already added escrow", async function() {
        await escrowStorage.addEscrow(users.user1, 100);

        await utils.expectContractException(async function() {
            await escrowStorage.addEscrow(users.user1, 120);
        }); 
    });
   
    it("cant 'addEscrow' as non-manager", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.addEscrow(users.user1, 120, {from:users.user2});
        }); 
    });

    it("cant add with fee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.addEscrow(users.user1, 1200, {from:users.manager});
        }); 
    });    
});

contract("EscrowStorage. Edit escrow", function(accounts) {

    beforeEach(async function() {
        users = utils.makeRoles(accounts);        
        escrowStorage = await utils.createEscrowStorage(users.owner);
        await escrowStorage.setManager(users.manager, true);
        await escrowStorage.addEscrow(users.escrow, initialFee);
    });

    it("verify data after 'editEscrow'", async function() {
        await escrowStorage.editEscrow(users.escrow, false, validFee);
        await verifyEscrow(users.escrow, true, false, validFee);
        assert.equal(await escrowStorage.getTotalEscrowAgents.call(), 2, "There should be 2 escrows");
    });

    it("cant edit as non manager", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.editEscrow(users.escrow, true, validFee, {from:users.user1});
        }); 
    });  

    it("cant edit non-set escrow", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.editEscrow(users.user1, true, validFee);
        }); 
    });  

    it("cant set fee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.editEscrow(users.escrow, true, invalidFee);
        }); 
    });  
});

contract("EscrowStorage. banEscrow", function(accounts) {
    users = utils.makeRoles(accounts);
    before(async function() {
        escrowStorage = await utils.createEscrowStorage(users.owner);
        await escrowStorage.setManager(users.manager, true);
        await escrowStorage.addEscrow(users.escrow, initialFee);
    });

    it("can't call banEscrow as non-manager", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.banEscrow(users.escrow, true, {from:users.user1});
        });
    });

    it("can't ban non-set escrow", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.banEscrow(users.manager, true, {from:users.manager});
        });
    });

    it("verify results and event after succesful banEscrow ", async function() {
        let tx = await escrowStorage.banEscrow(users.escrow, true, {from:users.manager});
        let event = tx.logs[0];

        assert.isTrue(await escrowStorage.isEscrowBanned.call(users.escrow), "Should be banned");

        assert.equal(event.event, "EscrowBanned", "Invalid event name");
        assert.equal(event.args.escrow, users.escrow, "Invalid event parameter 1");
        assert.equal(event.args.state, true, "Invalid event parameter 2");
    });

    it("verify results and event after succesful un-banEscrow ", async function() {
        let tx = await escrowStorage.banEscrow(users.escrow, false, {from:users.manager});
        let event = tx.logs[0];

        assert.isFalse(await escrowStorage.isEscrowBanned.call(users.escrow), "Should be banned");

        assert.equal(event.event, "EscrowBanned", "Invalid event name");
        assert.equal(event.args.escrow, users.escrow, "Invalid event parameter 1");
        assert.equal(event.args.state, false, "Invalid event parameter 2");
    });
});

contract("EscrowStorage. setProducEscrow", function(accounts) {
    
    let seconds = 5000;
    let productId = 10;

    beforeEach(async function() {
        users = utils.makeRoles(accounts);        
        escrowStorage = await utils.createEscrowStorage(users.escrow);
        await escrowStorage.setManager(users.manager, true);
    });

    it("verify data and event after setProductEscrow", async function() {        
        let tx = await escrowStorage.setProductEscrow(productId, users.escrow, validFee, seconds, {from:users.manager});

        let event = tx.logs[0];
        assert.equal(event.event, "ProductEscrowSet", "Invalid event name");
        assert.equal(event.args.productId.toNumber(), productId, "Invalid event argument 1");
        assert.equal(event.args.escrow, users.escrow, "Invalid event argument 2");

        assert.equal(
            await escrowStorage.getProductEscrow.call(productId),
            users.escrow,
            "Invalid escrow"
        );

        assert.equal(
            await escrowStorage.getProductEscrowFee.call(productId),
            validFee,
            "Invalid escrow fee"
        );

        assert.equal(
            await escrowStorage.getProductEscrowHoldTime.call(productId),
            seconds,
            "Invalid escrow time"
        );
    });
    
    it("verify that we can check escrow products using events", async function() {
        await escrowStorage.addEscrow(users.user1, validFee);

        await escrowStorage.setProductEscrow(0, users.escrow, validFee, seconds, {from:users.manager});
        await escrowStorage.setProductEscrow(1, users.escrow, validFee, seconds, {from:users.manager});
        await escrowStorage.setProductEscrow(2, users.user1, validFee, seconds, {from:users.manager});
        await escrowStorage.setProductEscrow(3, users.escrow, validFee, seconds, {from:users.manager});

        let eventObj = escrowStorage.ProductEscrowSet({escrow:users.escrow}, {fromBlock: 0, toBlock: 'latest'});
        let ids = [];
        eventObj.get(function(error, logs) {
            // console.log(logs);
            // logs.forEach(element => {
            //     console.log(element.args.productId.toString());
            // });
            assert.equal(logs.length, 3, "Invalid length");                        
        });        
    });

    it("can't set escrow as non manager", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.setProductEscrow(productId, users.escrow, validFee, seconds, {from:users.user2});
        });
    });  

    //active escrow
    it("can'set inactive escrow", async function() {
        await escrowStorage.editEscrow(users.escrow, false, validFee);
        await utils.expectContractException(async function() {
            await escrowStorage.setProductEscrow(productId, users.escrow, validFee, seconds, {from:users.manager});
        });
    });

    //valid escrow
    it("can'set invalid escrow", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.setProductEscrow(productId, users.user1, validFee, seconds, {from:users.manager});
        });
    });

    //fee > 1000
    it("can'set fee > 1000", async function() {
        await utils.expectContractException(async function() {
            await escrowStorage.setProductEscrow(productId, users.escrow, invalidFee, seconds, {from:users.manager});
        });
    });
});

contract("EscrowStorage. Measure gas", function(accounts) {
    users = utils.makeRoles(accounts);
    before(async function() {
        await prepare(accounts);
    });

    it("constructor. 1 escrow", async function() {
        escrowStorage = await utils.createEscrowStorage(users.owner);
        console.log(`Gas used ${utils.gasUsedDeploy(escrowStorage)}`);
    });

    it("constructor. 2 escrows", async function() {
        escrowStorage = await EscrowStorage.new([users.provider, users.owner], [400, 500]);
        console.log(`Gas used ${utils.gasUsedDeploy(escrowStorage)}`);
    });
});