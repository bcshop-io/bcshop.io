let Web3 = require("web3");
let web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));
let timeutils = new (require("./timeutils.js"))(web3);
let utils = new (require("./utils.js"))(web3);

let affStorage;
let users;

async function prepare(accounts) {
    users = utils.makeRoles(accounts);

    affStorage = await utils.createAffiliateStorage();
    await affStorage.setManager(users.manager, true);
}

contract("AffiliateStorage", function(accounts) {

    beforeEach(async function() {
        await prepare(accounts);
    });

    it("setAffiliate can only be called by manager", async function() {
        await utils.expectContractException(async function() {
            await affStorage.setAffiliate(users.vendor, users.affiliate, {from:users.user1});
        });
    });

    it("verifies data after setAffiliate", async function() {
        await affStorage.setAffiliate(users.vendor, users.affiliate, {from:users.manager});

        assert.equal(
            await affStorage.affiliates.call(users.vendor),
            users.affiliate,
            "Invalid affiliate set for vendor"
        );

        assert.isTrue(
            await affStorage.affiliateSet.call(users.vendor),
            "Affiliate should be set"
        );
    });

    it("event should be emitted in setAffiliate", async function() {
        let tx = await affStorage.setAffiliate(users.vendor, users.affiliate, {from:users.manager});
        let event = tx.logs[0];        
        assert.equal(event.event, "AffiliateSet", "Invalid event name");
        assert.equal(event.args.vendor, users.vendor, "Invalid vendor");
        assert.equal(event.args.affiliate, users.affiliate, "Invalid affiliate");
    });
});

contract("AffiliateStorage. measure gas", function(accounts) {
    before(async function() {
        await prepare(accounts);
    });

    it("Constructor", async function() {
        console.log("Gas used: " + utils.gasUsedDeploy(affStorage));
    });

    it("SetAffiliate", async function() {
        let tx = await affStorage.setAffiliate(users.vendor, users.affiliate, {from:users.manager});
        console.log("Gas used: " + utils.gasUsedTx(tx));
    });
});