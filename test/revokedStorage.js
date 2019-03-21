let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let utils = new (require("./utils.js"))(web3);
let users;

let RevokedStorage = artifacts.require("RevokedStorage");
let revokedStorage;

const productId = 1;
const purchaseId = 5;

async function prepare(accounts) {
    users = utils.makeRoles(accounts);
    revokedStorage = await RevokedStorage.new();
    await revokedStorage.setManager(users.manager, true);
}


contract("RevokedStorage. setRevokedFlag", function(accounts) {
    
    beforeEach(async function() {
        await prepare(accounts);
    });
    
    async function checkData(state) {
        const tx = await revokedStorage.setRevokedFlag(productId, purchaseId, state, {from:users.manager});
        const event = tx.logs[0];
        assert.equal(event.event, "RevokedFlagSet", "Invalid event name");
        assert.equal(event.args.productId, productId, "Invalid event argument 1");
        assert.equal(event.args.purchaseId, purchaseId, "Invalid event argument 2"); 
        assert.equal(event.args.state, state, "Invalid event argument 3"); 

        assert.equal(
            await revokedStorage.revokedPurchases.call(productId, purchaseId),
            state,
            "Invalid revoked flag"
        );
    }

    it("verify data after setRevokedFlag to true", async function() {
        assert.isFalse(
            await revokedStorage.revokedPurchases.call(productId, purchaseId),
            'Flag should be false'
        );
        await checkData(true);
    });

    it("verify data after setRevokedFlag to false", async function() {
        await revokedStorage.setRevokedFlag(productId, purchaseId, true, {from:users.manager});
        assert.isTrue(
            await revokedStorage.revokedPurchases.call(productId, purchaseId),
            'Flag should be true'
        );
        await checkData(false);
    });

    it("can't call as non-manager", async function() {
        await utils.expectContractException(async function() {
            await revokedStorage.setRevokedFlag(productId, purchaseId, true, {from:users.user1});
        });
    });
});


contract("RevokedStorage. saveEscrowFee", function(accounts) {
    
    beforeEach(async function() {
        await prepare(accounts);
    });
    
    async function checkData(fee) {
        const tx = await revokedStorage.saveEscrowFee(productId, purchaseId, fee, {from:users.manager});
        const event = tx.logs[0];
        assert.equal(event.event, "EscrowFeeSet", "Invalid event name");
        assert.equal(event.args.productId, productId, "Invalid event argument 1");
        assert.equal(event.args.purchaseId, purchaseId, "Invalid event argument 2"); 
        assert.equal(event.args.fee, fee, "Invalid event argument 3"); 

        assert.equal(
            await revokedStorage.escrowFee.call(productId, purchaseId),
            fee,
            "Invalid fee"
        );
    }

    it("verify data after saveEscrowFee", async function() {        
        assert.equal(
            (await revokedStorage.escrowFee.call(productId, purchaseId)).toNumber(),
            0,
            'fee should be 0'
        );
        await checkData(20000);
    });

    it("can't call as non-manager", async function() {
        await utils.expectContractException(async function() {
            await revokedStorage.saveEscrowFee(productId, purchaseId, 2000, {from:users.user1});
        });
    });
});

contract("RevokedStorage. gas", function(accounts) {    

    it("measure gas", async function() {
        await prepare(accounts);
        console.log(`Constructor gas used: ${utils.gasUsedDeploy(revokedStorage)}`);
    });
});